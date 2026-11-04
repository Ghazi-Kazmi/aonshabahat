import "server-only";
import nodemailer from "nodemailer";
import { googleCalendarUrl } from "@/lib/ics";
import type { RsvpInput } from "@/lib/rsvp";
import { CONTACT, EVENTS, SITE, fmtDate, fmtTime, mapsUrl, parseLocal, phoneLinks } from "@/lib/wedding";

// Deliverability: no attachments (images or .ics) and no links to localhost. Automated mail
// from a personal Gmail that carries attachments is very likely to be filed as spam.

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  const user = process.env.EMAIL_USER, pass = process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("EMAIL_USER / EMAIL_APP_PASSWORD are not set");
  transport ??= nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const couple = () => {
  const h = SITE.honorific ? `${SITE.honorific} ` : "";
  return `${h}${SITE.groom} & ${h}${SITE.bride}`;
};

function eventRows(ids: string[]) {
  return EVENTS.filter((e) => ids.includes(e.id)).map((ev) => {
    const s = parseLocal(ev.start);
    const when = s ? `${fmtDate(s)} · ${fmtTime(s)}` : "Date to be announced";
    const where = [ev.venue, ev.address].filter(Boolean).join(", ");
    const map = mapsUrl(ev);
    const cal = googleCalendarUrl(ev);
    const btn = "display:inline-block;margin:10px 8px 0 0;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;text-decoration:none;padding:9px 18px;border-radius:999px;";
    return {
      ev, when, where, map, cal,
      html: `
        <tr><td style="padding:20px 0;border-top:1px solid #3a2e1f;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#a99c86;">${esc(ev.kicker ?? "")}</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#f7f0e4;margin:4px 0 8px;">The <i style="color:#d9b56f;">${esc(ev.title ?? "")}</i></div>
          <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#e8dfd0;">${esc(when)}</div>
          <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#b9ad99;">${esc(where)}</div>
          ${map ? `<a href="${esc(map)}" style="${btn}color:#0f0b08;background:#d9b56f;">Get directions</a>` : ""}
          ${cal ? `<a href="${esc(cal)}" style="${btn}color:#d9b56f;border:1px solid #d9b56f;">Add to calendar</a>` : ""}
        </td></tr>`,
    };
  });
}

