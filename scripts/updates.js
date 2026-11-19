'use strict';

// One entry per release announcement. store-assets.js renders the entry whose
// version matches extension/manifest.json into assets/social/updates/.
// Scenes are demo URL params (see scripts/demo/mock.js). Crops are [x, y, w, h]
// in CSS px of the shot. The hero is scaled to the full content width (904px);
// row items are scaled to ROW_HEIGHT and their scaled widths must add up to 904
// with the 20px gap.
module.exports = [
  {
    version: '1.1.0',
    title: 'Now with <em>Bookmarks</em> and <em>Most Visited</em>',
    hero: { scene: 'theme=dark&expand', viewport: [1280, 820], crop: [0, 20, 1280, 765] },
    row: [
      { scene: 'theme=dark&tab=bookmarks&open=AI stack&hide=sites&scroll=start', viewport: [700, 560], crop: [0, 20, 700, 516] },
      { scene: 'theme=dark&view=list&settings', viewport: [904, 640], crop: [572, 111, 300, 431] },
    ],
  },
];
