import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { centerTelemetry, intelligenceSnapshots } from "@/db/schema";

type Center = {
  city: string;
  region: string;
  latitude: number;
  longitude: number;
};

type CenterSignal = Center & {
  temperature?: number;
  windSpeed?: number;
  riskScore: number;
  status: string;
};

type IntelligencePayload = {
  generatedAt: string;
  sources: string[];
  database: {
    mode: string;
    saved: boolean;
    reason?: string;
  };
  national: {
    registeredCandidates: number;
    examCities: number;
    officialLanguages: number;
    publicEducationSpendPercent: number;
    publicEducationSpendYear?: string;
  };
  centers: CenterSignal[];
  events: string[];
  error?: string;
};

const centers: Center[] = [
  { city: "Delhi", region: "North", latitude: 28.6139, longitude: 77.209 },
  { city: "Mumbai", region: "West", latitude: 19.076, longitude: 72.8777 },
  { city: "Kolkata", region: "East", latitude: 22.5726, longitude: 88.3639 },
  { city: "Chennai", region: "South", latitude: 13.0827, longitude: 80.2707 },
  { city: "Bengaluru", region: "South", latitude: 12.9716, longitude: 77.5946 },
  { city: "Hyderabad", region: "South", latitude: 17.385, longitude: 78.4867 },
  { city: "Jaipur", region: "West", latitude: 26.9124, longitude: 75.7873 },
  { city: "Guwahati", region: "North East", latitude: 26.1445, longitude: 91.7362 },
];

const fallback: IntelligencePayload = {
  generatedAt: new Date().toISOString(),
  sources: ["Open-Meteo current weather", "World Bank education indicator"],
  database: { mode: "fallback", saved: false },
  national: {
    registeredCandidates: 2381833,
    examCities: 557,
    officialLanguages: 13,
    publicEducationSpendPercent: 4.1,
  },
  centers: centers.map((center, index) => ({
    ...center,
    temperature: 27 + (index % 5),
    windSpeed: 8 + index,
    riskScore: 18 + index * 4,
    status: index > 5 ? "elevated" : "stable",
  })),
  events: [
    "Public weather feed unavailable; using cached planning baseline.",
    "D1 persistence is optional and activates when the DB binding is available.",
  ],
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "neet-fortress-command-center/1.0" },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function riskFromWeather(temperature?: number, windSpeed?: number) {
  const heat = Math.max(0, (temperature ?? 26) - 30) * 5;
  const wind = Math.max(0, (windSpeed ?? 8) - 18) * 2;
  return Math.max(8, Math.min(88, Math.round(18 + heat + wind)));
}

async function buildLivePayload() {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", centers.map((c) => c.latitude).join(","));
  weatherUrl.searchParams.set("longitude", centers.map((c) => c.longitude).join(","));
  weatherUrl.searchParams.set("current", "temperature_2m,wind_speed_10m");
  weatherUrl.searchParams.set("timezone", "Asia/Kolkata");

  const [weather, education] = await Promise.allSettled([
    fetchJson<{
      current?: { temperature_2m?: number; wind_speed_10m?: number };
    }[]>(weatherUrl.toString()),
    fetchJson<
      [
        unknown,
        {
          value?: number;
          date?: string;
        }[],
      ]
    >(
      "https://api.worldbank.org/v2/country/IND/indicator/SE.XPD.TOTL.GD.ZS?format=json&per_page=5"
    ),
  ]);

  const weatherRows = weather.status === "fulfilled" ? weather.value : [];
  const educationRows = education.status === "fulfilled" ? education.value[1] ?? [] : [];
  const educationSpend = educationRows.find((row) => typeof row.value === "number");

  const rows = centers.map((center, index) => {
    const current = weatherRows[index]?.current;
    const temperature = current?.temperature_2m;
    const windSpeed = current?.wind_speed_10m;
    const riskScore = riskFromWeather(temperature, windSpeed);

    return {
      ...center,
      temperature,
      windSpeed,
      riskScore,
      status: riskScore >= 55 ? "elevated" : "stable",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    sources: ["Open-Meteo current weather", "World Bank education indicator"],
    database: { mode: "live", saved: false },
    national: {
      registeredCandidates: 2381833,
      examCities: 557,
      officialLanguages: 13,
      publicEducationSpendPercent: educationSpend?.value ?? fallback.national.publicEducationSpendPercent,
      publicEducationSpendYear: educationSpend?.date,
    },
    centers: rows,
    events: [
      weather.status === "fulfilled"
        ? `Weather telemetry refreshed for ${rows.length} exam-city command nodes.`
        : `Weather telemetry provider unavailable; ${rows.length} command nodes retained baseline risk scores.`,
      educationSpend
        ? `World Bank education-spend indicator synced for ${educationSpend.date}.`
        : "World Bank education indicator unavailable; retained planning baseline.",
    ],
  };
}

async function saveSnapshot(payload: IntelligencePayload) {
  try {
    const db = getDb();
    await db.insert(intelligenceSnapshots).values({
      source: "public-online-feed",
      payload,
    });
    await Promise.all(
      payload.centers.map((center) =>
        db.insert(centerTelemetry).values({
          city: center.city,
          region: center.region,
          latitude: center.latitude,
          longitude: center.longitude,
          temperature: center.temperature,
          windSpeed: center.windSpeed,
          riskScore: center.riskScore,
          status: center.status,
        })
      )
    );
    payload.database = { mode: "d1", saved: true };
  } catch (error) {
    payload.database = {
      mode: "memory",
      saved: false,
      reason: error instanceof Error ? error.message : "Database unavailable",
    };
  }

  return payload;
}

export async function GET() {
  try {
    const payload = await saveSnapshot(await buildLivePayload());
    return Response.json(payload);
  } catch (error) {
    try {
      const db = getDb();
      const [snapshot] = await db
        .select()
        .from(intelligenceSnapshots)
        .orderBy(desc(intelligenceSnapshots.createdAt))
        .limit(1);

      if (snapshot?.payload) {
        return Response.json({
          ...(snapshot.payload as object),
          database: { mode: "d1-cache", saved: false },
        });
      }
    } catch {
      // Fall through to static fallback.
    }

    return Response.json({
      ...fallback,
      error: error instanceof Error ? error.message : "Public feed unavailable",
    });
  }
}
