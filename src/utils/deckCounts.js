function normalizeCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export function getDeckItemZone(item) {
  return item?.zone === "side" ? "side" : "main";
}

export function countDeckItems(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + normalizeCount(item?.count),
    0
  );
}

export function getDeckCounts(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (counts, item) => {
      const count = normalizeCount(item?.count);
      if (getDeckItemZone(item) === "side") {
        counts.sideCount += count;
      } else {
        counts.mainCount += count;
      }
      return counts;
    },
    { mainCount: 0, sideCount: 0 }
  );
}

export function formatDeckCountSummary(mainCount, sideCount) {
  return `メイン${normalizeCount(mainCount)}枚 / サイド${normalizeCount(sideCount)}枚`;
}
