# Cloudflare recovery runbook

This recovery keeps GitHub as the source of truth and deploys the validated
production release to Cloudflare Workers. The existing ChatGPT Sites project
metadata remains in `.openai/hosting.json` so the original project can still be
recovered later without losing its identity.

## Release boundaries

1. Deploy and verify the production baseline before the pending feature batch.
2. Keep the custom domain on the current deployment until the replacement
   `workers.dev` URL passes authentication, catalog, email, and billing checks.
3. Move `grocer-eaze.com` only during the final cutover.

## Private configuration

Store runtime secrets in Cloudflare and never commit them. Required names are
declared in `wrangler.production.jsonc`. `INITIAL_ADMIN_EMAILS` accepts a comma-separated
list and restores those administrator roles when each administrator signs in.

GitHub Actions requires the repository or production environment secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The deployment workflow is
manual-only until the recovery release and custom-domain cutover are verified.

## Recovery sequence

1. Authenticate Wrangler to the correct Cloudflare account.
2. Create or provision the `grocer-eaze-production` D1 database and persist its
   generated identifier in `wrangler.production.jsonc`.
3. Apply all Drizzle migrations to the remote database.
4. Enter the required runtime values privately in Cloudflare.
5. Build, test, and deploy to the generated `workers.dev` address.
6. Verify administrator sign-in, email delivery, recipe sources, recipe images,
   Stripe checkout and portal behavior, and webhook processing.
7. Attach `grocer-eaze.com`, then update Stripe and any provider callback URLs
   that depend on the public origin.
8. Configure the GitHub production environment and run the manual workflow.
9. Enable automatic production deployment only after a successful manual run.
