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

No lists of framework, tool or editor names: the store rejected v1.0.0 for "excessive keywords" over one.

```
Your new tab, turned into a list of every project you've run on localhost.

If you start lots of side projects and prototypes, you forget which one runs on which port and where its folder is. This extension remembers them for you.

• See every local project, running or not, with a live preview
• Start and stop dev servers from the new tab
• Open a project's folder, code editor or terminal in one click
• Search, pin, grid or list view, light and dark mode

Needs macOS, Node.js 18+ and a small helper you install once. The new tab shows the exact command.

Private by design: everything stays on your computer. No server, no analytics, no account.

Open source: https://github.com/arcadie2k/localhost-new-tab
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
• Pornești și oprești serverele direct din tabul nou (folosește scriptul dev al proiectului)
• Deschizi proiectul în Finder, editorul de cod sau terminal dintr-un click
• API-urile, agenții care rulează în fundal și bundler-ele Expo / React Native sunt recunoscute automat și apar separat, ca servicii compacte
• Istoric de porturi: dacă două proiecte au folosit același port, ambele rămân în listă, iar la pornire primești opțiunea să-l oprești pe celălalt
• Căutare instant după nume, folder, framework sau port (apasă / pentru căutare)
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
| Screenshot 1 | `screenshot-1-overview-dark.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-bookmarks-dark.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-list-light.png` | 1280×800 |
| Screenshot 4 | `screenshot-4-editor-light.png` | 1280×800 |
| Screenshot 5 | `screenshot-5-ports-dark.png` | 1280×800 |
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
Replaces the new tab page with a developer dashboard: the local development servers (localhost projects) the user has run, with controls to start, stop and open them, plus optional quick access to the user's most visited sites and bookmarks.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `nativeMessaging` | Talks to the companion helper on the user's own machine, which lists listening localhost ports, maps them to project folders and starts or stops dev servers on request. The browser cannot read local processes any other way. The helper's source ships inside the extension package (`helper/host.js`); when the installed helper is an older version, the extension hands it that bundled file, checksum verified and test-started before it replaces the old one, so the helper always matches the reviewed version. No code is downloaded at runtime. |
| `alarms` | Runs a lightweight port check once a minute so dev servers that run briefly are still recorded in the project history. |
| `storage` | Stores page preview thumbnails and favicons of the user's localhost projects locally so the new tab shows them instantly. |
| `unlimitedStorage` | Thumbnails are images. Without this, a user with many projects would hit the default local storage quota and lose previews. Data never leaves the device. |
| Host permission `http://localhost/*`, `http://127.0.0.1/*` | Captures a preview of localhost tabs the user visits and reads their favicon. Limited to local development servers; the extension has no access to any other site. |
| `favicon` | Shows site icons next to most visited sites and bookmarks. Icons come from Chrome's local favicon cache. |
| `topSites` (optional) | Only requested when the user turns on Most Visited in settings. Shows their most visited sites on the new tab. Read only, nothing leaves the device. |
| `bookmarks` (optional) | Only requested when the user turns on Bookmarks in settings. Lets them browse, open, rename, move and delete their own bookmarks from the new tab. Nothing leaves the device. |

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
