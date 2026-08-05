import { FORMAT_PRESETS } from "../data/formats";
import { getCardFormatStatus } from "./searchResults";

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

  test("使用可能な収録弾が一つもないカードを範囲外にする", () => {
    expect(
      getCardFormatStatus(
        { cardId: "test-card", sets: ["29th"] },
        { allowedSets: ["28th", "PR"] }
      ).isOutOfPool
    ).toBe(true);
  });

  test("複数の収録弾のうち一つでも使用可能なら範囲内にする", () => {
    expect(
      getCardFormatStatus(
        { cardId: "test-card", sets: ["29th", "PR"] },
        { allowedSets: ["28th", "PR"] }
      ).isOutOfPool
    ).toBe(false);
  });

  test("収録弾情報がないカードはプール判定をスキップする", () => {
    expect(
      getCardFormatStatus(
        { cardId: "test-card" },
        { allowedSets: ["28th"] }
      ).isOutOfPool
    ).toBe(false);
  });

  test("allowedSetsがnullならプール判定を行わない", () => {
    expect(
      getCardFormatStatus(
        { cardId: "test-card", sets: ["29th"] },
        { allowedSets: null }
      ).isOutOfPool
    ).toBe(false);
  });
});
