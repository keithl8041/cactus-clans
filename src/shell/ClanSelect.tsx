import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLANS } from '../data/clans';
import { cardsForClan } from '../data/cards';
import { assetUrl, resolveCardKey } from '../assets/manifest';
import { useGameStore } from '../store/gameStore';
import { startRun } from '../services/progress';
import { consumeReturnTo } from './postAuthReturn';

export function ClanSelect() {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const setRun = useGameStore((s) => s.setRun);

  useEffect(() => {
    if (!player) {
      navigate('/nickname');
      return;
    }
    // If we landed here only because the user has no active run but they
    // were actually trying to reach somewhere else (e.g. /versus/<code>),
    // honor that intent — versus mode doesn't need a clan-tied run.
    const returnTo = consumeReturnTo();
    if (returnTo) navigate(returnTo, { replace: true });
  }, [player, navigate]);

  async function confirm() {
    if (!player || !selected) return;
    setBusy(true);
    try {
      const run = await startRun(player.id, selected);
      setRun(run);
      navigate('/journey');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Choose your clan</h1>
      <h2>You'll start at form 1 — the youngest sprout</h2>
      <div className="card-grid">
        {CLANS.map((clan) => {
          const form1 = cardsForClan(clan.name)[0];
          const url = assetUrl(resolveCardKey(clan.name, 1), {
            clanName: clan.name,
            color: clan.color,
            formName: form1?.name ?? 'Form 1',
            formNumber: 1,
          });
          const selectable = clan.name === 'Prickling Clan';
          return (
            <div
              key={clan.name}
              className={`card-tile${selected === clan.name ? ' selected' : ''}`}
              onClick={selectable ? () => setSelected(clan.name) : undefined}
            >
              <img src={url} alt={clan.name} />
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                {clan.tagline}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button onClick={() => navigate('/', { state: { pickPlayer: true } })}>Back</button>
        <button className="primary" disabled={!selected || busy} onClick={confirm}>
          {busy ? 'Starting…' : selected ? `Begin as ${selected}` : 'Pick a clan'}
        </button>
      </div>
    </div>
  );
}
