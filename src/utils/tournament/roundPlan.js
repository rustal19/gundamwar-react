// 参加人数から「スイスの回戦数」と「トップカット人数」を決める表。
//
// 主催者が大会ごとに手で決めてもよいが、人数によって定石が変わるため、
// 「参加人数に応じて自動」モードではこの表を使う。
//
// 4人以下の3回戦は、再戦を避けるスイスの性質上そのまま総当たりになる
// (4人なら全員が他の3人と1回ずつ、3人なら不戦勝を挟んで同じ)。
// このため総当たり専用の形式は設けていない。
//
// この表はモック・API・画面の3か所で同じ値を使う必要がある。
// API 側の写しは gundamwar-api/lib/roundPlan.js。片方だけ変えないこと。
export const ROUND_PLAN_TABLE = [
  { maxEntries: 4, swissRounds: 3, topCutSize: null, note: "総当たり(全員と1回ずつ)" },
  { maxEntries: 8, swissRounds: 3, topCutSize: null, note: "スイスのみ" },
  { maxEntries: 16, swissRounds: 4, topCutSize: 4, note: "上位4名で決勝トーナメント" },
  { maxEntries: 23, swissRounds: 5, topCutSize: 4, note: "上位4名で決勝トーナメント" },
  { maxEntries: 31, swissRounds: 5, topCutSize: 8, note: "上位8名で決勝トーナメント" },
  { maxEntries: Infinity, swissRounds: 6, topCutSize: 8, note: "上位8名で決勝トーナメント" },
];

// 回戦数とトップカットを人数から決める。参加者0でも1回戦は組めるようにする。
export function resolveRoundPlan(entryCount) {
  const count = Number.isFinite(Number(entryCount)) ? Math.max(0, Number(entryCount)) : 0;
  const row = ROUND_PLAN_TABLE.find(({ maxEntries }) => count <= maxEntries);
  return {
    entryCount: count,
    swissRounds: row.swissRounds,
    topCutSize: row.topCutSize,
    note: row.note,
  };
}

export function formatRoundPlan(plan) {
  if (!plan) return "";
  const cut = plan.topCutSize
    ? ` + 上位${plan.topCutSize}名の決勝トーナメント`
    : "";
  return `スイス${plan.swissRounds}回戦${cut}`;
}

// 設定画面に出す一覧。境界を人が読める形にする。
export function describeRoundPlanTable() {
  let lower = 1;
  return ROUND_PLAN_TABLE.map((row) => {
    const range =
      row.maxEntries === Infinity ? `${lower}人以上` : `${lower}〜${row.maxEntries}人`;
    const label = formatRoundPlan(row);
    lower = row.maxEntries + 1;
    return { range, label, note: row.note };
  });
}
