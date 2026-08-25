export const SWISS_END_CONDITION_FIXED_ROUNDS = "fixed_rounds";
export const SWISS_END_CONDITION_UNDEFEATED = "undefeated";

export function normalizeSwissEndCondition(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === SWISS_END_CONDITION_UNDEFEATED ||
    normalized.includes("undefeat") ||
    normalized.includes("all_win") ||
    normalized.includes("全勝")
  ) {
    return SWISS_END_CONDITION_UNDEFEATED;
  }
  return SWISS_END_CONDITION_FIXED_ROUNDS;
}

export function getSwissEndCondition(tournament) {
  return normalizeSwissEndCondition(
    tournament?.swissEndCondition ??
      tournament?.swissEndConditionMode ??
      tournament?.endConditionMode ??
      tournament?.endCondition
  );
}

export function getSwissEndConditionLabel(tournament) {
  return getSwissEndCondition(tournament) === SWISS_END_CONDITION_UNDEFEATED
    ? "全勝者が1人以下になったら終了"
    : "規定回戦数で終了";
}

export function getSwissRoundCount(tournament) {
  const count = Number(tournament?.swissRounds);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function getSwissRoundSummary(tournament) {
  const count = getSwissRoundCount(tournament);
  return count ? `全${count}回戦` : "自動（初戦生成時に確定）";
}
