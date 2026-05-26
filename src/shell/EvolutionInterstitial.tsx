import { useEffect, useState } from 'react';
import { assetUrl } from '../assets/manifest';
import { cardFor } from '../data/cards';

interface Props {
  clanName: string;
  clanColor: string;
  fromForm: number;
  toForm: number;
  onContinue: () => void;
}

export function EvolutionInterstitial({ clanName, clanColor, fromForm, toForm, onContinue }: Props) {
  const [phase, setPhase] = useState<'from' | 'to'>('from');

  useEffect(() => {
    const t = setTimeout(() => setPhase('to'), 1100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      onContinue();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  const fromUrl = assetUrl('character', { clanColor, formNumber: fromForm, size: 240 });
  const toUrl = assetUrl('character', { clanColor, formNumber: toForm, size: 240 });
  const fromCard = cardFor(clanName, fromForm);
  const toCard = cardFor(clanName, toForm);

  return (
    <div className="evolution-overlay">
      <h1>Evolving…</h1>
      <div className="evolution-stage">
        <img src={fromUrl} className={`evolution-img ${phase === 'from' ? 'in' : 'out'}`} alt={`Form ${fromForm}`} />
        <img src={toUrl} className={`evolution-img ${phase === 'to' ? 'in' : 'out'}`} alt={`Form ${toForm}`} />
      </div>
      <h2>
        <span className={phase === 'from' ? 'evolution-name in' : 'evolution-name out'}>
          {fromCard?.name ?? `Form ${fromForm}`}
        </span>
        <span className="evolution-arrow"> → </span>
        <span className={phase === 'to' ? 'evolution-name in' : 'evolution-name out'}>
          {toCard?.name ?? `Form ${toForm}`}
        </span>
      </h2>
      <button className="primary" onClick={onContinue} autoFocus>
        Continue (Enter)
      </button>
    </div>
  );
}
