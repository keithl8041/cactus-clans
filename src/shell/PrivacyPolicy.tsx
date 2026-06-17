import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from './useSeoMeta';

export function PrivacyPolicy() {
  const navigate = useNavigate();

  useSeoMeta({
    title: 'Privacy Policy',
    description:
      'Cactus Clans is a family game. We collect no personal data — just an anonymous nickname and PIN so you can save your progress.',
    path: '/privacy',
  });

  return (
    <div className="screen privacy-page">
      <h1>Privacy Policy</h1>
      <p className="privacy-sub">
        Cactus Clans is a family game. We keep things simple and we keep your data to a minimum.
      </p>

      <div className="privacy-body">
        <h2>What we don't collect</h2>
        <p>
          We don't ask for or store personal data — no email addresses, no real names, no
          phone numbers, nothing that identifies you in the real world.
        </p>

        <h2>What we do store</h2>
        <p>
          To save your progress and show you on the leaderboard, we store just two things:
        </p>
        <ul>
          <li>
            <strong>Your nickname</strong> — the name you choose to play under.
          </li>
          <li>
            <strong>Your PIN</strong> — so only you can pick your nickname back up next time.
          </li>
        </ul>
        <p>Pick a nickname that doesn't reveal who you are, and you stay anonymous.</p>

        <h2>Analytics</h2>
        <p>
          We log some basic, anonymous telemetry — things like which levels get played and
          how often — purely so we can see how the game is being used and make it better. This
          data isn't tied to you personally and we don't use it to track or identify players.
        </p>

        <h2>That's it</h2>
        <p>
          No ads, no third-party trackers selling your data, no surprises. If you ever have a
          question, the project is open source — you're welcome to read exactly how it works.
        </p>
      </div>

      <div className="row">
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
    </div>
  );
}
