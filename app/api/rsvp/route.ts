import { validateRsvp, type RsvpResponse } from "@/lib/rsvp";
import { sendRsvpEmail } from "@/lib/server/mailer";
import { getSupabase } from "@/lib/server/supabase";

const json = (body: RsvpResponse, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = validateRsvp(body);
  if (!result.ok) return json({ ok: false, errors: result.errors }, 400);
  const rsvp = result.data;

  // Bots fill the hidden "website" field; pretend it worked and store nothing.
  if (rsvp.website) return json({ ok: true, emailed: false });

  const db = getSupabase();
  const save = () => db.from("rsvps").upsert(
    {
      name: rsvp.name,
      email: rsvp.email,
      phone: rsvp.phone || null,
      attending: rsvp.attending,
      guests: rsvp.guests,
      guest_names: rsvp.guestNames,
      events: rsvp.events,
      message: rsvp.message || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
  // A brief network blip shows up as "fetch failed"; retry those a couple of times before giving up.
  let { error } = await save();
  for (let attempt = 1; error && /fetch failed|network|timeout/i.test(error.message) && attempt <= 2; attempt++) {
    console.warn(`[rsvp] save retry ${attempt}:`, error.message);
    await new Promise((r) => setTimeout(r, 800 * attempt));
    ({ error } = await save());
  }
  if (error) {
    console.error("[rsvp] save failed:", error.message);
    return json({ ok: false, error: "We couldn't save your RSVP just now. Please try again in a moment." }, 500);
  }

  // The RSVP is saved either way; a failed email is recorded so the family can follow up.
  let emailed = false;
  try {
    await sendRsvpEmail(rsvp);
    emailed = true;
    await db.from("rsvps").update({ email_sent_at: new Date().toISOString(), email_error: null }).eq("email", rsvp.email);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[rsvp] email failed:", message);
    await db.from("rsvps").update({ email_error: message.slice(0, 300) }).eq("email", rsvp.email);
  }

  return json({ ok: true, emailed });
}
