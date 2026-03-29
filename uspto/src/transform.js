function processItem(item) {
  const matches = item.description.match(/^Registered trademark application for (.*) filed by (.*) filed on (.*)\.$/);
  return {
    mark: item.title.substring(0, item.title.length - " Trademark Registration".length) || matches?.[1] || "(logo mark)",
    id: item.guid.substring("https://uspto.report/TM/".length),
    owner: matches?.[2],
    date: matches?.[3],
  };
}

async function transform(input) {
  if (!input?.rss?.channel?.item?.length) {
    return {
      items: {
        mark: "Error retrieving content.",
        owner: `Data: ${JSON.stringify(input).substring(0, 900000)}`,
        id: '0',
        date: '0000-00-00',
      }
    }
  }
  const items = input.rss.channel.item;
  const randomItems = items.sort(() => Math.random() - 0.5).slice(0, 50);
  const processedItems = randomItems.map(processItem);

  return { items: processedItems };
}