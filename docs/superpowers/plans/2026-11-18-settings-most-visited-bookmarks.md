# Settings, Most Visited and Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings popover, a Most Visited chip strip and a Finder-style Bookmarks tab to the Localhost New Tab extension, and fix the list view's tall row controls.

**Architecture:** Split `extension/newtab.js` into ES modules under `extension/js/` loaded by `<script type="module">`. Pure logic (prefs, top sites filtering, bookmark tree math) lives in `extension/js/lib/` with no `chrome`/DOM access at import time, so it runs under `node --test`. UI modules call `chrome.*` and are verified in the demo page (`demo/`, `chrome.*` mocked) through the built-in browser.

**Tech Stack:** Vanilla JS (ES modules), MV3 Chrome APIs (`topSites`, `bookmarks`, `permissions`, `_favicon`), Node 26 `node --test` (ESM detected from syntax, no package.json), CSS in `extension/newtab.css`.

**Spec:** `docs/superpowers/specs/2026-11-18-settings-most-visited-bookmarks-design.md`

## Global Constraints

- No build step, no framework, no npm dependencies.
- `minimum_chrome_version` stays `116`. Manifest `version` becomes `1.1.0`.
- `topSites` and `bookmarks` go in `optional_permissions`; `favicon` goes in `permissions`. Nothing else changes in `permissions`/`host_permissions`.
- `chrome.permissions.request()` must be the first `chrome.*` call in the click handler (no `await` before it), or Chrome rejects it as not a user gesture.
- Turning a feature off never calls `chrome.permissions.remove()`. Every page load checks `chrome.permissions.contains()`; a revoked permission shows the feature as off.
- Most Visited: `chrome.topSites.get()`, drop `localhost`/`127.0.0.1` URLs and locally hidden URLs, take the first 10. Shown only on the Projects tab.
- Every new tab opens on Projects. Active tab and Bookmarks column path are not persisted.
- Theme keeps its `localStorage` key `theme` (values `auto` | `light` | `dark`) so `theme.js` applies it before paint.
- Prefs live in `chrome.storage.local` under `prefs` (existing key, existing `view` and app-choice fields preserved).
- Settings gear shows a pulsing dot until both `topSites` and `bookmarks` are granted; static with `prefers-reduced-motion`.
- Turning off a Projects section hides it; its projects do not move to other sections; headline/lede unchanged.
- Delete bookmark or empty folder: undo toast. Delete non-empty folder: confirm step stating the bookmark count, no undo.
- Settings, Most Visited and Bookmarks work when the native helper is missing (setup screen).
- No code comments unless a non-obvious constraint needs one (Arcadie's rule). No em-dashes in UI copy.
- Store images are out of scope. `scripts/store-assets.js` only needs its demo part working.
- Commits: plain messages, no `Co-Authored-By` or AI attribution lines.

## Review Focus

- **Permission revoked in chrome://extensions while the feature is on:** next load shows it off, toggle off, badge back, no console errors. Test in Task 4.
- **Helper not installed (setup screen):** header still shows gear, tab switch, Most Visited strip; Bookmarks tab usable. Test in Task 3.
- **Open column path's folder deleted elsewhere (other device, Chrome UI):** columns truncate to the deepest folder that still exists, no crash. Test in Task 6.
- **Moving a bookmark down within the same folder:** Chrome's `bookmarks.move` index counts the item's old slot, so a naive index lands one slot too high. Mock copies Chrome's rule in Task 8, then confirmed by Arcadie in real Chrome.
- **`javascript:` bookmarklets and bookmarks with empty titles:** bookmarklets are listed but not openable from the page (extension CSP blocks them), with a tooltip; empty titles fall back to the URL's hostname. Test in Task 6.

---

## File Structure

```
extension/
  newtab.html            modified: header markup, module script tag, settings popover, strip, bookmarks view
  newtab.css             modified: header, strip, settings, columns, list-row squares
  manifest.json          modified: version, permissions, optional_permissions
  js/
    main.js              entry: loads prefs, wires header/tab switch/search, starts projects
    core.js              $, esc, icon, ICONS, toast, faviconURL, shared state for UI
    menu.js              generic popover menu (extracted from showMenu/closeMenu)
    projects.js          everything project-related moved out of newtab.js
    settings.js          settings popover, theme, section toggles, badge
    permissions.js       has/request wrappers
    most-visited.js      chip strip render + hide action
    bookmarks.js         columns view, open, live updates, search, edit actions, drag and drop
    lib/
      prefs.js           pure: normalizePrefs, isSectionOn, needsBadge
      top-sites.js       pure: pickTopSites
      bookmark-tree.js   pure: columnsFor, displayTitle, isBookmarklet, countBookmarks, restoreTree, canDrop
tests/
  prefs.test.js
  top-sites.test.js
  bookmark-tree.test.js
scripts/
  store-assets.js        modified: copy js/ dir, --demo-only flag
  demo/mock.js           modified: topSites, bookmarks, permissions, runtime.getURL stubs
store/listing.md         modified: single purpose, permission justifications
```

`extension/newtab.js` is deleted at the end of Task 1.

Run all unit tests with: `node --test tests/`
Rebuild the demo with: `node scripts/store-assets.js --demo-only`, then preview with the existing `.claude/launch.json` config `demo` (port 4173).

---

### Task 1: Split newtab.js into ES modules (no behaviour change)

**Files:**
- Create: `extension/js/main.js`, `extension/js/core.js`, `extension/js/menu.js`, `extension/js/projects.js`
- Delete: `extension/newtab.js`
- Modify: `extension/newtab.html:82` (script tag), `scripts/store-assets.js:130,140,153,227`, `scripts/demo/mock.js`

**Interfaces:**
- Produces (`core.js`): `export const $`, `export function esc(s)`, `export function icon(name, cls = '')`, `export const ICONS`, `export function toast(msg)`, `export const state` (the existing state object). `main.js` sets `window.toast = toast` because `mock.js` calls `window.toast?.()`.
- Produces (`menu.js`): `export function openPopover(trigger, html, { id, kind, onAction })` and `export function closeMenu(immediate = false)`. `openPopover` positions `#menu` exactly like today's `showMenu`; `onAction(action, el)` is called for clicks on `[data-action]` inside the menu. Today's `showMenu(p, trigger, kind, html)` becomes a thin wrapper in `projects.js` that calls `openPopover` with `id: p.id`.
- Produces (`projects.js`): `export function startProjects()` (initial `refresh()` + listeners), `export function render()`, `export function renderSetup(err)`, `export function matches(p)`.

- [ ] **Step 1: Move code.** Cut `newtab.js` into the four modules by responsibility; keep function bodies unchanged except imports/exports. `main.js` does what the bottom of `newtab.js` does today (load `chrome.storage.local`, set `state.view`, call `startProjects()`), plus theme and view toggle wiring.
- [ ] **Step 2: Load as module.** Replace `<script src="newtab.js"></script>` with `<script type="module" src="js/main.js"></script>`.
- [ ] **Step 3: Update `scripts/store-assets.js`.** Copy `extension/js/` recursively into the demo dir and the temp dirs instead of writing `newtab.js`; the HTML replace targets the new module tag (`mock.js` stays a classic script loaded before it). Add `--demo-only`: when `process.argv.includes('--demo-only')`, skip every `shoot(...)` and image step and only rebuild `demo/`.
- [ ] **Step 4: Rebuild and check the demo.** Run `node scripts/store-assets.js --demo-only`, start preview `demo`, open `http://localhost:4173/`. Expected: same page as before the split. Check: no console errors; start a project (card goes Starting then Running); open the "More actions" menu; switch grid/list; type in search; press `/` to focus search.
- [ ] **Step 5: Commit.** `git add extension scripts && git commit -m "Split new tab script into ES modules"`

### Task 2: Square controls in list view

**Files:**
- Modify: `extension/newtab.css` (block "List view: one bordered table", around lines 431-505)

**Interfaces:** none.

- [ ] **Step 1: Write the check** (run in the browser pane with `javascript_tool` on the demo in list view):

```js
[...document.querySelectorAll('.card.is-row .bar-btn:not(.bar-primary)')].every((b) => {
  const r = b.getBoundingClientRect();
  return Math.abs(r.width - r.height) < 1 && r.height <= 56;
});
```

- [ ] **Step 2: Run it on the current CSS.** Expected: `false` (cells are about 44 wide by 74 tall).
- [ ] **Step 3: Change the CSS.** In list rows: card body padding to `8px 16px` so rows are about 52px; `.card.is-row .card-bar` takes the full row height; `.card.is-row .bar-btn:not(.bar-primary)` gets `aspect-ratio: 1; padding: 0; min-width: 0`. Leave the `max-width: 720px` stacked layout alone.
- [ ] **Step 4: Run the check.** Expected: `true`. Screenshot list view in light and dark.
- [ ] **Step 5: Commit.** `git commit -am "Square row controls in list view"`

### Task 3: Prefs, header, tab switch and Settings popover

**Files:**
- Create: `extension/js/lib/prefs.js`, `extension/js/settings.js`, `tests/prefs.test.js`
- Modify: `extension/newtab.html` (masthead), `extension/newtab.css`, `extension/js/main.js`, `extension/js/projects.js` (`render`, `renderSetup`, `/` shortcut), `scripts/demo/mock.js` (`?nohost`)

**Interfaces:**
- Produces (`lib/prefs.js`):
  - `export const SECTION_IDS = ['pinned', 'running', 'services', 'recent', 'mostVisited', 'bookmarks']`
  - `export function normalizePrefs(raw) -> { view: 'grid'|'list', sections: Record<SectionId, boolean>, hiddenSites: string[], ...rest }`. Defaults: project sections `true`, `mostVisited` and `bookmarks` `false`, `hiddenSites` `[]`, `view` `'grid'`. Unknown keys (editor/terminal app choices) are kept.
  - `export function isSectionOn(prefs, id) -> boolean`
  - `export function needsBadge(granted: { topSites: boolean, bookmarks: boolean }) -> boolean` (true unless both granted)
- Produces (`settings.js`): `export function initSettings({ onChange })`; `onChange(prefs)` fires after any toggle is saved. `export function savePrefs(patch) -> Promise<prefs>` (merges into `state.media.prefs`, writes `chrome.storage.local`).
- Produces (`main.js`): `export function setTab(tab: 'projects'|'bookmarks')`; body attribute `#app[data-tab]`.

- [ ] **Step 1: Write failing tests** in `tests/prefs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrefs, isSectionOn, needsBadge } from '../extension/js/lib/prefs.js';

test('defaults', () => {
  const p = normalizePrefs(undefined);
  assert.equal(p.view, 'grid');
  assert.deepEqual(p.sections, { pinned: true, running: true, services: true, recent: true, mostVisited: false, bookmarks: false });
  assert.deepEqual(p.hiddenSites, []);
});
test('keeps existing view and app choices', () => {
  const p = normalizePrefs({ view: 'list', editor: 'Cursor' });
  assert.equal(p.view, 'list');
  assert.equal(p.editor, 'Cursor');
});
test('bad view falls back to grid', () => assert.equal(normalizePrefs({ view: 'x' }).view, 'grid'));
test('isSectionOn reads toggles', () => assert.equal(isSectionOn(normalizePrefs({ sections: { recent: false } }), 'recent'), false));
test('badge until both granted', () => {
  assert.equal(needsBadge({ topSites: true, bookmarks: false }), true);
  assert.equal(needsBadge({ topSites: true, bookmarks: true }), false);
});
```

- [ ] **Step 2: Run** `node --test tests/prefs.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `lib/prefs.js`.**
- [ ] **Step 4: Run** `node --test tests/prefs.test.js`. Expected: PASS.
- [ ] **Step 5: Header markup and behaviour.**
  - Remove `.theme-toggle` from the header.
  - Right side order: tab switch (`Projects` | `Bookmarks`, segmented pill styled like `.view-toggle`), grid/list toggle, search, gear button (`#settings-btn`, `aria-haspopup="dialog"`).
  - Search collapses to a 36px round icon button with the `/` key hint. Click or `/` expands the input in place; `Escape` with an empty query collapses it. Placeholder: "Search projects" on Projects, "Search bookmarks" on Bookmarks.
  - Bookmarks tab button hidden unless `bookmarks` section is on. Grid/list toggle hidden when `data-tab="bookmarks"`.
  - `#tools` no longer hidden when there are no projects or in `renderSetup`; only the grid/list toggle and search hide in those states.
- [ ] **Step 6: Settings popover** (`#settings`, anchored under the gear, closes on outside click and `Escape`):
  - "Theme": Auto / Light / Dark segmented control, same behaviour as the old header toggle.
  - "Projects": switches for Pinned, Running, Services, Recent.
  - "Extras": switches for Most Visited and Bookmarks (permission handling comes in Task 4; for now they just save).
  - `render()` skips any section whose toggle is off. If all four are off or every visible section is empty because of toggles, `#empty` reads "All sections are hidden." with a button "Open settings".
- [ ] **Step 7: Verify in demo.** Rebuild demo, check: theme switch from Settings persists across reload; turning off Running hides it and its projects do not show up in Recent; `/` expands search; screenshot header in light and dark, grid and list.
- [ ] **Step 8: Verify setup state.** Add a `?nohost` query param to `mock.js` that makes `chrome.runtime.sendNativeMessage` answer with `lastError`; open the demo with it. Expected: setup screen shows, header still has gear and (once enabled) tab switch.
- [ ] **Step 9: Commit.** `git add extension tests scripts && git commit -m "Add settings popover, tab switch and collapsible search"`

### Task 4: Permissions and the settings badge

**Files:**
- Create: `extension/js/permissions.js`
- Modify: `extension/manifest.json`, `extension/js/settings.js`, `extension/newtab.css`, `scripts/demo/mock.js`

**Interfaces:**
- Produces (`permissions.js`): `export function hasPermission(name: 'topSites'|'bookmarks') -> Promise<boolean>`, `export function requestPermission(name) -> Promise<boolean>`, `export async function grantedMap() -> { topSites, bookmarks }`.
- Produces (`settings.js`): on load, any extra section whose permission is missing is treated as off (prefs not rewritten, so re-granting restores it).

- [ ] **Step 1: Manifest.** `"version": "1.1.0"`, add `"favicon"` to `permissions`, add `"optional_permissions": ["topSites", "bookmarks"]`.
- [ ] **Step 2: Toggle flow.** Turning on Most Visited or Bookmarks calls `requestPermission` synchronously from the change handler; declined or error snaps the switch back off and saves nothing. Turning off only saves the pref.
- [ ] **Step 3: Badge.** `#settings-btn` gets a dot (`.badge-dot`) when `needsBadge(await grantedMap())`. Pulse: 2s ease-in-out opacity/scale loop; `@media (prefers-reduced-motion: reduce)` disables the animation. Re-evaluate after every toggle and on `chrome.permissions.onAdded/onRemoved`.
- [ ] **Step 4: Mock.** `mock.js` implements `chrome.permissions.contains/request/onAdded/onRemoved` backed by an in-memory set; `?revoked` query param starts with the set empty even if prefs say on.
- [ ] **Step 5: Verify.** Demo: badge pulses on load; enable Most Visited, badge stays; enable Bookmarks, badge gone. Reload with `?revoked`: both toggles show off, badge back, no console errors.
- [ ] **Step 6: Real Chrome check (Arcadie).** Load unpacked from `extension/`, confirm the Chrome permission prompt text on enabling each toggle and that declining snaps the toggle back.
- [ ] **Step 7: Commit.** `git commit -am "Request optional permissions from settings with badge"`

### Task 5: Most Visited strip

**Files:**
- Create: `extension/js/lib/top-sites.js`, `extension/js/most-visited.js`, `tests/top-sites.test.js`
- Modify: `extension/newtab.html` (strip container `#most-visited` at the bottom of `.masthead-inner`), `extension/newtab.css`, `extension/js/core.js` (`faviconURL`), `extension/js/settings.js` ("Show hidden sites again" button, shown when `hiddenSites.length`), `scripts/demo/mock.js`

**Interfaces:**
- Produces (`lib/top-sites.js`): `export function pickTopSites(sites: {url, title}[], hidden: string[], limit = 10) -> {url, title}[]`
- Produces (`core.js`): `export function faviconURL(pageUrl, size = 32) -> string` built as `chrome.runtime.getURL('/_favicon/')` + `?pageUrl=<encoded>&size=<size>`.
- Produces (`most-visited.js`): `export function renderMostVisited()`; called by `main.js` on load, on tab switch and on prefs change.

- [ ] **Step 1: Write failing tests** in `tests/top-sites.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTopSites } from '../extension/js/lib/top-sites.js';

const s = (url, title = url) => ({ url, title });
test('drops localhost and 127.0.0.1', () => {
  const out = pickTopSites([s('http://localhost:3000/'), s('http://127.0.0.1:8080/x'), s('https://github.com/')], []);
  assert.deepEqual(out.map((x) => x.url), ['https://github.com/']);
});
test('drops hidden urls', () => {
  assert.deepEqual(pickTopSites([s('https://a.com/'), s('https://b.com/')], ['https://a.com/']).map((x) => x.url), ['https://b.com/']);
});
test('caps at limit after filtering', () => {
  const many = [s('http://localhost/'), ...Array.from({ length: 12 }, (_, i) => s(`https://s${i}.com/`))];
  assert.equal(pickTopSites(many, []).length, 10);
  assert.equal(pickTopSites(many, [])[0].url, 'https://s0.com/');
});
test('empty title falls back to hostname', () => {
  assert.equal(pickTopSites([s('https://www.figma.com/files', '')], [])[0].title, 'figma.com');
});
```

- [ ] **Step 2: Run** `node --test tests/top-sites.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `pickTopSites`** (hostname fallback strips a leading `www.`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Render the strip.** Only when Projects tab is active, `mostVisited` is on and permission is granted. Each chip is `<a class="site-chip" href>` with favicon `<img>` (on `error`, swap for a letter tile like `.avatar`) and the title, `data-tip` = title + URL. One row, no wrap; chips that do not fit are clipped (overflow hidden), no horizontal scroll. Right-click on a chip opens `openPopover` with one item "Hide"; it appends the URL to `prefs.hiddenSites` and re-renders. `Shift+F10`/context-menu key opens the same menu for keyboard users.
- [ ] **Step 6: Mock.** `chrome.topSites.get` returns 12 fixed sites including two localhost URLs; `runtime.getURL` returns a path that 404s in the demo so the letter fallback shows.
- [ ] **Step 7: Verify.** Demo with Most Visited on: 10 chips max, no localhost chips, Hide removes one and the next fills in, "Show hidden sites again" restores. Strip hidden on Bookmarks tab. Screenshot light and dark.
- [ ] **Step 8: Commit.** `git add extension tests scripts && git commit -m "Add Most Visited chip strip"`

### Task 6: Bookmarks tab, browsing

**Files:**
- Create: `extension/js/lib/bookmark-tree.js`, `extension/js/bookmarks.js`, `tests/bookmark-tree.test.js`
- Modify: `extension/newtab.html` (`<section id="bookmarks-view" hidden>` inside `.board-inner`), `extension/newtab.css`, `extension/js/main.js` (tab switch shows `#bookmarks-view`, hides project sections), `scripts/demo/mock.js`

**Interfaces:**
- Produces (`lib/bookmark-tree.js`):
  - `export function columnsFor(root: BookmarkTreeNode, path: string[]) -> { folder: BookmarkTreeNode, children: BookmarkTreeNode[] }[]` (first column is `root`'s children; then one column per id in `path` that still exists as a folder under the previous one; stops at the first missing id).
  - `export function displayTitle(node) -> string` (title, else hostname without `www.`, else `"Untitled"`).
  - `export function isBookmarklet(node) -> boolean` (`url` starts with `javascript:`).
  - `export function isFixedNode(node) -> boolean` (true for root `"0"` and its direct children).
- Produces (`bookmarks.js`): `export function initBookmarks()`, `export function renderBookmarks()`, `export function searchBookmarks(query: string)`; module state `path: string[]` reset to `[]` on each page load.

- [ ] **Step 1: Write failing tests** in `tests/bookmark-tree.test.js` with a fixture tree (root `0` → `1` "Bookmarks bar" → folder `10` "Work" → folder `100` "Docs", plus bookmarks; `2` "Other bookmarks"):

```js
test('columns follow the path', () => {
  const cols = columnsFor(tree, ['1', '10']);
  assert.deepEqual(cols.map((c) => c.folder.id), ['0', '1', '10']);
});
test('path truncates at a deleted folder', () => {
  assert.deepEqual(columnsFor(tree, ['1', '999', '100']).map((c) => c.folder.id), ['0', '1']);
});
test('displayTitle falls back to hostname', () => {
  assert.equal(displayTitle({ title: '', url: 'https://www.linear.app/team' }), 'linear.app');
});
test('bookmarklet detection', () => assert.equal(isBookmarklet({ url: 'javascript:alert(1)' }), true));
test('fixed nodes', () => {
  assert.equal(isFixedNode({ id: '1', parentId: '0' }), true);
  assert.equal(isFixedNode({ id: '10', parentId: '1' }), false);
});
```

- [ ] **Step 2: Run** `node --test tests/bookmark-tree.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the four functions.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Columns UI.** `chrome.bookmarks.getTree()` → `columnsFor`. Columns 240px wide, scroll horizontally inside the view when they overflow. Folder rows: folder icon, title, chevron; selected folder highlighted. Bookmark rows: `<a href>` with favicon (`faviconURL`, letter fallback) and `displayTitle`; bookmarklets render as non-link rows with `data-tip="Bookmarklets only run from Chrome's bookmarks bar"`. Above the columns: breadcrumb of the path (each crumb clickable). Keyboard: arrow keys move within a column, Right/Enter opens a folder, Left goes up.
- [ ] **Step 6: Live updates.** Listen to `chrome.bookmarks.onCreated/onRemoved/onChanged/onMoved/onChildrenReordered`; re-fetch the tree and re-render (debounced 50ms). The path truncates via `columnsFor`.
- [ ] **Step 7: Search.** On the Bookmarks tab the search input calls `chrome.bookmarks.search(query)`, keeps only nodes with `url`, shows them as a flat list in place of the columns (row shows title plus its folder name); empty query restores the columns.
- [ ] **Step 8: Mock.** In-memory tree (about 40 nodes, 3 levels, one bookmarklet, one empty-title bookmark) with `getTree`, `getSubTree`, `search`, `create`, `update`, `move`, `remove`, `removeTree` and the five events, all mutating the in-memory tree and emitting events.
- [ ] **Step 9: Verify.** Demo: enable Bookmarks, switch tab, open three levels, breadcrumb jumps back, search finds a nested bookmark, grid/list toggle and strip hidden. In the console, delete the open folder through `chrome.bookmarks.removeTree(id)`: columns truncate, no errors. Screenshot light and dark.
- [ ] **Step 10: Commit.** `git add extension tests scripts && git commit -m "Add Bookmarks tab with column browser"`

### Task 7: Bookmarks editing

**Files:**
- Modify: `extension/js/lib/bookmark-tree.js`, `tests/bookmark-tree.test.js`, `extension/js/bookmarks.js`, `extension/newtab.css`

**Interfaces:**
- Produces (`lib/bookmark-tree.js`):
  - `export function countBookmarks(node) -> number` (bookmarks with `url` in the subtree, folders not counted).
  - `export async function restoreTree(api: { create(o): Promise<{id}> }, snapshot: BookmarkTreeNode, parentId: string, index: number) -> Promise<string>` re-creates the node and its children in order, returns the new root id.

- [ ] **Step 1: Write failing tests:**

```js
test('countBookmarks counts only urls', () => assert.equal(countBookmarks(workFolder), 4));
test('restoreTree recreates in order', async () => {
  const calls = [];
  let n = 0;
  const api = { create: async (o) => (calls.push(o), { id: String(++n) }) };
  await restoreTree(api, { title: 'Work', children: [{ title: 'A', url: 'https://a.com' }, { title: 'Sub', children: [] }] }, 'p', 2);
  assert.deepEqual(calls, [
    { parentId: 'p', index: 2, title: 'Work' },
    { parentId: '1', index: 0, title: 'A', url: 'https://a.com' },
    { parentId: '1', index: 1, title: 'Sub' },
  ]);
});
```

Children use the id returned for their re-created parent (`'1'`, the fake's first id).

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Actions UI.** Toolbar buttons "+ Folder" and "+ Bookmark" create in the deepest selected folder (default "Bookmarks bar") and immediately open inline edit on the new row. Row context menu (right-click, `Shift+F10`, and a `...` button on row hover) via `openPopover`: "Rename" (folders) or "Edit" (bookmarks: title and URL fields inline in the row, Enter saves via `bookmarks.update`, Escape cancels), "New folder here", "Delete". Fixed nodes (`isFixedNode`) get no Rename/Edit/Delete.
- [ ] **Step 6: Delete.** Bookmark or empty folder: snapshot with `getSubTree`, `remove`/`removeTree`, toast "Deleted “<title>”" with an "Undo" button (6s) that calls `restoreTree` at the old parent and index. Non-empty folder: the menu swaps to a confirm step "Delete “<title>” and its N bookmarks? This can't be undone." with "Delete" and "Cancel"; no undo toast. `toast()` gains an optional `{ action: { label, run } }` argument for the Undo button.
- [ ] **Step 7: Verify.** Demo: create folder, rename, add bookmark with URL, edit it, delete it and undo (comes back at the same position), delete a non-empty folder through the confirm step. Fixed root folders show no destructive items.
- [ ] **Step 8: Commit.** `git add extension tests && git commit -m "Add bookmark editing, delete with undo"`

### Task 8: Bookmarks drag and drop

**Files:**
- Modify: `extension/js/lib/bookmark-tree.js`, `tests/bookmark-tree.test.js`, `extension/js/bookmarks.js`, `extension/newtab.css`

**Interfaces:**
- Produces (`lib/bookmark-tree.js`):
  - `export function canDrop(tree, dragId, targetParentId) -> boolean`: false if the dragged node is fixed, if the target is root `"0"`, if the target is the dragged folder or any of its descendants.
  - No index translation: Chrome's `bookmarks.move` takes the visual slot in the list as it is before the move (slot = gap between rows, 0 = before the first row) and itself subtracts one when moving down within the same folder. Pass the slot straight through. The mock's `move` must copy that rule: same parent and `index > oldIndex` means insert at `index - 1` after removal.

- [ ] **Step 1: Write failing tests:**

```js
test('cannot drop folder into itself or a descendant', () => {
  assert.equal(canDrop(tree, '10', '10'), false);
  assert.equal(canDrop(tree, '10', '100'), false);
  assert.equal(canDrop(tree, '10', '2'), true);
});
test('cannot drag fixed folders or drop into root', () => {
  assert.equal(canDrop(tree, '1', '2'), false);
  assert.equal(canDrop(tree, 'b1', '0'), false);
});
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `canDrop`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Drag UI** with native HTML5 drag and drop on rows (`draggable="true"` unless fixed). Dragging over the upper or lower half of a row shows an insertion line at that slot; dragging over the middle of a folder row highlights it as "drop into" (appends at the end). Dropping on empty space in a column appends to that column's folder. Hovering a folder row for 600ms while dragging opens it as the next column. Invalid targets (`canDrop` false) show no indicator and refuse the drop. Drop calls `chrome.bookmarks.move(id, { parentId, index: slot })`.
- [ ] **Step 6: Verify in demo.** Reorder within a column (down and up), move into another column, drop onto a folder row, try dropping a folder into its own child (refused).
- [ ] **Step 7: Real Chrome check (Arcadie).** Load unpacked, move a bookmark down two slots in the same folder; it must land exactly where the line was. If it lands one off, the slot rule above is wrong: add an index translation in `bookmark-tree.js` with a test, and fix the mock to match.
- [ ] **Step 8: Commit.** `git commit -am "Add bookmark drag and drop"`

### Task 9: Store listing and final pass

**Files:**
- Modify: `store/listing.md`

- [ ] **Step 1: Single purpose** becomes: "Replaces the new tab page with a developer dashboard: the local development servers (localhost projects) the user has run, with controls to start, stop and open them, plus optional quick access to the user's most visited sites and bookmarks."
- [ ] **Step 2: Justification rows** to add:
  - `favicon`: "Shows site icons next to most visited sites and bookmarks. Icons come from Chrome's local favicon cache."
  - `topSites` (optional): "Only requested when the user turns on Most Visited in settings. Shows their most visited sites on the new tab. Read only, nothing leaves the device."
  - `bookmarks` (optional): "Only requested when the user turns on Bookmarks in settings. Lets them browse, open, rename, move and delete their own bookmarks from the new tab. Nothing leaves the device."
- [ ] **Step 3: Full regression pass.** `node --test tests/` all pass. Demo: every section toggle, both tabs, grid and list, light and dark, setup state (`?nohost`), revoked state (`?revoked`). `bash scripts/package.sh` lists `js/` and `js/lib/` in the zip and no `tests/`.
- [ ] **Step 4: Commit.** `git commit -am "Update store listing for new permissions"`
