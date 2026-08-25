import { getRoundLabel, getRoundLabelForNumber, getRoundProgressLabel } from "./roundLabel";

describe("getRoundLabel", () => {
  const rounds = [
    { id: "top-cut-2", number: 6, stage: "top_cut" },
    { id: "swiss-2", number: 2, stage: "swiss" },
    { id: "top-cut-1", number: 5, stage: "top_cut" },
    { id: "swiss-1", number: 1, stage: "swiss" },
    { id: "swiss-4", number: 4, stage: "swiss" },
    { id: "swiss-3", number: 3, stage: "swiss" },
  ];

  it("keeps the global number for Swiss rounds", () => {
    expect(getRoundLabel(rounds.find((round) => round.id === "swiss-4"), rounds)).toBe(
      "第4回戦"
    );
  });

  it("numbers top-cut rounds from one independently of the global number", () => {
    expect(getRoundLabel(rounds.find((round) => round.id === "top-cut-1"), rounds)).toBe(
      "SE1回戦"
    );
    expect(getRoundLabel(rounds.find((round) => round.id === "top-cut-2"), rounds)).toBe(
      "SE2回戦"
    );
  });

  it("treats a legacy round without a stage as Swiss", () => {
    expect(getRoundLabel({ number: 3 }, rounds)).toBe("第3回戦");
  });

  it("adds the fixed Swiss total only to Swiss progress labels", () => {
    const tournament = { swissRounds: 4 };

    expect(
      getRoundProgressLabel(
        rounds.find((round) => round.id === "swiss-2"),
        rounds,
        tournament
      )
    ).toBe("第2回戦 / 全4回戦");
    expect(
      getRoundProgressLabel(
        rounds.find((round) => round.id === "top-cut-1"),
        rounds,
        tournament
      )
    ).toBe("SE1回戦");
  });

  it("projects the next top-cut label from tournament settings", () => {
    expect(
      getRoundLabelForNumber(5, rounds.filter((round) => round.number <= 4), {
        format: "swiss",
        swissRounds: 4,
        topCutSize: 8,
      })
    ).toBe("SE1回戦");
    expect(getRoundLabelForNumber(1, [], { format: "single_elim" })).toBe("SE1回戦");
  });
});
