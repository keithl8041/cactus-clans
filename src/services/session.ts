import { apiFetch, usingRealBackend } from './api';

const STORAGE_KEY = 'cc.session.v1';
const ROSTER_KEY = 'cc.players.v1';

export interface PlayerSession {
  id: string;
  nickname: string;
}

export interface KnownPlayer {
  id: string;
  nickname: string;
  lastUsedAt: string;
}

interface StoredSession extends PlayerSession {
  createdAt: string;
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStored(s: StoredSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function readRoster(): KnownPlayer[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    return raw ? (JSON.parse(raw) as KnownPlayer[]) : [];
  } catch {
    return [];
  }
}

function writeRoster(list: KnownPlayer[]): void {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
}

function upsertRoster(player: KnownPlayer): void {
  const list = readRoster().filter((p) => p.id !== player.id);
  list.push(player);
  writeRoster(list);
}

export function getCurrentSession(): PlayerSession | null {
  const s = readStored();
  return s ? { id: s.id, nickname: s.nickname } : null;
}

/**
 * Returns every player known on this device, most-recently-used first.
 * Backfills the roster from the existing active session for users who
 * already had `cc.session.v1` before multi-player support landed.
 */
export function getKnownPlayers(): KnownPlayer[] {
  const list = readRoster();
  if (list.length === 0) {
    const active = readStored();
    if (active) {
      const seeded: KnownPlayer = {
        id: active.id,
        nickname: active.nickname,
        lastUsedAt: active.createdAt,
      };
      writeRoster([seeded]);
      return [seeded];
    }
    return [];
  }
  return [...list].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/** Make `player` the active session and bump them to the top of the roster. */
export function setActivePlayer(player: PlayerSession): void {
  const now = new Date().toISOString();
  writeStored({ id: player.id, nickname: player.nickname, createdAt: now });
  upsertRoster({ id: player.id, nickname: player.nickname, lastUsedAt: now });
}

/** Forget a saved player on this device. Clears the active session if it was them. */
export function removeKnownPlayer(id: string): void {
  writeRoster(readRoster().filter((p) => p.id !== id));
  const active = readStored();
  if (active?.id === id) signOut();
}

export async function signInWithNickname(nickname: string, pin: string): Promise<PlayerSession> {
  const cleaned = nickname.trim();
  if (!cleaned) throw new Error('Nickname cannot be empty');
  if (cleaned.length > 24) throw new Error('Nickname is too long (max 24)');
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');

  let session: PlayerSession;
  if (usingRealBackend) {
    try {
      session = await apiFetch<PlayerSession>('/players', {
        method: 'POST',
        body: JSON.stringify({ nickname: cleaned, pin }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('wrong_pin')) {
        throw new Error("That PIN doesn't match this nickname. Try again, or pick a different nickname.");
      }
      throw err;
    }
  } else {
    // Mock backend (no Worker running): PIN is not enforced, just echo back a
    // stable id. The dual-mode pattern keeps `npm run dev` usable end-to-end.
    const id = `mock-${cleaned.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    session = { id, nickname: cleaned };
  }

  setActivePlayer(session);
  return session;
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}
