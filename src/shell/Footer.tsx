import { useLocation } from 'react-router-dom';

export function Footer() {
  const { pathname } = useLocation();
  const showCredit = pathname === '/leaderboard';
  if (!showCredit) return null;
  return (
    <footer className="app-footer">
      made with <span aria-hidden="true">❤️</span>{' '}
      <span className="visually-hidden">love </span>
      by Sonny, Leo, Toby, Felix &amp; Jasper
    </footer>
  );
}
