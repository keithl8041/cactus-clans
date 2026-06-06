import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLANS } from '../data/clans';
import { cardsForClan } from '../data/cards';
import { assetUrl, resolveCardKey } from '../assets/manifest';

// The creators' intro — the first thing a web visitor sees at `/`. It tells the
// origin story of the game (who made it, how, and why) and showcases the cards,
// then offers the two choices: get the printable set (/shop) or play the game (/game).
// NOTE: do NOT import from `phaser` or `src/levels/registry.ts` here — this page
// is eagerly loaded, and pulling Phaser in would bloat the main bundle.

// The origin-story sections are collapsed into a single tabbed panel to keep the
// page from getting too tall. Add/edit copy here — order drives the tab order.
const STORY_TABS = [
  {
    id: 'how-it-started',
    label: 'How it started',
    body: (
      <>
        <p>
          Cactus Clans began at <strong>Ms Pippa's Young CEOs Club</strong>, where Sonny and Leo got
          talking and dreamed up the idea of their very own set of trading cards. They were soon joined
          by Felix, and over the school break the three of them threw themselves into the project with
          remarkable energy and focus.
        </p>
        <p>
          Starting from their own ideas, drawings and characters, they worked feverishly to invent the
          clans — every creature, name and trait. What began as sketches in a club has grown into a full
          set of trading cards, a digital download, and a website with eight mini-games.
        </p>
        <p>
          A huge shout-out to Ms Pippa and her Young CEOs Club for sparking it all. You'll be able to meet
          the team at the <strong><a href="https://www.fojkps.org/events/2026/6/13/jkps-summer-festical" target="_blank" rel="noopener noreferrer">JKPS Summer Festival</a></strong>, where they'll have a stall to showcase
          and sell their creations — please do go along and support them!
        </p>
      </>
    ),
  },
  {
    id: 'who-made-it',
    label: 'Who made it',
    body: (
      <>
        <figure className="team-photo">
          <img src="/the-team.jpeg" alt="The Cactus Clans team" />
          <figcaption>The Cactus Clans team</figcaption>
        </figure>
        <p>
          Cactus Clans was built by <strong>Sonny, Leo &amp; Felix</strong> — a group of school friends —
          with brilliant support from their families.
        </p>
        <p>
          Sonny and Leo led on character design, artwork and card production, with Sonny's mum creating
          the amazing artwork for every card and game asset. Felix collaborated to use AI to build the
          online game, and together with his brother Jasper and their dad, coded the website and its eight
          mini-games — all based on ideas from the whole group.
        </p>
        <p>
          And it wouldn't have happened without their siblings <strong>Toby, Jasper &amp; Jessie</strong>,
          who played a key role as dedicated testers. It's a fantastic example of creativity, teamwork and
          entrepreneurial spirit in action.
        </p>
      </>
    ),
  },
  {
    id: 'build-it-yourself',
    label: 'Build it yourself',
    body: (
      <>
        <p>
          Cactus Clans is <strong>open</strong> — that means the whole project, every line of
          code and every drawing, is published for anyone to read, copy and change. There's no secret recipe: you can see
          exactly how it works and make it your own.
        </p>
        <p>
          It's a brilliant way to learn. Grab a kid, open the code together, and tinker — add a new
          clan, change a colour, invent a new mini-game, or just poke around to see what happens. You
          can't break anything that can't be undone.
        </p>
        <p>
          <a
            className="button-link"
            href="https://github.com/keithl8041/cactus-clans"
            target="_blank"
            rel="noopener noreferrer"
          >
            View the code on GitHub →
          </a>
        </p>
      </>
    ),
  },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof STORY_TABS)[number]['id']>(STORY_TABS[0].id);
  const active = STORY_TABS.find((t) => t.id === activeTab) ?? STORY_TABS[0];

  return (
    <div className="landing">
      {/* Hero */}
      <header className="landing-hero">
        <img src="/logo.png" alt="Cactus Clans" className="logo" />
        <p className="landing-tagline">An adventure through the prickly wilds</p>
        <div className="row">
          <Link className="button-link" to="/shop">
            Get the printable card set →
          </Link>
          <button className="primary" onClick={() => navigate('/game')}>
            Play the game
          </button>
        </div>
      </header>

      {/* Origin story — collapsed into a tabbed panel to cut down on vertical scroll */}
      <section className="landing-section landing-story">
        <div className="story-tabs" role="tablist" aria-label="Our story">
          {STORY_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={tab.id === activeTab}
              aria-controls={`panel-${tab.id}`}
              className={`story-tab${tab.id === activeTab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          className="story-panel"
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
        >
          <h2>{active.label}</h2>
          {active.body}
        </div>
      </section>

      {/* Card showcase — form-1 art for every clan. Presentational only. */}
      <section className="landing-section">
        <h2>Meet the clans</h2>
        <p className="landing-section-sub">Ten clans, eighty cards. The collection speaks for itself.</p>
        <div className="card-grid card-grid--showcase">
          {CLANS.map((clan) => {
            const form1 = cardsForClan(clan.name)[0];
            const url = assetUrl(resolveCardKey(clan.name, 1), {
              clanName: clan.name,
              color: clan.color,
              formName: form1?.name ?? 'Form 1',
              formNumber: 1,
            });
            return (
              <figure key={clan.name} className="card-tile card-tile--showcase">
                <img src={url} alt={`${clan.name} card`} />
                <figcaption style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  {clan.tagline}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="landing-cta-band">
        <h2>Ready?</h2>
        <div className="row">
          <Link className="button-link" to="/shop">
            Get the printable card set →
          </Link>
          <button className="primary" onClick={() => navigate('/game')}>
            Play the game
          </button>
        </div>
      </section>
    </div>
  );
}
