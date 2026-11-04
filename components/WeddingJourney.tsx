"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RsvpModal from "@/components/RsvpModal";
import { createJourney, type JourneyState } from "@/lib/journey";
import { downloadIcs } from "@/lib/ics";
import {
  CONTACT, EVENTS, SITE, fmtDate, fmtTime, getCountdown, mapsUrl, parseLocal, phoneLinks,
  type Countdown as CountdownState, type WeddingEvent,
} from "@/lib/wedding";

const Icon = {
  date: <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  pin: <svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>,
  dress: <svg viewBox="0 0 24 24"><path d="M9 3l3 3 3-3M9 3 6 7l3 2-3 12h12L15 9l3-2-3-4" /></svg>,
  nav: <svg viewBox="0 0 24 24"><path d="M4 11 20 4l-7 16-2-7z" /></svg>,
  cal: <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M12 13v5M9.5 15.5h5" /></svg>,
  phone: <svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>,
  chat: <svg viewBox="0 0 24 24"><path d="M4 20l1.4-4.2A8 8 0 1 1 8.6 19z" /><path d="M9 10.5c.5 2 2.4 3.9 4.5 4.5l1.5-1.5" /></svg>,
  mail: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></svg>,
};

// Rendered only after mount: the time depends on the visitor's clock, not the server's.
function Countdown() {
  const [cd, setCd] = useState<CountdownState | null>(null);
  useEffect(() => {
    const update = () => setCd(getCountdown(Date.now()));
    update();
    const id = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", update); };
  }, []);

  if (!cd) return null;
  if (cd.mode === "live") {
    return <p className="countdown countdown--live"><i />Happening now · The {cd.ev.title}</p>;
  }
  if (cd.mode === "done") {
    return <p className="countdown countdown--done">Alhamdulillah · thank you for celebrating with us</p>;
  }
  const units: [number, string][] = [[cd.days, cd.days === 1 ? "day" : "days"], [cd.hours, "hrs"], [cd.minutes, "min"]];
  return (
    <div className="countdown" role="timer" aria-label={`${cd.days} days, ${cd.hours} hours and ${cd.minutes} minutes until the ${cd.ev.title}`}>
      <div className="countdown__units">
        {units.map(([n, label]) => (
          <span key={label} className="countdown__unit"><b>{String(n).padStart(2, "0")}</b>{label}</span>
        ))}
      </div>
      <p className="countdown__label">until the {cd.ev.title}</p>
    </div>
  );
}

// The number and email are real links so browsers have nothing to auto-link
// (auto-linking rewrites the HTML before React hydrates and causes a mismatch).
function Contact() {
  const p = phoneLinks(CONTACT.phone);
  return (
    <footer className="contact">
      <p className="contact__label">{CONTACT.label} · <span>{CONTACT.name}</span></p>
      <p className="contact__links">
        <a href={p.tel}>{Icon.phone}{p.display}</a>
        <a href={p.whatsapp} target="_blank" rel="noopener">{Icon.chat}WhatsApp</a>
        <a href={`mailto:${CONTACT.email}`}>{Icon.mail}{CONTACT.email}</a>
      </p>
    </footer>
  );
}

function Name({ name }: { name: string }) {
  return (
    <span className="card__name">
      {SITE.honorific && <span className="card__hon">{SITE.honorific}</span>}
      {name}
    </span>
  );
}

function HeroCard({ active }: { active: boolean }) {
  return (
    <article className={`card card--hero${active ? " is-active" : ""}`}>
      <p className="card__bismillah" lang="ar" dir="rtl">بِسْمِ ٱللَّٰهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
      <h1 className="card__names">
        <Name name={SITE.groom} /><em>&amp;</em><Name name={SITE.bride} />
      </h1>
      <p className="card__lede">
        With the blessings of Allah and our families, we invite you to celebrate our wedding with us.
      </p>
      <Countdown />
      <div className="card__badge"><i />Baat pakki · it&apos;s official</div>
      <div className="card__scroll" aria-hidden="true"><span>Scroll to begin</span><i /></div>
    </article>
  );
}

function EventCard({ ev, active }: { ev: WeddingEvent; active: boolean }) {
  const s = parseLocal(ev.start), e = parseLocal(ev.end);
  const url = mapsUrl(ev);
  return (
    <article className={`card${active ? " is-active" : ""}`} id={`card-${ev.id}`}>
      <p className="card__urdu" lang="ur" dir="rtl">{ev.urdu}</p>
      <p className="card__kicker">{ev.kicker}</p>
      <h2 className="card__title">The <em>{ev.title}</em></h2>
      <div className="card__panel">
        <div className="card__meta">
          <div className="card__row">
            {Icon.date}
            {s ? (
              <div><strong>{fmtDate(s)}</strong><span>{fmtTime(s)}{e ? ` – ${fmtTime(e)}` : " onwards"}</span></div>
            ) : (
              <div><strong className="card__tba">Date to be announced</strong></div>
            )}
          </div>
          <div className="card__row">
            {Icon.pin}
            {ev.venue || ev.address ? (
              <div><strong>{ev.venue || ev.address}</strong>{ev.venue && ev.address && <span>{ev.address}</span>}</div>
            ) : (
              <div><strong className="card__tba">Venue to be announced</strong></div>
            )}
          </div>
          {ev.dress && (
            <div className="card__row">{Icon.dress}<div><strong>Dress code</strong><span>{ev.dress}</span></div></div>
          )}
        </div>
        {(url || s) && (
          <div className="card__actions">
            {url && <a className="btn btn--solid" href={url} target="_blank" rel="noopener">{Icon.nav}Directions</a>}
            {s && <button className="btn" type="button" onClick={() => downloadIcs(ev)}>{Icon.cal}Save the date</button>}
          </div>
        )}
      </div>
    </article>
  );
}

