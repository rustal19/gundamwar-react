import formatCardNames from "./formatCardNames.json";
import { FORMAT_PRESETS } from "./formats";

test("全プリセットの禁止・制限カードIDを静的な実名へ解決できる", () => {
  const references = new Set(
    FORMAT_PRESETS.flatMap(({ regulation }) => [
      ...(regulation?.bannedCards || []),
      ...(regulation?.limitedCards || []),
    ])
  );
  const idReferences = [...references].filter((reference) => /^\d{9}$/.test(reference));

  expect(idReferences).toHaveLength(154);
  expect(Object.keys(formatCardNames)).toHaveLength(154);
  expect(idReferences.filter((cardId) => !formatCardNames[cardId])).toEqual([]);
  expect(formatCardNames["101020126"]).toBe("チェーミン・ノア");
  expect(formatCardNames["102040080"]).toBe("総攻撃");
});
