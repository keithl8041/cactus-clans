import { apiFetch, usingRealBackend } from './api';

const STORAGE_KEY = 'cc.session.v1';

export interface PlayerSession {
  id: string;
  nickname: string;
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

export function getCurrentSession(): PlayerSession | null {
  const s = readStored();
  return s ? { id: s.id, nickname: s.nickname } : null;
}

export async function signInWithNickname(nickname: string): Promise<PlayerSession> {
  const cleaned = nickname.trim();
  if (!cleaned) throw new Error('Nickname cannot be empty');
  if (cleaned.length > 24) throw new Error('Nickname is too long (max 24)');

  if (usingRealBackend) {
    const row = await apiFetch<PlayerSession>('/players', {
      method: 'POST',
      body: JSON.stringify({ nickname: cleaned }),
    });
    const session: StoredSession = {
      id: row.id,
      nickname: row.nickname,
      createdAt: new Date().toISOString(),
    };
    writeStored(session);
    return { id: session.id, nickname: session.nickname };
  }

  // Mock backend: generate a stable id from the nickname.
  const id = `mock-${cleaned.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const session: StoredSession = { id, nickname: cleaned, createdAt: new Date().toISOString() };
  writeStored(session);
  return { id, nickname: cleaned };
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}
