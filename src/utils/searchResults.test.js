import { FORMAT_PRESETS } from "../data/formats";
import {
  buildSearchCriteriaSummary,
  formatSearchResultsSummary,
  getCardFormatStatus,
  getFormatSetCodes,
} from "./searchResults";

const kansaiGlorious = FORMAT_PRESETS.find(({ name }) => name === "関西グロリアス");

test("検索結果の総件数・現在ページ・総ページ数を明示する", () => {
  expect(formatSearchResultsSummary(100, 2, 5)).toBe("全100件・2 / 5ページ");
});

test("検索条件要約は既定値と表示制御値を除き、選択肢を日本語化する", () => {
  expect(
    buildSearchCriteriaSummary({
      name: "シャア",
      cardType: [1, 2],
      colorInclude: [4],
      includeAltStats: true,
      traits_logic: "and",
      unitFeatureExtra: ["mobileDoll"],
      setIncluded: ["12th"],
      page: 2,
      pageSize: 20,
      sortMethod: "発行順",
      mobileLayout: "ios",
    })
  ).toEqual([
    { key: "name", label: "カード名", value: "シャア" },
    { key: "cardType", label: "カードタイプ", value: "UNIT、CHARACTER" },
    { key: "colorInclude", label: "含む色", value: "赤" },
    { key: "unitFeatureExtra", label: "UNIT追加特徴", value: "MD" },
    { key: "setIncluded", label: "収録弾", value: "宿命の螺旋" },
  ]);
});

describe("getCardFormatStatus", () => {
  test("文字列の禁止カードIDに数値のcardIdを確実に一致させる", () => {
    expect(
      getCardFormatStatus(
        { cardId: 101020126 },
        kansaiGlorious.regulation
      )
    ).toMatchObject({
      isBanned: true,
      isLimited: false,
    });
  });

  test("制限カードIDを判定する", () => {
    expect(
      getCardFormatStatus(
        { cardId: "101010083" },
        kansaiGlorious.regulation
      )
    ).toMatchObject({
      isBanned: false,
      isLimited: true,
    });
  });

});

describe("getFormatSetCodes", () => {
  test("使用可能収録弾の日本語名を検索APIの収録弾コードへ変換する", () => {
    expect(
      getFormatSetCodes({ allowedSets: ["GUNDAM WAR", "宿命の螺旋", "プロモカード"] })
    ).toEqual(["1st", "12th", "PR"]);
  });

  test("allowedSetsがnullならnull(全弾許可・プール絞り込みなし)を返す", () => {
    expect(getFormatSetCodes({ allowedSets: null })).toBeNull();
    expect(getFormatSetCodes({})).toBeNull();
  });

  test("関西グロリアスのプールに新しい収録弾コードが含まれる", () => {
    const codes = getFormatSetCodes(kansaiGlorious.regulation);
    expect(codes).toContain("28th");
    expect(codes).toContain("12th");
  });
});
