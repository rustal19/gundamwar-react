import setReleaseDates from "./setReleaseDates.json";
import gwCupFormats from "./gwCupFormats.json";
import { SET_NAME_TO_CODE, TENSAKU_OPTIONS } from "./searchOptions";

// 添削杯の使用可能セットは手で書かれており、実際に漏れが3件あった
// (第7回:戦場の女神2 / 第8回:破壊と再生の剣・異世界からの使者 / 第9回:EB3)。
// カットオフ日より前に出た弾が抜けていないかを機械的に固定する。

// この弾だけに収録されたカードが無いもの。入っていなくても使えるカードは変わらない。
const NO_EXCLUSIVE_CARDS = new Set(["DB11", "WB"]);
// コラボカードを日付で除外するため、意図的に未来日付を入れている弾。
// プロモは長期配布のため単一の発売日で判定しない。
const DATE_EXEMPT = new Set(["CB1", "PR"]);
// card_set_inclusion の列名と検索オプションのコードで表記が違うもの。
const CODE_ALIAS = new Map([["BS1", "BS"]]);

function codeOf(setName) {
  return SET_NAME_TO_CODE[setName];
}

function expectedCodes(cutoff) {
  return Object.entries(setReleaseDates)
    .filter(([, releaseDate]) => releaseDate <= cutoff)
    .map(([code]) => CODE_ALIAS.get(code) || code)
    .filter((code) => !NO_EXCLUSIVE_CARDS.has(code) && !DATE_EXEMPT.has(code));
}

const tensakuPresets = TENSAKU_OPTIONS.map(({ label, value }) => {
  const round = label.match(/第(\d+)回/)[1];
  return {
    round,
    cutoff: value,
    preset: gwCupFormats.formats.find((f) => f.name.includes(`第${round}回`)),
  };
}).filter(({ preset }) => preset);

test("添削杯のプリセットが存在する回を検査対象にできている", () => {
  expect(tensakuPresets.length).toBeGreaterThanOrEqual(7);
});

describe.each(tensakuPresets)("$preset.name", ({ cutoff, preset }) => {
  const allowed = preset.regulation.allowedSets || [];

  test("使用可能セットの名前がすべて既知の弾名である", () => {
    const unknown = allowed.filter((name) => !codeOf(name));
    expect(unknown).toEqual([]);
  });

  test("カットオフ日より前に発売された弾が漏れていない", () => {
    const codes = new Set(allowed.map(codeOf));
    const missing = expectedCodes(cutoff).filter((code) => !codes.has(code));
    expect(missing).toEqual([]);
  });

  test("カットオフ日より後に発売された弾が混ざっていない", () => {
    const late = allowed
      .map(codeOf)
      .filter((code) => !DATE_EXEMPT.has(code))
      .filter((code) => {
        const releaseDate = setReleaseDates[code];
        return releaseDate && releaseDate > cutoff;
      });
    expect(late).toEqual([]);
  });
});
