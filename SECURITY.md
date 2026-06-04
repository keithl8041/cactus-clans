# Security Policy

## Reporting a vulnerability

If you find a genuine security issue, please report it privately rather than
opening a public issue. Email **keith.lawrence@gmail.com** with the details and
steps to reproduce. I'll do my best to respond promptly.

## Things that are *not* vulnerabilities here

Cactus Clans is a family game, and a couple of behaviours are intentional
trade-offs — please don't report these as security bugs:

- **Scores are not verified.** The backend accepts whatever score the client
  posts; there is no signed write and no real authentication. "Sign in" is just
  a nickname. Kids can spoof scores from the browser devtools, and that's fine
  for this project.
- **The `database_id` in `wrangler.jsonc` is public.** It's an identifier, not a
  secret — it does nothing without the Cloudflare account credentials, which are
  never committed.

## How deploys are protected

Production is deployed by Cloudflare Workers Builds from the protected `release`
branch only, using a scoped, least-privilege API token held in Cloudflare.
Pull requests (including from forks) run a sandboxed CI workflow that has no
secrets and cannot deploy.
