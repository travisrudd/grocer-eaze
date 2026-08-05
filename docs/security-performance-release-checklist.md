# Security, performance, and workflow release checklist

Run this checklist before every public Grocer-Eaze publish. A production publish requires explicit owner confirmation after the results are reviewed.

## Automated gate

- Run `npm run quality` and require a passing result.
- Run `npm run deploy:cloudflare:dry-run` and inspect the packaged routes and bindings.
- Confirm the pull-request release-quality workflow passes.
- Confirm no production dependency has a high or critical known vulnerability.
- Confirm no tracked file or built browser asset contains a service secret.
- Confirm `workers.dev` and version preview URLs remain disabled in production configuration.

## Security and privacy

- Verify anonymous users cannot read profile, family, plan, favorite, rating, admin, or billing data.
- Verify owner A cannot read, update, or delete owner B’s records.
- Verify paid APIs reject signed-out and non-entitled accounts.
- Verify cross-site mutations are rejected and session cookies remain Secure, HTTP-only, and SameSite.
- Verify sign-in responses do not disclose whether an email address has an account.
- Verify rate limits return a clear retry message for sign-in, public forms, recipe search/import, reader creation, and store/location lookup.
- Verify recipe-reader links are noindex, expire, and stop working after revocation.
- Verify account deletion cancels an active Stripe subscription before data removal, clears the session, and protects the last administrator.
- Review Cloudflare WAF rate-limit and bot settings. Keep AI crawler blocking enabled for authenticated/private paths and allow public marketing/privacy pages to be indexed.
- Review Workers Logs for unexpected personal data. Never log request bodies, authorization values, session cookies, email addresses, exact locations, or allergy lists.

## Performance and speed

- Confirm the release guard’s JavaScript and CSS budgets pass.
- Compare the homepage, recipe catalog, grocery review, delivery, account, and privacy routes on a throttled mobile connection.
- Check Core Web Vitals and network waterfalls on the preview or local production build.
- Flag new blocking requests, duplicate API calls, oversized images, layout shifts, and main-thread tasks over 50 ms.

## Workflows and edge cases

- Complete the core journey: sign in, plan, select recipes, confirm ingredients, approve shopping list, choose recipients, and send/save.
- Check loading, empty, success, validation, offline/service-error, rate-limit, canceled billing, and expired-session states.
- Check month-length plans, zero-child school-lunch behavior, duplicate ingredients, missing quantities, no nearby stores, provider exhaustion, and revoked/expired recipe links.
- Verify every visible control has a result, recovery path, or clear explanation; no dead ends or dead interactions may ship.
- Complete the accessibility and usability release checklist.

## Production verification

- Obtain explicit owner confirmation before publishing.
- Apply D1 migrations before the Worker deployment.
- Verify `https://grocer-eaze.com`, `/privacy`, `/robots.txt`, `/sitemap.xml`, and `/api/health` after deployment.
- Verify the alternate `workers.dev` and version-preview URLs are unavailable.
- Verify Stripe checkout, portal, webhook delivery, entitlement gates, and complimentary admin access without exposing secrets.
