/* eslint-disable @next/next/no-html-link-for-pages -- Vinext currently mis-hydrates next/link in this server route. */
import type { Metadata } from "next";
import PrivacyRequestForm from "./privacy-request-form";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Grocer-Eaze collects, uses, protects, and deletes account and meal-planning data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <main className="privacy-page">
    <header className="privacy-header"><a className="brand" href="/"><span className="brand-mark icon-centered" aria-hidden="true">g</span><span>Grocer•Eaze</span></a><a href="/#account">Account & security</a></header>
    <article className="privacy-document">
      <p className="eyebrow">PRIVACY AT GROCER-EAZE</p>
      <h1>Privacy policy</h1>
      <p className="privacy-updated">Effective August 4, 2026</p>
      <p className="privacy-lede">Grocer-Eaze uses the information you provide to run your account, personalize meal planning, and deliver the plans you ask us to send. We do not sell personal information or use it for third-party advertising.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> name, email address, optional phone number, account role, and membership status.</li>
        <li><strong>Household and planning information:</strong> household name, approximate shopping location, store preferences, family-member names or roles, food preferences, allergies or avoided ingredients, recipes, ratings, meal plans, and grocery lists.</li>
        <li><strong>Billing references:</strong> Stripe customer, subscription, and status identifiers. Grocer-Eaze does not store full payment-card or bank-account numbers.</li>
        <li><strong>Security and operations information:</strong> session identifiers, one-time-code records, rate-limit counters, request metadata, and error or performance events needed to protect and operate the service.</li>
      </ul>
      <p>Food preferences and allergy entries can be sensitive. Only add information needed to plan meals, and do not enter medical records or emergency instructions.</p>

      <h2>How we use information</h2>
      <p>We use information to authenticate accounts, restore saved plans, apply family preferences, find recipes and nearby stores, create grocery lists and clean recipe links, send requested emails or calendar files, manage subscriptions, respond to reports, prevent abuse, and improve reliability.</p>

      <h2>Services that process information</h2>
      <p>Grocer-Eaze uses service providers only for the functions needed to run the product:</p>
      <ul>
        <li><strong>Cloudflare</strong> hosts the application, database, security controls, and operational logs.</li>
        <li><strong>Stripe</strong> processes subscriptions and billing.</li>
        <li><strong>Resend</strong> delivers sign-in codes, plans, and support or privacy messages.</li>
        <li><strong>Spoonacular and TheMealDB</strong> provide recipe search results. Search terms can include selected food preferences or avoided ingredients.</li>
        <li><strong>Pexels</strong> provides fallback recipe imagery.</li>
        <li><strong>OpenStreetMap services</strong> resolve typed or device-provided locations and find nearby grocery stores.</li>
        <li><strong>Google Search</strong> receives the search terms only when you choose the optional “Search the web” link.</li>
      </ul>
      <p>These providers handle information under their own terms and privacy policies. We do not give them Grocer-Eaze account passwords because Grocer-Eaze uses passwordless email verification.</p>

      <h2>Sharing and public links</h2>
      <p>Meal plans and grocery lists are shared only when you choose a recipient or open a text draft. Clean recipe-reader links contain random, unguessable tokens, are excluded from search indexing, expire after 90 days, and can be revoked from Account & security. Anyone who receives a live link can read that recipe, so share it only with people you trust.</p>

      <h2>Retention and deletion</h2>
      <ul>
        <li>One-time sign-in codes expire after 10 minutes; signed-in sessions expire after 30 days.</li>
        <li>Rate-limit records are short-lived and expire after their protection window.</li>
        <li>Clean recipe-reader links expire after 90 days unless revoked sooner.</li>
        <li>Account and meal-planning data is kept while your account remains open, then removed when you use Delete account, subject to limited records that a processor or applicable law may require for billing, fraud prevention, or dispute resolution.</li>
      </ul>
      <p>Deleting an account first attempts to cancel an active Stripe subscription so future subscription charges stop. Stripe and email providers may retain transaction or delivery records under their own legal and security obligations.</p>

      <h2>Security</h2>
      <p>Grocer-Eaze uses encrypted network connections, secure HTTP-only session cookies, hashed session and verification secrets, server-side access checks, owner-scoped database queries, request-size and rate limits, security headers, and private server-side service credentials. No online service can guarantee absolute security, so we also minimize what we collect and give you deletion and revocation controls.</p>

      <h2>Children and family profiles</h2>
      <p>Grocer-Eaze accounts are intended for adults. A parent or guardian may add limited food preferences for household members, including children, but children under 13 should not create their own account or submit personal information directly.</p>

      <h2>Your choices</h2>
      <p>You can edit account and family information, revoke clean recipe links, sign out, or permanently delete the account from Account & security. Use this form if you need a copy or correction of information, help with deletion, or have a privacy question.</p>

      <section className="privacy-contact" aria-labelledby="privacy-contact-title"><h2 id="privacy-contact-title">Privacy request</h2><PrivacyRequestForm /></section>
    </article>
  </main>;
}
