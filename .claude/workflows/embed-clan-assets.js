export const meta = {
  name: 'embed-clan-assets',
  description: 'Copy _drop/ clan art into public/art, wire manifest.ts, and unlock the clan in ClanSelect',
  whenToUse: 'When new clan art has been unzipped into /_drop/ and needs to be embedded and made playable.',
  phases: [
    { title: 'Scan', detail: 'Read _drop/ to identify the clan and all asset files' },
    { title: 'Apply', detail: 'Copy assets, update manifest.ts and ClanSelect.tsx' },
    { title: 'Verify', detail: 'Run npm run typecheck' },
  ],
}

// ── Phase 1: Scan ────────────────────────────────────────────────────────────
phase('Scan')

const scanResult = await agent(
  `You are working in C:\\Projects\\cactus-clans.

Your job is to inspect the _drop/ directory and the current codebase state, then produce a structured report.

Steps:
1. Run: ls C:/Projects/cactus-clans/_drop/
   List every file there.

2. From the filenames, infer:
   - clanSlug: the short lowercase hyphenated identifier, e.g. "hot-dog" from "hotdog" in the filenames. The file pattern is *-<clanslug>-clan-form*.png or *-<clanslug>-clan.png.
   - clanName: the full display name as it appears in src/data/clans.ts, e.g. "Hot Dog Clan".
   - balloonFile: the filename containing "balloon" (or null if missing)
   - camelFile: the filename containing "camel" (or null if missing)
   - cardFiles: array of {form: number, filename: string} for each card-*-clan-form*.png
   - characterFiles: array of {form: number, filename: string} for each character file (non-card, non-balloon, non-camel)

3. Read src/assets/manifest.ts and check which of these keys ALREADY exist (so we skip adding them):
   - balloon.<clanSlug>
   - camel.<clanSlug>
   - card.<clanSlug>.1 through .8
   - character.<clanSlug>.1 through .8

4. Read src/shell/ClanSelect.tsx line ~54 and check if the clan name is already in the selectable list.

5. Check if public/art/menu/card-<clanslug>-clan-form1.png exists (run: ls C:/Projects/cactus-clans/public/art/menu/).

Return a JSON object with exactly this shape:
{
  "clanSlug": "hot-dog",
  "clanName": "Hot Dog Clan",
  "filenamePart": "hotdog",
  "balloon": { "filename": "balloon-hotdog-clan.png", "alreadyInManifest": false },
  "camel": { "filename": "camel-hotdog-clan.png", "alreadyInManifest": false },
  "cards": [
    { "form": 1, "filename": "card-hotdog-clan-form1.png", "alreadyInManifest": true },
    { "form": 2, "filename": "card-hotdog-clan-form2.png", "alreadyInManifest": false }
  ],
  "characters": [
    { "form": 1, "filename": "diggidgy-dog-hotdog-clan-form1.png", "alreadyInManifest": false }
  ],
  "alreadySelectable": false,
  "menuCardExists": true
}`,
  {
    label: 'scan _drop/',
    phase: 'Scan',
    schema: {
      type: 'object',
      required: ['clanSlug', 'clanName', 'filenamePart', 'balloon', 'camel', 'cards', 'characters', 'alreadySelectable', 'menuCardExists'],
      properties: {
        clanSlug: { type: 'string' },
        clanName: { type: 'string' },
        filenamePart: { type: 'string' },
        balloon: {
          type: 'object',
          properties: {
            filename: { type: ['string', 'null'] },
            alreadyInManifest: { type: 'boolean' },
          },
          required: ['filename', 'alreadyInManifest'],
        },
        camel: {
          type: 'object',
          properties: {
            filename: { type: ['string', 'null'] },
            alreadyInManifest: { type: 'boolean' },
          },
          required: ['filename', 'alreadyInManifest'],
        },
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              form: { type: 'number' },
              filename: { type: 'string' },
              alreadyInManifest: { type: 'boolean' },
            },
            required: ['form', 'filename', 'alreadyInManifest'],
          },
        },
        characters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              form: { type: 'number' },
              filename: { type: 'string' },
              alreadyInManifest: { type: 'boolean' },
            },
            required: ['form', 'filename', 'alreadyInManifest'],
          },
        },
        alreadySelectable: { type: 'boolean' },
        menuCardExists: { type: 'boolean' },
      },
    },
  }
)

log(`Clan detected: ${scanResult.clanName} (slug: ${scanResult.clanSlug})`)

const newCards = scanResult.cards.filter(c => !c.alreadyInManifest)
const newChars = scanResult.characters.filter(c => !c.alreadyInManifest)
log(`New manifest entries needed: balloon=${!scanResult.balloon.alreadyInManifest}, camel=${!scanResult.camel.alreadyInManifest}, cards=${newCards.length}, characters=${newChars.length}`)

// ── Phase 2: Apply ───────────────────────────────────────────────────────────
phase('Apply')

