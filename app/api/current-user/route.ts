import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(
    { user: user ? { id: user.userId, displayName: user.displayName } : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
