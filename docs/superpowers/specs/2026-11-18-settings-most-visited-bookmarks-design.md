# Settings, Most Visited and Bookmarks: design

Date: 2026-11-18
Status: awaiting approval

## Intent

A user of the extension asked for quick access to the sites they visit most, like Chrome's default new tab had. Arcadie also misses the default new tab's bookmark management: the Chrome toolbar lets you open bookmarks, but not move, rename or organise them. Since this extension replaces the new tab, both are now missing for every user.

Goal: add Most Visited and a Bookmarks manager, plus a Settings panel that controls which sections appear, without diluting what makes the extension distinct (localhost projects stay the hero of the page).

## Goals

- **Most Visited**: up to 10 of the user's top sites, one click away, visible without scrolling on the Projects tab.
- **Bookmarks tab**: browse the real Chrome bookmark tree in Finder-style columns, open bookmarks, and manage them: rename, edit URL, new folder, new bookmark, delete, reorder and move by drag and drop.
- **Settings panel**: toggle sections on and off, and pick the theme (moved out of the header).
- **Header cleanup**: theme toggle leaves the header, search collapses to an icon plus the `/` shortcut, a Projects | Bookmarks tab switch and a settings button are added. The grid/list toggle stays.
- **List view fix**: the list view's row controls (folder, code, more, primary action) become square instead of tall rectangles.
- **Refactor to ES modules** so sections come from a registry instead of hardcoded HTML.

## Non-goals (this iteration)

- Regenerating store screenshots, promo and social images. That happens later, together with a LinkedIn update post. `scripts/store-assets.js` may break after the module refactor; fixing it is part of that later step.
- Drag to reorder sections. The registry makes it easy later, but no UI for it now.
- Recent Tabs / recently closed tabs. The page already has a "Recent" section (recent localhost projects); a second "Recent" would confuse, and `sessions` would add a history-level permission warning.
- Our own visit tracking. `chrome.topSites` is the source; no `history` permission.
- Customising Most Visited beyond hiding sites (no manual pinning or adding).

## Anti-goals

- Turning the page into a generic new tab (Momentum, Bonjourr style). Localhost projects remain the default tab and the visual focus.
- Any update that disables the extension for existing users because of new permission warnings.
- Hover-to-reveal UI for primary access.

## Constraints

- Vanilla JS, no build step, no framework. MV3 extension pages load `<script type="module">` natively.
- `minimum_chrome_version` is 116.
- Existing users must not see a permission prompt on update. `topSites` and `bookmarks` carry install warnings ("Read a list of your most frequently visited websites", "Read and change your bookmarks"), so they go in `optional_permissions` and are requested with `chrome.permissions.request()` from a user gesture when the user enables the feature.
- `favicon` permission (for `chrome-extension://<id>/_favicon/?pageUrl=…&size=32`) has no warning, so it goes in the required `permissions`.
- `chrome.topSites` is read-only and returns a short list (around 10). Hiding a site is local only.
- The two root bookmark folders ("Bookmarks bar", "Other bookmarks", plus "Mobile bookmarks") cannot be renamed, deleted or moved.
- Bookmark edits write to the user's real Chrome bookmarks and sync across their devices.
- The page currently only renders after the native host answers; Settings, Most Visited and Bookmarks must work even when the helper is missing (setup screen state).
- `demo/` is a copy of the extension page with `chrome.*` mocked (`scripts/demo/mock.js`). It must keep working: the mock needs `topSites`, `bookmarks` and `permissions` stubs, and the demo needs the new module files.
- Chrome Web Store: the single purpose statement and permission justifications in `store/listing.md` must be updated.

## Approaches considered

1. **ES modules, no build step (chosen).** Split `newtab.js` into modules: core/projects, most visited, bookmarks, settings. Sections become a JS registry `{ id, label, enabled, render }`. Trade-off: one-time refactor of a 942-line file, some regression risk in Projects.
2. **Keep everything in `newtab.js`.** No refactor, but the file passes ~1800 lines, mixing bookmark drag and drop with native host logic; every later feature costs more.
3. **Preact or Lit plus a bundler.** Nicer components, but adds a build pipeline to an extension that has none and more for store review to inspect. Overkill for four sections.

Rejected outright: a separate Bookmarks HTML page (breaks the tab switch, duplicates the header).

Arcadie picked approach 1.

## Design (decided with Arcadie)

### Header

