function transform(input) {
  const clusters = input.clusters.map(cluster => ({
      title: cluster.title,
      short_summary: cluster.short_summary.replaceAll(/\s*\[.+?#\d+\]/g, "").trim(),
      emoji: cluster.emoji,
      primary_image: cluster.primary_image,
      category: cluster.category,
  }));

  if (clusters.length < 1) {
    return {
      category: input.trmnl.plugin_settings.custom_fields_values.category,
      cluster: {
        title: "No stories for this community category today.",
        short_summary: "Not enough shared news between feeds to form stories. This happens sometimes with community categories.",
        category: "No stories",
        emoji: "📰",
      }
    }
  }

  const cluster = clusters[Math.floor(Math.random() * clusters.length)];

  return {
    category: input.category,
    cluster
  };
}