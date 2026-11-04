import { renderRsvpEmail } from "@/lib/server/mailer";

// Development-only: shows the RSVP email in the browser without sending anything.
// /api/rsvp/preview          → "accepted" email
// /api/rsvp/preview?declined → "declined" email
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const declined = new URL(request.url).searchParams.has("declined");
  const { html, subject } = renderRsvpEmail({
    name: "Ahmed Raza",
    email: "ahmed@example.com",
    phone: "",
    attending: !declined,
    guests: declined ? 0 : 4,
    guestNames: declined ? [] : ["Ayesha Raza", "Hamza Raza", "Fatima Raza"],
    events: declined ? [] : ["nikah", "mehndi", "baraat", "valima"],
    message: "May Allah bless you both with a lifetime of happiness.",
  });
  const page = html
    .replace("<body",`<body data-subject="${subject.replace(/"/g, "&quot;")}"`);
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
