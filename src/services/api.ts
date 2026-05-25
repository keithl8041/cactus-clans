/**
 * Thin wrapper for the Worker API at /api/*. When the app is served by the
 * Cactus Clans Worker, these requests hit the D1-backed routes in
 * `worker/index.ts`. In `vite dev` there is no Worker, so the services in
 * this folder transparently fall back to localStorage instead.
 */
export const usingRealBackend = !import.meta.env.DEV;

const API_BASE = '/api';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `API ${path} failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // not JSON — leave the default message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