export default function WeddingJourney() {
  const fgRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<ReturnType<typeof createJourney>>(null);

  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<JourneyState>({ card: 0, rail: 0, outro: false, scrolled: false, transit: -1 });
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const closeRsvp = useCallback(() => setRsvpOpen(false), []);

  useEffect(() => {
    const journey = createJourney({
      fg: fgRef.current!,
      bg: bgRef.current!,
      frameEl: frameRef.current!,
      track: trackRef.current!,
      outroShade: shadeRef.current!,
      eventCount: EVENTS.length,
      onState: setState,
      onProgress: setPct,
      onReady: () => setReady(true),
    });
    journeyRef.current = journey;
    return () => journey.destroy();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-loading", !ready);
  }, [ready]);

  const hon = SITE.honorific ? `${SITE.honorific} ` : "";
  const couple = `${hon}${SITE.groom} & ${hon}${SITE.bride}`;

  return (
    <>
      <div className={`loader${ready ? " is-done" : ""}`} aria-live="polite">
        <div className="loader__inner">
          <p className="loader__bismillah" lang="ar" dir="rtl">بِسْمِ ٱللَّٰهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <p className="loader__names">{couple}</p>
          <div className="loader__bar"><span style={{ width: `${pct}%` }} /></div>
          <p className="loader__pct">{pct}%</p>
        </div>
      </div>

      <div className="stage" aria-hidden="true">
        <canvas className="stage__bg" ref={bgRef} />
        <div className="stage__frame" ref={frameRef}>
          <canvas ref={fgRef} />
          <div className="stage__shade" />
        </div>
        <div className="stage__outro" ref={shadeRef} />
      </div>

      <section className="cards" aria-label="Wedding events">
        {EVENTS.map((ev, k) =>
          ev.hero
            ? <HeroCard key={ev.id} active={state.card === k} />
            : <EventCard key={ev.id} ev={ev} active={state.card === k} />,
        )}
      </section>

      {EVENTS.map((ev, k) => ev.arrival && (
        <p key={ev.id} className={`arrival${state.transit === k ? " is-active" : ""}`} aria-hidden={state.transit !== k}>
          <span className="arrival__lead">{ev.arrival.lead}</span>
          <span className="arrival__place">{ev.arrival.place}</span>
        </p>
      ))}

      <nav className={`rail${ready ? " is-ready" : ""}${state.outro ? " is-hidden" : ""}`} aria-label="Jump to event">
        {EVENTS.map((ev, k) => (
          <button
            key={ev.id}
            type="button"
            className={state.rail === k ? "is-active" : undefined}
            aria-label={`Go to ${ev.nav}`}
            onClick={() => journeyRef.current?.scrollToEvent(k)}
          >
            <i /><span>{ev.nav}</span>
          </button>
        ))}
      </nav>

      <p className={`bismillah-top${state.card === 0 ? " is-active" : ""}`} lang="ar" dir="rtl" aria-hidden="true">
        بِسْمِ ٱللَّٰهِ الرَّحْمَٰنِ الرَّحِيمِ
      </p>

      <section className={`outro${state.outro ? " is-active" : ""}`} aria-label="Closing">
        <div className="outro__main">
          <p className="outro__urdu" lang="ur" dir="rtl">آپ کی دعائیں ہی ہمارا سب سے قیمتی تحفہ ہیں</p>
          <h2 className="outro__title">Your duas are our greatest gift</h2>
          <p className="outro__text">We can&apos;t wait to celebrate with you. Kindly let us know if you&apos;ll be joining us.</p>
          <button type="button" className="btn outro__cta" onClick={() => setRsvpOpen(true)}>RSVP now</button>
          <p className="outro__sign">With love,<br /><span>{SITE.families}</span></p>
        </div>
        <Contact />
      </section>

      {ready && (
        <button
          type="button"
          className={`rsvp-fab${state.card === 0 ? " is-hero" : ""}${state.outro || rsvpOpen ? " is-hidden" : ""}`}
          onClick={() => setRsvpOpen(true)}
        >
          <i aria-hidden="true" />RSVP
        </button>
      )}

      {ready && <RsvpModal open={rsvpOpen} onClose={closeRsvp} />}

      <main className="track" ref={trackRef} />
    </>
  );
}
