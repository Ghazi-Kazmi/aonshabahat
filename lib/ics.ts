import { SITE, mapsUrl, pktToUtc, parseLocal, type WeddingEvent } from "@/lib/wedding";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (t: string) => t.replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

/** One calendar file containing every given event (Pakistan time, stored as UTC). */
export function buildIcs(events: WeddingEvent[]) {
  const couple = `${SITE.groom} & ${SITE.bride}`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shadi//Wedding//EN", "METHOD:PUBLISH", "CALSCALE:GREGORIAN"];
  for (const ev of events) {
    const s = parseLocal(ev.start);
    if (!s) continue;
    const e = parseLocal(ev.end);
    const start = pktToUtc(s);
    const end = e ? pktToUtc(e) : new Date(start.getTime() + 3 * 3600e3);
    const map = mapsUrl(ev);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}-${stamp(start)}@aonshabahat`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`${ev.title} · ${couple}`)}`,
      `LOCATION:${esc([ev.venue, ev.address].filter(Boolean).join(", "))}`,
      ...(map ? [`DESCRIPTION:${esc(`Directions: ${map}`)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** "Add to Google Calendar" link for one event (used in emails instead of an .ics attachment). */
export function googleCalendarUrl(ev: WeddingEvent) {
  const s = parseLocal(ev.start);
  if (!s) return "";
  const e = parseLocal(ev.end);
  const start = pktToUtc(s);
  const end = e ? pktToUtc(e) : new Date(start.getTime() + 3 * 3600e3);
  const map = mapsUrl(ev);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${ev.title} · ${SITE.groom} & ${SITE.bride}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: [ev.venue, ev.address].filter(Boolean).join(", "),
    details: map ? `Directions: ${map}` : "",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Browser-only: download a single event as an .ics file. */
export function downloadIcs(ev: WeddingEvent) {
  if (!parseLocal(ev.start)) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buildIcs([ev])], { type: "text/calendar" }));
  a.download = `${ev.id}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
