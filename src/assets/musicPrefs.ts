const KEY = 'cactus-clans:music';

export function isMusicEnabled(): boolean {
  return localStorage.getItem(KEY) !== 'off';
}

export function setMusicEnabled(v: boolean): void {
  localStorage.setItem(KEY, v ? 'on' : 'off');
}
