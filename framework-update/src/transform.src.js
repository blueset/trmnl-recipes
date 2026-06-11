const { parse } = require('./vendor.min.js'); // node-html-parser

function transform(input) {
  const root = parse(input.data);
  const groups = root.querySelectorAll('div:has(> h2 + div)').map(group => {
    const groupName = group.querySelector('h2').text.trim();
    const items = group.querySelectorAll('> div > div').map(item => {
      if (!item.querySelector('h2')) {
        console.log('Skipping item without h2:', item.toString());
      }
      const name = item.querySelector('h2').text.trim();
      const date = item.querySelector('div:has(> h2) > span:last-child').text.trim();
      const assets = item.querySelectorAll('div:has(> div > a[download])').map(asset => {
        const assetName = asset.querySelector('a').text.trim();
        const link = asset.querySelector('a').getAttribute('href');
        const size = asset.querySelector('> span:nth-last-child(2)').text.trim();
        const date = asset.querySelector('> span:last-child').text.trim();
        return { name: assetName, size, link, date };
      });
      return { name, date, assets };
    });
    return { groupName, items };
  });

  const latest = groups[0]?.items[0];

  return {
    groups: groups,
    latest: latest
  };
}

if (require.main === module) {
  (async () => {
    const request = await fetch('https://trmnl.com/framework/releases');
    const text = await request.text();
    const result = transform({ data: text });
    console.log(JSON.stringify(result, null, 2));
  })();
}
