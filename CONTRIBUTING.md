# Contributing to Cactus Clans

Hello! 👋 This project is open for people to learn from and tinker with —
whether you're a kid poking at your first bit of code or a grown-up adding a
feature. This page explains how to make a change and send it back.

## The short version

1. **Fork** the repo on GitHub (button in the top-right).
2. Clone your fork and install:
   ```bash
   npm install
   npm run dev        # opens http://localhost:5173
   ```
   The dev server runs without the Cloudflare backend — it falls back to your
   browser's localStorage, so everything works offline.
3. Make your change on a branch.
4. Before you push, run the checks:
   ```bash
   npm run typecheck  # strict TypeScript — this MUST pass
   ```
   There's no automated test suite, so `typecheck` is our main safety net.
5. Push to your fork and open a **Pull Request against the `main` branch**.

When you open the PR, GitHub automatically runs the same `typecheck` + `build`
checks (see `.github/workflows/ci.yml`). They have to be green before a PR can
be merged.

## Good first changes

- Tweak a colour, some copy, or a clan.
- Swap a placeholder drawing for real art (see the README's
  "Swapping a placeholder for real art" section — it's a one-line change).
- Add a whole new mini-game level (the README's "Adding a new level" recipe
  walks through it).

## How deploys work (why your merge won't break the live game)

Merging a PR into `main` does **not** put it on the live site. The maintainer
(Keith) promotes `main` to a separate `release` branch when it's ready to ship,
and only that branch deploys. So you can contribute freely without worrying
about pushing something live by accident — and only the maintainer can deploy.

## A few house rules

- **Don't commit secrets** — no API tokens, passwords, or `.env` files.
- **Call out new dependencies** in your PR description. Anything added here runs
  in the deploy pipeline later, so new packages and `package-lock.json` changes
  get a closer look.
- **Keep it kind.** This started as a family project. Be friendly in issues and
  reviews.

## Licence

By contributing, you agree your contribution is licensed under the project's
[PolyForm Noncommercial 1.0.0](LICENSE) licence — free to learn from, copy, and
build on for non-commercial purposes.
