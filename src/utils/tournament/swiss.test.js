import {
  SWISS_END_CONDITION_FIXED_ROUNDS,
  SWISS_END_CONDITION_UNDEFEATED,
  getSwissEndCondition,
  getSwissEndConditionLabel,
  getSwissRoundSummary,
} from "./swiss";

describe("Swiss tournament settings", () => {
  it("treats a missing end condition as fixed rounds for legacy data", () => {
    expect(getSwissEndCondition({})).toBe(SWISS_END_CONDITION_FIXED_ROUNDS);
    expect(getSwissEndConditionLabel({})).toBe("規定回戦数で終了");
  });

  it("recognizes the undefeated mode and formats a fixed round count", () => {
    const tournament = {
      swissEndCondition: SWISS_END_CONDITION_UNDEFEATED,
      swissRounds: 4,
    };

    expect(getSwissEndCondition(tournament)).toBe(SWISS_END_CONDITION_UNDEFEATED);
    expect(getSwissEndConditionLabel(tournament)).toBe(
      "全勝者が1人以下になったら終了"
    );
    expect(getSwissRoundSummary(tournament)).toBe("全4回戦");
  });

  it("does not present an unfixed automatic count as final", () => {
    expect(getSwissRoundSummary({ swissRounds: null })).toBe(
      "自動（初戦生成時に確定）"
    );
  });
});
