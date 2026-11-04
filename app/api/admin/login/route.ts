import { checkCredentials, clearCookie, sessionCookie } from "@/lib/server/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!checkCredentials(body?.user, body?.pass)) {
    // Small delay to slow down password guessing.
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ ok: false, error: "Incorrect ID or password." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie() } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
}
