import { Link, useLocation } from 'react-router-dom';

const GITHUB_REPO_URL = 'https://github.com/keithl8041/cactus-clans';

export function Footer() {
  const { pathname } = useLocation();
  // The landing page (/) and the splash (/game) both carry their own card CTA,
  // and the shop page IS the card set — so don't repeat the card link there.
  const showCardLink = pathname !== '/game' && pathname !== '/shop';
  // No point linking to the privacy page from itself.
  const showPrivacyLink = pathname !== '/privacy';
  const showLeaderboard = pathname === '/leaderboard';

  return (
    <footer className="app-footer">
      {showLeaderboard && (
        <p className="footer-credit">
          made with <span aria-hidden="true">❤️</span>{' '}
          <span className="visually-hidden">love </span>
          by Sonny, Leo &amp; Felix with help from their siblings Toby, Jasper &amp; Jessie.
        </p>
      )}
      <nav className="footer-links" aria-label="More about Cactus Clans">
        {showCardLink && (
          <Link className="footer-link" to="/shop">
            Get the printable card set
          </Link>
        )}
        <a
          className="footer-link"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
        >
          Get the code
        </a>
        {showPrivacyLink && (
          <Link className="footer-link" to="/privacy">
            Privacy policy
          </Link>
        )}
      </nav>
    </footer>
  );
}
