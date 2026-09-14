import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const intelligenceSnapshots = sqliteTable("intelligence_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const centerTelemetry = sqliteTable("center_telemetry", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  region: text("region").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  temperature: real("temperature"),
  windSpeed: real("wind_speed"),
  riskScore: integer("risk_score").notNull(),
  status: text("status").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
