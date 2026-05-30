import { useLocation } from 'react-router-dom';

export function Footer() {
  const { pathname } = useLocation();
  const showCredit = pathname === '/leaderboard';
  // Splash already has its own "Like the cards?" CTA — don't duplicate it here.
  const showPayhipLink = pathname !== '/';
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
        <a
          className="footer-link"
          href="https://payhip.com/b/SCwL1"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get the printable card set
        </a>
      )}
    </footer>
  );
}
