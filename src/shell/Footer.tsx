import { Link, useLocation } from 'react-router-dom';

export function Footer() {
  const { pathname } = useLocation();
  const showCredit = pathname === '/leaderboard';
  // The landing page (/) and the splash (/game) both carry their own card CTA,
  // and the shop page IS the card set — so don't show the footer link there.
  const showPayhipLink = pathname !== '/' && pathname !== '/game' && pathname !== '/shop';
  if (!showCredit && !showPayhipLink) return null;
  return (
    <footer className="app-footer">
      {showCredit && (
        <>
          made with <span aria-hidden="true">❤️</span>{' '}
          <span className="visually-hidden">love </span>
          by Sonny, Leo, Toby, Felix &amp; Jasper
          {showPayhipLink && ' · '}
        </>
      )}
      {showPayhipLink && (
        <Link className="footer-link" to="/shop">
          Get the printable card set
        </Link>
      )}
    </footer>
  );
}
