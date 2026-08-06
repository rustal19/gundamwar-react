import { FORMAT_PRESETS } from "../data/formats";
import { getCardFormatStatus, getFormatSetCodes } from "./searchResults";

const kansaiGlorious = FORMAT_PRESETS.find(({ name }) => name === "関西グロリアス");

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
