# Chrome Web Store listing

Everything the Developer Dashboard asks for, in the order it asks. Copy field by field.

## Package

- Zip: run `./scripts/package.sh`, upload `dist/localhost-new-tab-<version>.zip`
- Version: from `extension/manifest.json`

## Store listing tab

### English (default)

**Title** (from manifest, 39/75)
Localhost New Tab: Dev Server Dashboard

**Summary** (from manifest, 53/132)
Every localhost project you've run, one new tab away.

**Description**

```
Localhost New Tab turns every new tab into a dashboard of the projects you run on localhost.

If you start a lot of side projects, prototypes and client apps, you lose track of them fast: which one is on port 3000, which one is still running, where the folder even is. Localhost New Tab remembers every dev server you have run and shows them as a grid with a live preview of each app.

WHAT YOU GET
• Every local project in one place, running or not, with its folder, framework and ports
• Live page previews so you recognise projects at a glance
• Start and stop dev servers from the new tab (uses your project's own dev script with npm, pnpm, yarn or bun)
• Open a project in Finder, VS Code, Cursor, Zed or your terminal in one click
• APIs, background agents and Expo / React Native bundlers are recognised automatically and shown as compact Services, separate from your web apps
• Port history: if two projects used the same port, both stay listed and you get a clear "stop the other one and start" choice
• Instant filter by name, folder, framework or port (press / to search)
• Works with Next.js, Vite, Expo, Astro, Nuxt, SvelteKit, Remix, Angular, Express, NestJS, Django, Flask and anything else that listens on a localhost port
• Light and dark mode, keyboard friendly, respects reduced motion

HOW IT WORKS
Browsers cannot see local processes, so the extension talks to a small helper that you install once. The helper reads which ports are listening on your machine (via lsof), maps each one to its project folder and starts or stops dev servers when you ask. Chrome launches it only when the new tab needs it. Nothing runs in the background besides a once-a-minute port check.

REQUIREMENTS
• macOS
• Node.js 18 or newer (for the helper)
• One-time helper install: the new tab page shows the exact command after you add the extension

PRIVACY
Everything stays on your computer. The extension has no server, no analytics and no account. Project history lives in a local file in your home folder and previews are stored in Chrome's local extension storage. Removing the extension opens a page with one command that deletes the helper and all its data. The extension can only access http://localhost and http://127.0.0.1 pages.

Made for developers who start more projects than they can remember.
```

**Category**: Developer Tools
**Language**: English

### Romanian (add as a second language)

**Title** (from `_locales/ro`): Localhost New Tab: panou pentru servere de dezvoltare

**Summary** (from `_locales/ro`): Toate proiectele tale de pe localhost, la un tab nou distanță.

**Description**

```
Localhost New Tab transformă fiecare tab nou într-un panou cu proiectele pe care le rulezi pe localhost.

Dacă pornești multe proiecte, prototipuri și aplicații pentru clienți, pierzi repede evidența: care e pe portul 3000, care încă rulează, unde e folderul. Localhost New Tab ține minte fiecare server de dezvoltare pornit și îl arată într-o grilă, cu o previzualizare live a aplicației.

CE PRIMEȘTI
• Toate proiectele locale într-un singur loc, pornite sau nu, cu folder, framework și porturi
• Previzualizări live ale paginilor, ca să recunoști proiectele dintr-o privire
• Pornești și oprești serverele direct din tabul nou (folosește scriptul dev al proiectului, cu npm, pnpm, yarn sau bun)
• Deschizi proiectul în Finder, VS Code, Cursor, Zed sau terminal dintr-un click
• API-urile, agenții care rulează în fundal și bundler-ele Expo / React Native sunt recunoscute automat și apar separat, ca servicii compacte
• Istoric de porturi: dacă două proiecte au folosit același port, ambele rămân în listă, iar la pornire primești opțiunea să-l oprești pe celălalt
• Căutare instant după nume, folder, framework sau port (apasă / pentru căutare)
• Merge cu Next.js, Vite, Expo, Astro, Nuxt, SvelteKit, Remix, Angular, Express, NestJS, Django, Flask și orice altceva ascultă pe un port localhost
• Mod luminos și întunecat, scurtături de tastatură, respectă setarea de mișcare redusă

CUM FUNCȚIONEAZĂ
Browserul nu vede procesele locale, așa că extensia comunică cu un mic utilitar pe care îl instalezi o singură dată. Utilitarul citește porturile deschise (prin lsof), le asociază cu folderul proiectului și pornește sau oprește serverele la cerere. Chrome îl pornește doar când tabul nou are nevoie de el.

CERINȚE
• macOS
• Node.js 18 sau mai nou
• Instalarea utilitarului o singură dată: tabul nou îți arată comanda exactă

CONFIDENȚIALITATE
Totul rămâne pe calculatorul tău. Fără server, fără analytics, fără cont. Extensia poate accesa doar paginile http://localhost și http://127.0.0.1.
```

### Graphics (all in `store/assets`)

| Field | File | Size |
|---|---|---|
| Store icon | `store-icon-128.png` | 128×128, 96px artwork + 16px transparent padding |
| Screenshot 1 | `screenshot-1-overview-light.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-overview-dark.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-actions-light.png` | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |
| Marquee promo tile | `promo-marquee-1400x560.png` | 1400×560 |

Regenerate after UI changes: `node scripts/icons.js && node scripts/store-assets.js`. Screenshots use fictional projects, never real ones.

### Additional fields

- **Official URL**: pick a verified domain in Search Console if you have one (adds the "verified publisher" signal)
- **Homepage URL**: the public repo or landing page. Also add it to `manifest.json` as `"homepage_url"` once it exists
- **Support URL**: the repo's Issues page
- **Mature content**: No

## Privacy practices tab

**Single purpose**

```
Replaces the new tab page with a dashboard of the local development servers (localhost projects) the user has run, with controls to start, stop and open them.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `nativeMessaging` | Talks to the companion helper on the user's own machine, which lists listening localhost ports, maps them to project folders and starts or stops dev servers on request. The browser cannot read local processes any other way. |
| `alarms` | Runs a lightweight port check once a minute so dev servers that run briefly are still recorded in the project history. |
| `storage` | Stores page preview thumbnails and favicons of the user's localhost projects locally so the new tab shows them instantly. |
| `unlimitedStorage` | Thumbnails are images. Without this, a user with many projects would hit the default local storage quota and lose previews. Data never leaves the device. |
| Host permission `http://localhost/*`, `http://127.0.0.1/*` | Captures a preview of localhost tabs the user visits and reads their favicon. Limited to local development servers; the extension has no access to any other site. |

**Remote code**: No, I am not using remote code. All JavaScript is packaged in the extension.

**Data usage**: nothing leaves the device (no server, no analytics, no third parties), so no data type is transmitted or collected off-device. Tick the three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

If the form insists on declaring locally handled data, the honest categories are "Website content" (preview screenshots of localhost pages) and nothing else.

**Privacy policy URL**: host `store/privacy-policy.html` (GitHub Pages, the repo, or any static host) and paste the URL.

## Distribution tab

- Visibility: Public (or Unlisted for a soft launch)
- Regions: All

## Test instructions (for the reviewer)

```
The extension needs its local helper to show projects (Chrome extensions cannot read local processes).
1. On macOS with Node.js 18+, open a new tab after installing. It shows a "Connect the helper" screen with an install command containing this extension's ID.
2. Run that command, reload the tab.
3. Start any dev server (for example `npx serve` in a folder inside your home directory). It appears as a card within a few seconds, with Start/Stop, Finder and editor actions.
```
