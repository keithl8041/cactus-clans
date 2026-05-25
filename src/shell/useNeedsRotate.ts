import { useEffect, useState } from 'react';

export function useNeedsRotate(maxWidthPx = 700): boolean {
  const [needs, setNeeds] = useState(false);

  useEffect(() => {
    const portrait = window.matchMedia('(orientation: portrait)');
    const compute = () => setNeeds(portrait.matches && window.innerWidth < maxWidthPx);
    compute();
    portrait.addEventListener('change', compute);
    window.addEventListener('resize', compute);
    return () => {
      portrait.removeEventListener('change', compute);
      window.removeEventListener('resize', compute);
    };
  }, [maxWidthPx]);

  return needs;
}
