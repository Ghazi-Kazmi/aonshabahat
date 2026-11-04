"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { MAX_GUESTS, RSVP_EVENTS, RSVP_EVENT_IDS, validateRsvp, type RsvpErrors, type RsvpResponse } from "@/lib/rsvp";
import { fmtTime, parseLocal, type WeddingEvent } from "@/lib/wedding";

const STORE_KEY = "rsvp-contact";

function tileMeta(ev: WeddingEvent) {
  const s = parseLocal(ev.start);
  const city = ev.address?.split(",").pop()?.trim() ?? "";
  if (!s) return city;
  const day = new Date(Date.UTC(s[0], s[1] - 1, s[2], 12))
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${day} · ${fmtTime(s)}${city ? ` · ${city}` : ""}`;
}

// The modal is only ever created in the browser (after the page loads), so reading storage here is safe.
function saved(): { name?: string; email?: string; phone?: string } {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null") ?? {}; } catch { return {}; }
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export default function RsvpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [attending, setAttending] = useState(true);
  const [events, setEvents] = useState<string[]>(RSVP_EVENT_IDS);
  const [name, setName] = useState(() => saved().name ?? "");
  const [email, setEmail] = useState(() => saved().email ?? "");
  const [phone, setPhone] = useState(() => saved().phone ?? "");
  const [guests, setGuests] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [emailed, setEmailed] = useState(false);
  const [serverErrors, setServerErrors] = useState<RsvpErrors>({});
  const [serverError, setServerError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // On open: lock page scroll, focus the first field, close on Escape.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("is-modal");
    const t = setTimeout(() => (status === "done" ? panelRef.current : nameRef.current)?.focus({ preventScroll: true }), 350);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-modal");
    };
  }, [open, onClose, status]);

  const close = () => {
    onClose();
    // After a finished RSVP, the next open starts a fresh (prefilled) form.
    if (status === "done") setTimeout(() => { setStatus("idle"); setTried(false); setMessage(""); }, 400);
  };

  const input = { name, email, phone, attending, guests, guestNames: guestNames.slice(0, Math.max(0, guests - 1)), events, message, website };
  const check = validateRsvp(input);
  const errors: RsvpErrors = { ...(tried && !check.ok ? check.errors : {}), ...serverErrors };

  const toggle = (id: string) => {
    setServerErrors((e) => ({ ...e, events: undefined }));
    setEvents((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : RSVP_EVENT_IDS.filter((x) => x === id || cur.includes(x))));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setServerError("");
    setServerErrors({});
    if (!check.ok) {
      // Wait a frame so the error highlights are rendered before scrolling to the first one.
      requestAnimationFrame(() => {
        const bad = panelRef.current?.querySelector<HTMLElement>(".rsvp-group.has-error, [aria-invalid='true']");
        bad?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (bad instanceof HTMLInputElement || bad instanceof HTMLTextAreaElement) bad.focus({ preventScroll: true });
      });
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data: RsvpResponse = await res.json();
      if (!data.ok) {
        setStatus("idle");
        if (data.errors) setServerErrors(data.errors);
        setServerError(data.error ?? "Please check the highlighted fields.");
        return;
      }
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ name, email, phone })); } catch {}
      setEmailed(data.emailed);
      setStatus("done");
      panelRef.current?.scrollTo({ top: 0 });
    } catch {
      setStatus("idle");
      setServerError("Couldn't reach the server. Please check your connection and try again.");
    }
  }

  const first = name.trim().split(" ")[0] || "";
  const chosen = RSVP_EVENTS.filter((ev) => events.includes(ev.id)).map((ev) => ev.title);
  const chosenText = chosen.length > 1 ? `${chosen.slice(0, -1).join(", ")} and ${chosen.at(-1)}` : chosen[0];

  return (
    <div className={`rsvp${open ? " is-open" : ""}`} inert={!open} aria-hidden={!open}>
      <div className="rsvp__backdrop" onClick={close} />
      <div className="rsvp__panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="rsvp-title" tabIndex={-1}>
        <span className="rsvp__handle" aria-hidden="true" />
        <button type="button" className="rsvp__close" onClick={close} aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>

        {status === "done" ? (
          <div className="rsvp-done">
            <div className="rsvp-done__petals" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37 + 7) % 100}%`,
                    animationDelay: `${(i % 8) * 0.14}s`,
                    background: ["#d9b56f", "#f2a93b", "#f7f0e4", "#e46a8a"][i % 4],
                  }}
                />
              ))}
            </div>
            <svg className="rsvp-done__seal" viewBox="0 0 88 88" aria-hidden="true">
              <circle cx="44" cy="44" r="40" />
              <path d="M27 45l12 12 23-25" />
            </svg>
            <p className="rsvp-done__urdu" lang="ur" dir="rtl">جزاک اللہ خیر</p>
            <h3 className="rsvp-done__title" id="rsvp-title">Thank you, {first}!</h3>
            <p className="rsvp-done__text">
              {attending
                ? <>We can&apos;t wait to celebrate with you at the <em>{chosenText}</em>.</>
                : <>We&apos;ll miss you. Please keep us in your duas.</>}
            </p>
            <p className="rsvp-done__mail">
              {emailed
                ? <>Your {attending ? "invitation" : "confirmation"} is on its way to <strong>{email}</strong>.</>
                : <>Your RSVP is saved. We couldn&apos;t send the confirmation email just now, so there&apos;s no need to submit again.</>}
            </p>
            <button type="button" className="btn btn--solid rsvp-done__btn" onClick={close}>Done</button>
          </div>
        ) : (
          <form className="rsvp-form" onSubmit={submit} noValidate>
            <header className="rsvp-form__head">
              <p className="rsvp-form__kicker">R · S · V · P</p>
              <h3 className="rsvp-form__title" id="rsvp-title">Will you join us?</h3>
              <p className="rsvp-form__sub">Let us know which celebrations you&apos;ll be at.</p>
            </header>

            <div className="rsvp-choice" role="radiogroup" aria-label="Your response" data-pos={attending ? 0 : 1}>
              <span className="rsvp-choice__thumb" aria-hidden="true" />
              <button type="button" role="radio" aria-checked={attending} onClick={() => setAttending(true)}>Joyfully accepts</button>
              <button type="button" role="radio" aria-checked={!attending} onClick={() => setAttending(false)}>Regretfully declines</button>
            </div>

            {attending && (
              <div className={`rsvp-group${errors.events ? " has-error" : ""}`}>
                <div className="rsvp-group__head">
                  <span className="rsvp-label">I&apos;ll be at</span>
                  <button
                    type="button" className="rsvp-link"
                    onClick={() => setEvents(events.length === RSVP_EVENT_IDS.length ? [] : RSVP_EVENT_IDS)}
                  >
                    {events.length === RSVP_EVENT_IDS.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="rsvp-tiles" role="group" aria-label="Events you'll attend">
                  {RSVP_EVENTS.map((ev) => {
                    const on = events.includes(ev.id);
                    return (
                      <button
                        key={ev.id} type="button" aria-pressed={on} onClick={() => toggle(ev.id)}
                        className={`rsvp-tile${on ? " is-on" : ""}`}
                        style={{ "--img": `url(/assets/stills/${ev.id}.webp)` } as CSSProperties}
                      >
                        <span className="rsvp-tile__img" aria-hidden="true" />
                        <span className="rsvp-tile__seal" aria-hidden="true"><Check /></span>
                        <span className="rsvp-tile__body">
                          <span className="rsvp-tile__urdu" lang="ur" dir="rtl">{ev.urdu}</span>
                          <span className="rsvp-tile__title">{ev.title}</span>
                          <span className="rsvp-tile__meta">{tileMeta(ev)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.events && <p className="rsvp-err" role="alert">{errors.events}</p>}
              </div>
            )}

            <div className="rsvp-fields">
              <label className="rsvp-field">
                <span className="rsvp-label">Full name</span>
                <input
                  ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
                  autoComplete="name" placeholder="e.g. Ahmed Raza" aria-invalid={!!errors.name}
                />
                {errors.name && <span className="rsvp-err">{errors.name}</span>}
              </label>
              <label className="rsvp-field">
                <span className="rsvp-label">Email <em>· your invite is sent here</em></span>
                <input
                  type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email}
                />
                {errors.email && <span className="rsvp-err">{errors.email}</span>}
              </label>
              <label className="rsvp-field">
                <span className="rsvp-label">Phone <em>· optional</em></span>
                <input
                  type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel" placeholder="0300 1234567" aria-invalid={!!errors.phone}
                />
                {errors.phone && <span className="rsvp-err">{errors.phone}</span>}
              </label>

              {attending && (
                <div className="rsvp-field rsvp-field--row">
                  <span className="rsvp-label">Guests <em>· including you</em></span>
                  <div className="rsvp-stepper">
                    <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1} aria-label="Fewer guests">−</button>
                    <output aria-live="polite">{guests}</output>
                    <button type="button" onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))} disabled={guests >= MAX_GUESTS} aria-label="More guests">+</button>
                  </div>
                  {errors.guests && <span className="rsvp-err">{errors.guests}</span>}
                </div>
              )}

              {attending && guests > 1 && (
                <div className="rsvp-guests">
                  {Array.from({ length: guests - 1 }, (_, i) => {
                    const v = guestNames[i] ?? "";
                    const bad = !!errors.guestNames && v.trim().length < 2;
                    return (
                      <label key={i} className="rsvp-field rsvp-guest">
                        <span className="rsvp-label">Guest {i + 2} <em>· full name</em></span>
                        <input
                          value={v} autoComplete="off" placeholder="e.g. Ayesha Raza" aria-invalid={bad}
                          onChange={(e) => setGuestNames((cur) => { const next = [...cur]; next[i] = e.target.value; return next; })}
                        />
                      </label>
                    );
                  })}
                  {errors.guestNames && <span className="rsvp-err">{errors.guestNames}</span>}
                </div>
              )}

              <label className="rsvp-field">
                <span className="rsvp-label">{attending ? "Duas & wishes" : "Your duas for the couple"} <em>· optional</em></span>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={600}
                  placeholder="May Allah bless you both…" aria-invalid={!!errors.message}
                />
                {errors.message && <span className="rsvp-err">{errors.message}</span>}
              </label>

              {/* Honeypot: invisible to people, tempting to bots. */}
              <input
                className="rsvp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
                name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {serverError && <p className="rsvp-err rsvp-err--box" role="alert">{serverError}</p>}

            <button type="submit" className="btn btn--solid rsvp-submit" disabled={status === "sending"}>
              {status === "sending" ? <><span className="rsvp-spin" aria-hidden="true" />Sending…</> : attending ? "Send RSVP" : "Send my regrets"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