export function renderRsvpEmail(rsvp: RsvpInput) {
  const first = rsvp.name.split(" ")[0];
  const rows = rsvp.attending ? eventRows(rsvp.events) : [];
  const p = phoneLinks(CONTACT.phone);
  // A localhost link in an email looks suspicious and is useless to guests; only link a real address.
  const siteEnv = process.env.SITE_URL ?? "";
  const site = /^https:\/\/(?!localhost)/.test(siteEnv) ? siteEnv : "";
  const header = process.env.EMAIL_HEADER_IMAGE_URL ?? "";

  const intro = rsvp.attending
    ? `JazakAllah khair for your RSVP. We are delighted that you${rsvp.guests > 1 ? ` and your family (${rsvp.guests} guests in total)` : ""} will be celebrating with us. Here are the details of the events you'll be joining:`
    : `Thank you for letting us know. We'll truly miss you, and we'd be grateful if you kept us in your duas.`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(couple())}</title></head><body style="margin:0;padding:0;background:#0f0b08;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0b08;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#17110b;border:1px solid #3a2e1f;border-radius:16px;overflow:hidden;">
      ${header
        ? `<tr><td><img src="${esc(header)}" width="600" alt="The wedding of ${esc(couple())}, 17 to 20 November 2026" style="display:block;width:100%;height:auto;border:0;"></td></tr>`
        : `<tr><td style="padding:34px 32px 26px;text-align:center;border-bottom:1px solid #3a2e1f;background:#1f170f;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#a99c86;margin:0 0 6px;">The wedding of</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.2;color:#f7f0e4;">${esc(couple()).replace("&amp;", '<i style="color:#d9b56f;">&amp;</i>')}</div>
        <div style="font-family:Georgia,serif;font-style:italic;font-size:16px;color:#d9b56f;margin-top:8px;">17 – 20 November 2026 · Lahore &amp; Islamabad</div>
      </td></tr>`}
      <tr><td style="padding:26px 32px 8px;">
        <div style="font-family:Georgia,serif;font-size:22px;color:#d9b56f;text-align:center;direction:rtl;margin-bottom:20px;">بِسْمِ ٱللَّٰهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#f7f0e4;margin:0 0 10px;">Assalam-o-Alaikum ${esc(first)},</p>
        <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#d8cfbf;margin:0 0 6px;">${intro}</p>
      </td></tr>
      ${rows.length ? `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map((r) => r.html).join("")}</table></td></tr>` : ""}
      ${rsvp.attending && rsvp.guestNames.length ? `<tr><td style="padding:18px 32px 0;"><div style="font-family:Arial,sans-serif;font-size:13px;color:#a99c86;margin-bottom:6px;">Your party (${rsvp.guests})</div><div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#e8dfd0;">${[rsvp.name, ...rsvp.guestNames].map(esc).join("<br>")}</div></td></tr>` : ""}
      ${rsvp.message ? `<tr><td style="padding:18px 32px 0;"><div style="font-family:Arial,sans-serif;font-size:13px;color:#a99c86;margin-bottom:6px;">Your message</div><div style="font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.6;color:#e8dfd0;border-left:2px solid #d9b56f;padding-left:12px;">${esc(rsvp.message)}</div></td></tr>` : ""}
      <tr><td style="padding:28px 32px 8px;">
        <p style="font-family:Georgia,serif;font-style:italic;font-size:18px;color:#b9ad99;margin:0;">With love,<br><span style="color:#f7f0e4;">${esc(SITE.families)}</span></p>
        ${site ? `<p style="margin:18px 0 0;"><a href="${esc(site)}" style="font-family:Arial,sans-serif;font-size:13px;color:#d9b56f;">View the invitation website</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:20px 32px 26px;border-top:1px solid #3a2e1f;">
        <p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#8d816d;margin:0;">
          ${esc(CONTACT.label)}: ${esc(CONTACT.name)} · <a href="${p.tel}" style="color:#b9ad99;">${p.display}</a> · <a href="mailto:${esc(CONTACT.email)}" style="color:#b9ad99;">${esc(CONTACT.email)}</a><br>
          You received this because you RSVP'd on our wedding website. Need to change your RSVP? Just submit the form again with the same email.
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    `Assalam-o-Alaikum ${first},`, "", intro, "",
    ...rows.flatMap((r) => [`The ${r.ev.title}`, r.when, r.where, r.map ? `Directions: ${r.map}` : "", r.cal ? `Add to calendar: ${r.cal}` : "", ""]),
    rsvp.attending && rsvp.guestNames.length ? `Your party (${rsvp.guests}): ${[rsvp.name, ...rsvp.guestNames].join(", ")}\n` : "",
    rsvp.message ? `Your message: ${rsvp.message}\n` : "",
    "With love,", SITE.families, "",
    `${CONTACT.label}: ${CONTACT.name} · ${p.display} · ${CONTACT.email}`,
  ].filter((l) => l !== undefined).join("\n");

  // Plain, personal subjects: "invitation"-style wording is common in phishing and pushes mail to spam.
  const subject = rsvp.attending
    ? `${first}, your RSVP for Aon & Shabahat's wedding is confirmed`
    : `${first}, thank you for letting us know`;

  return { html, text, subject };
}

type Message = { to: { name: string; address: string }; subject: string; html: string; text: string };

const ccList = () => (process.env.EMAIL_CC ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Backup sender: Ghazi's Gmail over SMTP. Used when EMAIL_PROVIDER=gmail. */
async function sendViaGmail(msg: Message) {
  const cc = ccList();
  const info = await getTransport().sendMail({
    from: { name: process.env.EMAIL_FROM_NAME ?? couple(), address: process.env.EMAIL_USER! },
    replyTo: process.env.EMAIL_USER!,
    to: msg.to,
    ...(cc.length ? { cc } : {}),
    subject: msg.subject, html: msg.html, text: msg.text,
  });
  // Gmail's own receipt: which addresses it accepted, so delivery questions can be checked in the logs.
  console.log("[rsvp] gmail accepted:", info.accepted, "rejected:", info.rejected, info.response);
  if (info.rejected.length) throw new Error(`Rejected by Gmail: ${info.rejected.join(", ")}`);
}

/** Main sender: Resend, from the verified aonshabahat.site domain. Used when EMAIL_PROVIDER=resend. */
async function sendViaResend(msg: Message) {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM_ADDRESS;
  if (!key || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM_ADDRESS are not set");
  const cc = ccList();
  const replyTo = process.env.EMAIL_REPLY_TO;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${process.env.EMAIL_FROM_NAME ?? couple()} <${from}>`,
      to: [`${msg.to.name} <${msg.to.address}>`],
      ...(cc.length ? { cc } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: msg.subject, html: msg.html, text: msg.text,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${data?.message ?? "send failed"}`);
  console.log("[rsvp] resend accepted:", msg.to.address, "id:", data?.id);
}

export async function sendRsvpEmail(rsvp: RsvpInput) {
  const { html, text, subject } = renderRsvpEmail(rsvp);
  const msg: Message = { to: { name: rsvp.name, address: rsvp.email }, subject, html, text };
  const provider = (process.env.EMAIL_PROVIDER ?? "gmail").toLowerCase();
  await (provider === "resend" ? sendViaResend(msg) : sendViaGmail(msg));
}
