# Grocer-Eaze

Grocer-Eaze is a family-aware meal planner that turns recipe selections into a scheduled plan and organized grocery list.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run quality
```

The release-quality workflow runs for every pull request and every update to `main`. It checks:

- production build and code quality
- Grocer-Eaze product foundations
- WCAG accessibility rules
- keyboard and skip-link behavior
- primary navigation and actionable empty states
- progressive recipe loading and filters
- 400% zoom-equivalent reflow
- WCAG 2.2 minimum interactive target sizes

Major interaction or layout changes should also complete the [manual accessibility and usability release checklist](docs/accessibility-usability-release-checklist.md), including VoiceOver/Safari and NVDA/Chrome journeys.

## Hosting

The production application runs on Cloudflare Workers with D1-backed account data and deploys from GitHub Actions. The original OpenAI Sites project identifier remains in `.openai/hosting.json` as recovery history and must not be duplicated.

Hosted service credentials are configured as server-side Worker secrets. The shopping handoff uses `INSTACART_API_KEY`; the interface exposes it only after Instacart approves a production key and the secret is configured. DoorDash and Uber Eats consumer-cart handoffs remain deferred until those providers offer or approve suitable consumer integrations.

Product research and deferred integrations are tracked in [`docs/product-backlog.md`](docs/product-backlog.md).
