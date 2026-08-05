"use client";

import { FormEvent, useState } from "react";

export default function PrivacyRequestForm() {
  const [form, setForm] = useState({ name: "", email: "", requestType: "Privacy question", details: "", website: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setStatus("");
    const submitted = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/privacy-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submitted) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(data.error || "Your request could not be sent. Please try again."); return; }
      setStatus("Your request was sent to the Grocer-Eaze privacy contact.");
      setForm((current) => ({ ...current, details: "" }));
    } catch {
      setStatus("Your request could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="privacy-request-form" onSubmit={submit}>
    <div className="field"><label htmlFor="privacy-name">Name <small>(optional)</small></label><input id="privacy-name" name="name" className="text-input" autoComplete="name" maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
    <div className="field"><label htmlFor="privacy-email">Email</label><input id="privacy-email" name="email" className="text-input" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
    <div className="field"><label htmlFor="privacy-request-type">Request type</label><select id="privacy-request-type" name="requestType" value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value })}><option>Privacy question</option><option>Access my data</option><option>Correct my data</option><option>Delete my data</option></select></div>
    <div className="field"><label htmlFor="privacy-details">Details <small>(optional)</small></label><textarea id="privacy-details" name="details" maxLength={3000} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /><small className="field-help">Do not include passwords, payment-card details, or medical records.</small></div>
    <div hidden><label htmlFor="privacy-website">Website</label><input id="privacy-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></div>
    <button className="primary" type="submit" disabled={busy}>{busy ? "Sending securely…" : "Send privacy request"}</button>
    {status && <p className="privacy-request-status" role="status" aria-live="polite">{status}</p>}
  </form>;
}
