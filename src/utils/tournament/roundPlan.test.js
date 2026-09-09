import {
  describeRoundPlanTable,
  formatRoundPlan,
  resolveRoundPlan,
} from "./roundPlan";

// 主催者が示した運用表そのもの。境界がずれると大会の進行が変わるため、
// 表の全区間と境界値を固定する。
describe("参加人数から回戦数とトップカットを決める", () => {
  test.each([
    [1, 3, null],
    [3, 3, null],
    [4, 3, null],
    [5, 3, null],
    [8, 3, null],
    [9, 4, 4],
    [16, 4, 4],
    [17, 5, 4],
    [23, 5, 4],
    [24, 5, 8],
    [31, 5, 8],
    [32, 6, 8],
    [64, 6, 8],
    [200, 6, 8],
  ])("%i人 → スイス%i回戦 / トップカット%s", (count, rounds, cut) => {
    const plan = resolveRoundPlan(count);
    expect(plan.swissRounds).toBe(rounds);
    expect(plan.topCutSize).toBe(cut);
  });

  test("参加者0でも回戦数を返す", () => {
    expect(resolveRoundPlan(0).swissRounds).toBe(3);
  });

  test("数値でない入力でも壊れない", () => {
    expect(resolveRoundPlan(undefined).swissRounds).toBe(3);
    expect(resolveRoundPlan("abc").swissRounds).toBe(3);
  });

  test("トップカットの値は既存の選択肢(4/8/16)に収まる", () => {
    const allowed = new Set([4, 8, 16]);
    [1, 8, 9, 17, 24, 32, 100].forEach((n) => {
      const { topCutSize } = resolveRoundPlan(n);
      if (topCutSize != null) expect(allowed.has(topCutSize)).toBe(true);
    });
  });
});

describe("表示", () => {
  test("トップカットなしは回戦数だけ出す", () => {
    expect(formatRoundPlan(resolveRoundPlan(8))).toBe("スイス3回戦");
  });

  test("トップカットありは人数を添える", () => {
    expect(formatRoundPlan(resolveRoundPlan(24))).toBe(
      "スイス5回戦 + 上位8名の決勝トーナメント"
    );
  });

  test("設定画面用の一覧は区間が連続していて重複しない", () => {
    const rows = describeRoundPlanTable();
    expect(rows.map((r) => r.range)).toEqual([
      "1〜4人",
      "5〜8人",
      "9〜16人",
      "17〜23人",
      "24〜31人",
      "32人以上",
    ]);
  });
});
