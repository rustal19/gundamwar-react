import { formatDeckCountSummary, getDeckCounts } from "./deckCounts";

function summarize(items) {
  const { mainCount, sideCount } = getDeckCounts(items);
  return formatDeckCountSummary(mainCount, sideCount);
}

describe("deck count summary", () => {
  test("メインのみでもサイド0枚を表示する", () => {
    expect(summarize([{ cardId: "main-1", count: 50 }])).toBe(
      "メイン50 / サイド0"
    );
  });

  test("メインとサイドをzone別に合計する", () => {
    expect(
      summarize([
        { cardId: "main-1", count: 47, zone: "main" },
        { cardId: "main-2", count: "3" },
        { cardId: "side-1", count: 10, zone: "side" },
      ])
    ).toBe("メイン50 / サイド10");
  });

  test("空デッキは両方0枚と表示する", () => {
    expect(summarize([])).toBe("メイン0 / サイド0");
  });
});
