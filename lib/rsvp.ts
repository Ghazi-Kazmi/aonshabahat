/* RSVP shape and validation, shared by the form (instant feedback) and the API (the real check). */
import { EVENTS } from "@/lib/wedding";

export const RSVP_EVENTS = EVENTS.filter((e) => !e.hero);
export const RSVP_EVENT_IDS = RSVP_EVENTS.map((e) => e.id);
export const MAX_GUESTS = 10;

export type RsvpInput = {
  name: string;
  email: string;
  phone: string;
  attending: boolean;
  guests: number;
  /** Everyone in the party except the person filling the form: always guests - 1 names. */
  guestNames: string[];
  events: string[];
  message: string;
  /** Honeypot: hidden from people, bots fill it in. */
  website?: string;
};

export type RsvpErrors = Partial<Record<"name" | "email" | "phone" | "guests" | "guestNames" | "events" | "message", string>>;

const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateRsvp(raw: unknown): { ok: true; data: RsvpInput } | { ok: false; errors: RsvpErrors } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const data: RsvpInput = {
    name: cleanName(str(r.name)),
    email: str(r.email).toLowerCase(),
    phone: str(r.phone),
    attending: r.attending !== false,
    guests: Number.isInteger(r.guests) ? (r.guests as number) : NaN,
    guestNames: Array.isArray(r.guestNames) ? r.guestNames.map((n) => cleanName(typeof n === "string" ? n : "")) : [],
    events: Array.isArray(r.events) ? [...new Set(r.events.filter((e): e is string => typeof e === "string"))] : [],
    message: str(r.message),
    website: str(r.website),
  };
  if (!data.attending) { data.events = []; data.guests = 0; }
  // Only the first (guests - 1) names count; extra fields left over from lowering the count are dropped.
  data.guestNames = data.guests > 1 ? data.guestNames.slice(0, data.guests - 1) : [];

  const errors: RsvpErrors = {};
  if (data.name.length < 2) errors.name = "Please enter your name.";
  else if (data.name.length > 80) errors.name = "That name is a little long.";
  if (!EMAIL_RE.test(data.email) || data.email.length > 120) errors.email = "Please enter a valid email so we can send your invite.";
  if (data.phone && !/^\+?[\d\s()-]{7,20}$/.test(data.phone)) errors.phone = "That phone number doesn't look right.";
  if (data.attending) {
    if (!data.events.length) errors.events = "Choose at least one event.";
    else if (data.events.some((e) => !RSVP_EVENT_IDS.includes(e))) errors.events = "Unknown event.";
    if (!(data.guests >= 1 && data.guests <= MAX_GUESTS)) errors.guests = `Between 1 and ${MAX_GUESTS} guests, please.`;
    else if (data.guestNames.length < data.guests - 1 || data.guestNames.some((n) => n.length < 2))
      errors.guestNames = "Please add the name of each guest.";
    else if (data.guestNames.some((n) => n.length > 80)) errors.guestNames = "One of the guest names is a little long.";
  }
  if (data.message.length > 600) errors.message = "Please keep your message under 600 characters.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

export type RsvpResponse =
  | { ok: true; emailed: boolean }
  | { ok: false; errors?: RsvpErrors; error?: string };
