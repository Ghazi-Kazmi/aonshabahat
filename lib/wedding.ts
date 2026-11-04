/* ============================================================
   WEDDING DETAILS: edit this file.
   start / end: "YYYY-MM-DDTHH:MM" in Pakistan time (24-hour).
   Leave a field as "" if it isn't decided yet; the site shows
   "to be announced" and hides the matching button.
   map: optional Google Maps link. If empty, "Directions" searches
   for the venue name plus address; with no address and no map link
   the button is hidden (a bare venue name is too vague to search).
   ============================================================ */

export const SITE = {
  groom: "Aon",
  bride: "Shabahat",
  // Title shown before both names on the opening screen ("" for none).
  honorific: "Dr.",
  families: "The families of Aon & Shabahat",
};

// Shown at the end of the site. phone: Pakistani mobile number as written locally.
export const CONTACT = {
  label: "For any queries",
  name: "Syed Ghazi Raza",
  phone: "03042262772",
  email: "ghazirkazmi@gmail.com",
};

export type WeddingEvent = {
  id: string;
  nav: string;
  hero?: boolean;
  urdu?: string;
  kicker?: string;
  title?: string;
  start?: string;
  end?: string;
  venue?: string;
  address?: string;
  map?: string;
  dress?: string;
  // Caption shown over the camera move INTO this event, e.g. a change of city.
  arrival?: { lead: string; place: string };
};

export const EVENTS: WeddingEvent[] = [
  { id: "engagement", nav: "Baat Pakki", hero: true },
  {
    id: "nikah", nav: "Nikah", urdu: "نکاح", kicker: "The sacred union", title: "Nikah",
    start: "2026-11-17T10:00", end: "", venue: "Imambargah Qaumi Markaz Masjid", address: "Lahore", map: "", dress: "",
  },
  {
    id: "mehndi", nav: "Mehndi", urdu: "مہندی", kicker: "Colours, dholki & henna", title: "Mehndi",
    start: "2026-11-17T17:00", end: "",
    venue: "Aiwan-e-Noor", address: "10-Civic Center, Johar Town, Lahore", map: "", dress: "",
  },
  {
    id: "baraat", nav: "Baraat", urdu: "بارات", kicker: "The grand arrival", title: "Baraat",
    start: "2026-11-18T18:00", end: "",
    venue: "Le Grand Chalet", address: "Main Maulana Shaukat Ali Road, G.E.C.H.S. Phase 3, Lahore", map: "", dress: "",
  },
  {
    id: "valima", nav: "Valima", urdu: "ولیمہ", kicker: "The celebration feast", title: "Valima",
    start: "2026-11-20T19:00", end: "",
    venue: "Majestic Marquee", address: "Club Road, Islamabad", map: "", dress: "",
    arrival: { lead: "Welcome to", place: "Islamabad" },
  },
];

/* ---------- Helpers ---------- */

type Parts = [number, number, number, number, number];

export function parseLocal(s?: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
  return m ? (m.slice(1).map(Number) as Parts) : null;
}

export function fmtDate([y, mo, d]: Parts) {
  return new Date(Date.UTC(y, mo - 1, d, 12)).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function fmtTime([, , , h, mi]: Parts) {
  return `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Pakistan Standard Time is UTC+5 with no daylight saving.
export const pktToUtc =([y, mo, d, h, mi]: Parts) => new Date(Date.UTC(y, mo - 1, d, h - 5, mi));

export function startMs(ev: WeddingEvent) {
  const s = parseLocal(ev.start);
  return s ? pktToUtc(s).getTime() : null;
}

export type Countdown =
  | { mode: "count"; ev: WeddingEvent; days: number; hours: number; minutes: number }
  | { mode: "live"; ev: WeddingEvent }
  | { mode: "done" };

// An event counts as "happening now" for this long after it starts.
const LIVE_MS = 4 * 3600e3;

export function getCountdown(now: number): Countdown | null {
  const timed = EVENTS
    .map((ev) => ({ ev, t: startMs(ev) }))
    .filter((x): x is { ev: WeddingEvent; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t);
  if (!timed.length) return null;
  const live = timed.find((x) => now >= x.t && now < x.t + LIVE_MS);
  if (live) return { mode: "live", ev: live.ev };
  const next = timed.find((x) => x.t > now);
  if (!next) return { mode: "done" };
  const mins = Math.floor((next.t - now) / 60000);
  return { mode: "count", ev: next.ev, days: Math.floor(mins / 1440), hours: Math.floor((mins % 1440) / 60), minutes: mins % 60 };
}

export function phoneLinks(local: string) {
  const intl = "92" + local.replace(/\D/g, "").replace(/^0/, "");
  return {
    display: local.replace(/^(\d{4})(\d+)$/, "$1 $2"),
    tel: `tel:+${intl}`,
    whatsapp: `https://wa.me/${intl}`,
  };
}

export function mapsUrl(ev: WeddingEvent) {
  if (ev.map) return ev.map;
  if (!ev.address) return "";
  const q = [ev.venue, ev.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
