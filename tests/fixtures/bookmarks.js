export function makeTree() {
  return {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: 'Bookmarks bar',
        children: [
          {
            id: '10',
            parentId: '1',
            title: 'Work',
            children: [
              { id: '100', parentId: '10', title: 'Docs', children: [{ id: 'b4', parentId: '100', title: 'MDN', url: 'https://developer.mozilla.org/' }] },
              { id: 'b1', parentId: '10', title: 'Linear', url: 'https://linear.app/' },
              { id: 'b2', parentId: '10', title: 'Vercel', url: 'https://vercel.com/' },
              { id: 'b3', parentId: '10', title: 'Figma', url: 'https://figma.com/' },
            ],
          },
          { id: 'b5', parentId: '1', title: 'GitHub', url: 'https://github.com/' },
        ],
      },
      { id: '2', parentId: '0', title: 'Other bookmarks', children: [] },
    ],
  };
}
