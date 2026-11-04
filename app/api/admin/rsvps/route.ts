import { isAdmin } from "@/lib/server/admin-auth";
import { getSupabase } from "@/lib/server/supabase";

export type AdminRsvp = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  attending: boolean;
  guests: number;
  guest_names: string[] | null;
  events: string[];
  message: string | null;
  email_sent_at: string | null;
  email_error: string | null;
};

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { data, error } = await getSupabase()
    .from("rsvps")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[admin] list failed:", error.message);
    return Response.json({ ok: false, error: "Couldn't load RSVPs." }, { status: 500 });
  }
  return Response.json({ ok: true, rsvps: data as AdminRsvp[] }, { headers: { "Cache-Control": "no-store" } });
}
