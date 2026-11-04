"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminRsvp } from "@/app/api/admin/rsvps/route";
import { RSVP_EVENTS } from "@/lib/rsvp";

type Filter = "all" | "yes" | "no";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi",
  });
const titleOf = (id: string) => RSVP_EVENTS.find((e) => e.id === id)?.title ?? id;
const party = (r: AdminRsvp) => (r.attending ? [r.name, ...(r.guest_names ?? [])] : []);

function downloadCsv(rows: AdminRsvp[]) {
  const head = ["Submitted (PKT)", "Name", "Email", "Phone", "Attending", "Guests", "Party names",
    ...RSVP_EVENTS.map((e) => e.title), "Message", "Email status"];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [
    fmtWhen(r.updated_at), r.name, r.email, r.phone ?? "", r.attending ? "Yes" : "No", r.guests,
    party(r).join("; "),
    ...RSVP_EVENTS.map((e) => (r.events.includes(e.id) ? "Yes" : "")),
    r.message ?? "", r.email_sent_at ? "Sent" : r.email_error ? "Failed" : "",
  ].map(q).join(","));
  // BOM so Excel opens Urdu/accents correctly.
  const blob = new Blob(["﻿" + [head.map(q).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminRsvp[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [eventFilter, setEventFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rsvps", { cache: "no-store" });
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      if (!data.ok) { setLoadError(data.error ?? "Couldn't load RSVPs."); setAuthed(true); return; }
      setRows(data.rsvps);
      setLoadError("");
      setAuthed(true);
    } catch {
      setLoadError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The wedding page locks scrolling while it loads; this page scrolls normally.
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-admin");
    const t = setTimeout(load, 0);
    return () => { clearTimeout(t); document.body.classList.remove("is-admin"); };
  }, [load]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pass }),
    }).catch(() => null);
    setSigningIn(false);
    if (res?.ok) { setPass(""); load(); } else setLoginError("Incorrect ID or password.");
  }

  async function signOut() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setRows([]);
    setAuthed(false);
  }

  const stats = useMemo(() => {
    const yes = rows.filter((r) => r.attending);
    return {
      households: yes.length,
      guests: yes.reduce((n, r) => n + r.guests, 0),
      declined: rows.length - yes.length,
      perEvent: RSVP_EVENTS.map((e) => ({
        id: e.id, title: e.title, urdu: e.urdu,
        guests: yes.filter((r) => r.events.includes(e.id)).reduce((n, r) => n + r.guests, 0),
        households: yes.filter((r) => r.events.includes(e.id)).length,
      })),
      emailFailed: rows.filter((r) => !r.email_sent_at && r.email_error).length,
    };
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "yes" && !r.attending) return false;
      if (filter === "no" && r.attending) return false;
      if (eventFilter && !r.events.includes(eventFilter)) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone ?? "", r.message ?? "", ...(r.guest_names ?? [])].join(" ").toLowerCase().includes(q);
    });
  }, [rows, query, filter, eventFilter]);

  if (authed === null) return <main className="adm adm--center"><p className="adm-muted">Loading…</p></main>;

  if (!authed) {
    return (
      <main className="adm adm--center">
        <form className="adm-login" onSubmit={signIn}>
          <p className="adm-kicker">Admin</p>
          <h1 className="adm-title">RSVP dashboard</h1>
          <label className="adm-field">
            <span>ID</span>
            <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />
          </label>
          <label className="adm-field">
            <span>Password</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
          </label>
          {loginError && <p className="adm-error">{loginError}</p>}
          <button className="adm-btn adm-btn--gold" disabled={signingIn || !user || !pass}>{signingIn ? "Signing in…" : "Sign in"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <p className="adm-kicker">Dr. Aon &amp; Dr. Shabahat</p>
          <h1 className="adm-title">RSVPs</h1>
        </div>
        <div className="adm-actions">
          <button className="adm-btn" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          <button className="adm-btn" onClick={() => downloadCsv(shown)} disabled={!shown.length}>Download CSV</button>
          <button className="adm-btn adm-btn--ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {loadError && <p className="adm-error adm-error--box">{loadError}</p>}

      <section className="adm-stats">
        <div className="adm-stat adm-stat--hero"><b>{stats.guests}</b><span>guests attending</span></div>
        <div className="adm-stat"><b>{stats.households}</b><span>RSVPs accepted</span></div>
        <div className="adm-stat"><b>{stats.declined}</b><span>declined</span></div>
      </section>
      <section className="adm-stats adm-stats--events">
        {stats.perEvent.map((e) => (
          <button
            key={e.id} type="button"
            className={`adm-stat adm-stat--event${eventFilter === e.id ? " is-on" : ""}`}
            onClick={() => setEventFilter((cur) => (cur === e.id ? null : e.id))}
            title="Filter by this event"
          >
            <i lang="ur" dir="rtl">{e.urdu}</i>
            <b>{e.guests}</b>
            <span>{e.title} · {e.households} RSVPs</span>
          </button>
        ))}
      </section>
      {stats.emailFailed > 0 && (
        <p className="adm-note">⚠ {stats.emailFailed} confirmation email{stats.emailFailed > 1 ? "s" : ""} failed to send. Those guests are marked below.</p>
      )}

      <section className="adm-tools">
        <input className="adm-search" type="search" placeholder="Search name, email, phone, guest…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="adm-seg">
          {(["all", "yes", "no"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "yes" ? "Attending" : "Declined"}
            </button>
          ))}
        </div>
        {eventFilter && <button className="adm-chip is-on" onClick={() => setEventFilter(null)}>{titleOf(eventFilter)} ✕</button>}
        <span className="adm-muted">{shown.length} of {rows.length}</span>
      </section>

      {!rows.length && !loadError ? (
        <p className="adm-empty">No RSVPs yet. They&apos;ll appear here as guests respond.</p>
      ) : (
        <section className="adm-list">
          {shown.map((r) => (
            <article key={r.id} className={`adm-card${r.attending ? "" : " is-declined"}`}>
              <div className="adm-card__top">
                <h2>{r.name}</h2>
                <span className={`adm-badge${r.attending ? " is-yes" : ""}`}>{r.attending ? `${r.guests} attending` : "Declined"}</span>
              </div>
              {r.attending && (
                <div className="adm-chips">{r.events.map((e) => <span key={e} className="adm-chip">{titleOf(e)}</span>)}</div>
              )}
              {party(r).length > 1 && (
                <p className="adm-party"><span>Party</span>{party(r).join(" · ")}</p>
              )}
              <p className="adm-contact">
                <a href={`mailto:${r.email}`}>{r.email}</a>
                {r.phone && <> · <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></>}
              </p>
              {r.message && <blockquote className="adm-msg">{r.message}</blockquote>}
              <p className="adm-meta">
                {fmtWhen(r.updated_at)}
                {Date.parse(r.updated_at) - Date.parse(r.created_at) > 60000 && " · updated"}
                {" · "}
                {r.email_sent_at
                  ? <span className="adm-ok">email sent</span>
                  : r.email_error ? <span className="adm-bad" title={r.email_error}>email failed</span> : "no email"}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