- Left: headline and lede, unchanged.
- Right, in order: Projects | Bookmarks tab switch, grid/list toggle, search icon button with `/` hint, settings (gear) button.
- Theme toggle is removed from the header and lives in Settings.
- Grid/list toggle is hidden while the Bookmarks tab is active (the columns view has no grid or list mode). The saved view choice is untouched and applies again on Projects.
- **Most Visited chip strip (option B from the mockups)**: one thin row of pill chips (favicon + site title) along the bottom of the header, full content width, under the headline. Shown only on the Projects tab and only when enabled. Up to 10 chips.

### Most Visited

- Source: `chrome.topSites.get()`, minus locally hidden URLs, first 10.
- Chip: favicon via `_favicon` URL, title truncated with ellipsis, full title + URL as tooltip (existing `data-tip` system).
- Click opens in the same tab; Cmd/Ctrl click and middle click open a new tab (plain `<a href>` gives this for free).
- Right-click (and a keyboard-reachable equivalent) offers "Hide": the URL goes into a local blocklist in `chrome.storage.local`.
- Settings has "Show hidden sites again" to clear the blocklist.

### Bookmarks tab

- Finder-style columns. First column: root folders. Clicking a folder selects it and opens its children in the next column to the right; deeper columns are dropped. Columns scroll horizontally when they exceed the width.
- Bookmark rows: favicon + title. Folder rows: folder icon + title + chevron.
- Clicking a bookmark opens it (same modifiers as Most Visited).
- Toolbar above the columns: breadcrumb of the current path, "+ Folder", "+ Bookmark" (create in the selected folder).
- Context menu on a row (reuses the existing menu component): Rename / Edit (title + URL for bookmarks, title for folders), New folder here, Delete.
- Drag and drop: reorder within a column, move into another column, drop onto a folder row to move into it. Implemented with `chrome.bookmarks.move()`.
- Live updates: listen to `onCreated`, `onRemoved`, `onChanged`, `onMoved`, `onChildrenReordered` and re-render, so edits from Chrome's own UI or other devices show up.
- Search icon on this tab searches bookmarks (`chrome.bookmarks.search`) and shows a flat result list in place of the columns; clearing the query restores the columns.

### Settings panel

- Opened from the gear button, as a popover anchored to it.
- Theme: Auto / Light / Dark (same behaviour and `localStorage` key as today, so `theme.js` keeps applying it before paint).
- Sections: toggles for Most Visited and Bookmarks tab, plus the existing Projects sections (Pinned, Running, Services, Recent).
- Turning on Most Visited or Bookmarks calls `chrome.permissions.request()` in the click handler. If the user declines, the toggle snaps back off.
- Enabled sections are stored in `chrome.storage.local` under `prefs`.
- **Discovery badge**: Most Visited and Bookmarks start off (permissions need a click). Until both `topSites` and `bookmarks` permissions are granted, the gear button shows a pulsing notification dot. It disappears once both are granted. With `prefers-reduced-motion`, the dot is static.

### Default tab

- Every new tab opens on Projects. The active tab is not persisted; the Bookmarks column path is not persisted either.

### List view square controls

- Compact list rows (around 52px tall).
- Each icon cell (folder, code, more) is exactly as wide as it is tall (`aspect-ratio: 1`). The primary action cell (Start / Set command) keeps its text width.

## Calls made by Claude (not yet confirmed by Arcadie)

- **Most Visited filters out `localhost` and `127.0.0.1` URLs** before taking the first 10. Developers' top sites are mostly their own dev servers, which the Projects grid already shows.
- **Delete safeguards**: deleting a bookmark or an empty folder shows an undo toast (re-create from a snapshot). Deleting a non-empty folder asks for confirmation first, stating how many bookmarks it contains, and has no undo. Drag-to-move needs no safeguard (it is easy to move back).
- **Turning off a Projects section hides it.** Its projects do not fall through into other sections. The headline count and lede are unchanged. If every visible section is empty because of toggles, the empty state says so and links to Settings.
- **Turning a feature off keeps its permission.** No `permissions.remove()`, so turning it back on needs no prompt. On every page load, `chrome.permissions.contains()` is checked; if the user revoked it in chrome://extensions, the feature shows as off.

## Left to the builder

- Module boundaries and file names inside `extension/`.
- Exact sizes, spacing and the chip/column styling, following the existing tokens in `newtab.css` and checked in both light and dark themes.
- How the registry drives the existing Projects sections internally, as long as current behaviour (view transitions, pinning, polling) is unchanged.
- Updating the demo mock and the store listing text (single purpose statement, permission justifications).
