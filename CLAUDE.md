# Localhost New Tab

Chrome MV3 extension (vanilla ES modules, no build step) in `extension/`, native helper in `extension/helper/host.js`.

## Commands

- Tests: `node --test` (not `node --test tests/`)
- Demo only: `node scripts/store-assets.js --demo-only`
- All images: `node scripts/store-assets.js`
- Release update image only: `node scripts/store-assets.js --update`
- Store zip: `sh scripts/package.sh`
- A release needs the `vX.Y.Z` git tag pushed: the setup command in the extension downloads `install.sh` from that tag.

## Helper updates

The helper ships inside the extension (`extension/helper/host.js`) and updates itself: every scan reports its version and SHA-256, and when the hash differs from the bundled file the extension sends the bundled source with an `update` message (checksum and syntax checked, atomic replace, previous copy kept as `host.prev.js`). Bump `HELPER_VERSION` in host.js, `VERSION` in install.sh and the manifest version together; a test fails if they drift, and `scripts/package.sh` refuses to build when tests fail.

## Images

All store, README, social and release images come from `scripts/store-assets.js`. It serves `demo/` over a local HTTP server and drives scenes with URL params handled in `scripts/demo/mock.js` (`theme`, `view=list`, `tab=bookmarks`, `open=Folder/Sub`, `scroll=start`, `expand`, `menu=<project>:<action>`, `settings`, `hide=sites`). Never edit images by hand; change the scene and regenerate.

- Make images look like the real extension. Menus that list apps (Open in editor, Open in terminal) must show the real app icons. The script reads them from the helper (`appIcons`) for the apps installed on this Mac. Apps that aren't installed can be added as `scripts/demo/app-icons/<App Name>.png` (64px, official icon); they join the menus with that name. If an app shown in a shot has no icon, say so instead of shipping generic icons.
- Demo projects must be types the helper really detects (Node, Python, Go, Rust, Ruby, Deno, Expo...). Docker containers are not detected (their ports belong to `com.docker.backend`), so never show them.
- Chrome Web Store allows at most 5 screenshots, 1280x800.

## Release update images

Each release gets one 1080x1350 announcement image (LinkedIn shows 4:5 uncropped in the feed).

1. Add an entry to `scripts/updates.js` for the new manifest version: title (HTML, `<em>` for the emphasised feature names, one line), one hero scene and a row of scenes.
2. Run `node scripts/store-assets.js --update`.
3. Output goes to `assets/social/updates/update-vX.Y.Z-1080x1350.png` and is committed. Earlier images there are the reference for style; don't regenerate past versions.
