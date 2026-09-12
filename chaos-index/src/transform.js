const sentenceSegmenter = new Intl.Segmenter("en", {
  granularity: "sentence",
});

function splitSentences(paragraph) {
  if (typeof paragraph !== "string") return undefined;

  paragraph = paragraph.replaceAll("U.S./", "U.S.—");
  return Array.from(sentenceSegmenter.segment(paragraph), ({ segment }) =>
    segment.trim().replaceAll("U.S.—", "U.S./")
  ).filter(Boolean);
}

function getChaosIndexScale(chaosIndex) {
  if (
    typeof chaosIndex !== "number" ||
    !Number.isFinite(chaosIndex) ||
    chaosIndex < 0 ||
    chaosIndex > 100
  ) {
    return undefined;
  }

  if (chaosIndex <= 20) return "Cool";
  if (chaosIndex <= 40) return "Mild";
  if (chaosIndex <= 60) return "Warm";
  if (chaosIndex <= 80) return "Hot";
  return "Burning";
}

async function run(input) {
  const baseUrl = "https://kite.kagi.com";
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const batchesUrl = new URL("/api/batches", baseUrl);
  batchesUrl.searchParams.set("from", from.toISOString());
  batchesUrl.searchParams.set("to", to.toISOString());

  const batchesResponse = await fetch(batchesUrl);

  if (!batchesResponse.ok) {
    throw new Error(
      `Failed to fetch batches: ${batchesResponse.status} ${batchesResponse.statusText}`
    );
  }

  const { batches = [] } = await batchesResponse.json();
  const points = [];
  let nextIndex = 0;

  // Limit concurrency rather than requesting every batch simultaneously.
  async function worker() {
    while (nextIndex < batches.length) {
      const batch = batches[nextIndex++];

      const chaosResponse = await fetch(
        `${baseUrl}/api/batches/${encodeURIComponent(batch.id)}/chaos`
      );

      // Not every batch includes World news processing.
      if (chaosResponse.status === 404) continue;

      if (!chaosResponse.ok) {
        throw new Error(
          `Failed to fetch chaos data for batch ${batch.id}: ` +
            `${chaosResponse.status} ${chaosResponse.statusText}`
        );
      }

      const { chaosIndex, chaosLastUpdated } = await chaosResponse.json();
      const updatedAt = Date.parse(chaosLastUpdated);

      if (typeof chaosIndex === "number" && Number.isFinite(updatedAt)) {
        points.push({ value: chaosIndex, updatedAt });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(8, batches.length) },
      () => worker()
    )
  );

  points.sort((a, b) => a.updatedAt - b.updatedAt);

  const history = points.map(({ value }) => value);
  const chaosDescriptions = splitSentences(input.chaosDescription);
  const chaosIndexScale = getChaosIndexScale(input.chaosIndex);

  return { ...input, history, chaosDescriptions, chaosIndexScale };
}