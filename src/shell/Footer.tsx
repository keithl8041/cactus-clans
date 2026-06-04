import { useLocation } from 'react-router-dom';

export function Footer() {
  const { pathname } = useLocation();
  const showCredit = pathname === '/leaderboard';
  if (!showCredit) return null;
  return (
    <footer className="app-footer">
      {showCredit && (
        <>
          made with <span aria-hidden="true">❤️</span>{' '}
          <span className="visually-hidden">love </span>
          by Sonny, Leo & Felix with help from their siblings Toby, Jasper & Jessie.
          {showPayhipLink && <br />}
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