// Build the full context string for the apply agent
const manifestNewEntries = []

if (scanResult.balloon.filename && !scanResult.balloon.alreadyInManifest) {
  manifestNewEntries.push({
    group: 'balloon',
    key: `'balloon.${scanResult.clanSlug}'`,
    value: `{ kind: 'image', src: '/art/${scanResult.balloon.filename}' }`,
    insertAfterPattern: `'balloon.tropica'`,
  })
}

if (scanResult.camel.filename && !scanResult.camel.alreadyInManifest) {
  manifestNewEntries.push({
    group: 'camel',
    key: `'camel.${scanResult.clanSlug}'`,
    value: `{ kind: 'image', src: '/art/${scanResult.camel.filename}' }`,
    insertAfterPattern: `'camel.tropica'`,
  })
}

const applyPrompt = `You are working in C:\\Projects\\cactus-clans. Execute ALL of the following steps precisely.

CLAN: ${scanResult.clanName} (slug: ${scanResult.clanSlug})

## Step 1: Copy asset files from _drop/ to public/art/

Run PowerShell copy commands for each file that does NOT yet exist in public/art/:

Files to copy (skip any already in public/art/):
${[
  scanResult.balloon.filename,
  scanResult.camel.filename,
  ...scanResult.cards.map(c => c.filename),
  ...scanResult.characters.map(c => c.filename),
].filter(Boolean).map(f => `  cp C:/Projects/cactus-clans/_drop/${f} C:/Projects/cactus-clans/public/art/${f}`).join('\n')}

${scanResult.menuCardExists
  ? '(art/menu/ card already exists — skip)'
  : scanResult.cards.find(c => c.form === 1)
    ? `REQUIRED — also copy form-1 card to the menu directory (used by ClanSelect and LandingPage via resolveLandingCardKey):
  cp "C:/Projects/cactus-clans/_drop/${scanResult.cards.find(c => c.form === 1).filename}" "C:/Projects/cactus-clans/public/art/menu/${scanResult.cards.find(c => c.form === 1).filename.replace('card-', 'card-')}"
  (destination filename should match what manifest.ts has for landing-card.${scanResult.clanSlug}.1 — check the manifest if unsure)`
    : 'WARNING: no form-1 card found in _drop/ — art/menu/ card cannot be copied. The landing display for this clan will fall back to the SVG placeholder.'
}

## Step 2: Update src/assets/manifest.ts

Read the file first, then make these edits using the Edit tool:

${!scanResult.balloon.alreadyInManifest && scanResult.balloon.filename ? `ADD after the line containing "'balloon.tropica'":
  'balloon.${scanResult.clanSlug}': { kind: 'image', src: '/art/${scanResult.balloon.filename}' },` : ''}

${!scanResult.camel.alreadyInManifest && scanResult.camel.filename ? `ADD after the line containing "'camel.tropica'":
  'camel.${scanResult.clanSlug}': { kind: 'image', src: '/art/${scanResult.camel.filename}' },` : ''}

${newCards.length > 0 ? `ADD these card entries after the existing 'card.${scanResult.clanSlug}.1' line (or after another card block if .1 doesn't exist yet):
${newCards.map(c => `  'card.${scanResult.clanSlug}.${c.form}': { kind: 'image', src: '/art/${c.filename}' },`).join('\n')}` : '(all card entries already present)'}

${newChars.length > 0 ? `ADD these character entries immediately before the 'character.tropica.1' line:
${newChars.map(c => `  'character.${scanResult.clanSlug}.${c.form}': { kind: 'image', src: '/art/${c.filename}' },`).join('\n')}` : '(all character entries already present)'}

## Step 3: Update src/shell/ClanSelect.tsx

${scanResult.alreadySelectable ? '(clan is already selectable — skip)' : `Find the line that reads:
  const selectable = clan.name === 'Prickling Clan' || ...

Add  || clan.name === '${scanResult.clanName}'  to the end of that boolean expression.`}

Report "done" when all steps are complete, or describe any file that was skipped and why.`

await agent(applyPrompt, { label: 'copy + patch files', phase: 'Apply' })

// ── Phase 3: Verify ──────────────────────────────────────────────────────────
phase('Verify')

const verifyResult = await agent(
  `Run the TypeScript type-checker for the cactus-clans project and report the result.

  Command (PowerShell): cd C:\\Projects\\cactus-clans; npm run typecheck 2>&1

  If it exits with code 0 and no errors, report success.
  If there are type errors, list them verbatim.`,
  { label: 'npm run typecheck', phase: 'Verify' }
)

log(verifyResult)

return {
  clan: scanResult.clanName,
  slug: scanResult.clanSlug,
  assetsAdded: [
    scanResult.balloon.filename,
    scanResult.camel.filename,
    ...scanResult.cards.map(c => c.filename),
    ...scanResult.characters.map(c => c.filename),
  ].filter(Boolean).length,
  verify: verifyResult,
}
