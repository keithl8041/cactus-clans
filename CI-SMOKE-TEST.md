# CI smoke test

Throwaway file to verify that opening a PR against `main`:

1. Runs the `ci` check (typecheck + build), and
2. Does **not** trigger a Cloudflare deploy (only pushes to `release` should).

Safe to delete this file and close the PR once confirmed.
