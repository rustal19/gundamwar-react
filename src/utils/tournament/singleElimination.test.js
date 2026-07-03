import { buildBracket, nextRoundPairs } from "./singleElimination";

describe("single elimination helpers", () => {
  it("gives byes to top seeds when the field is below a power of two", () => {
    expect(buildBracket(["1", "2", "3", "4", "5", "6"])).toEqual([
      { player1EntryId: "1", player2EntryId: null },
      { player1EntryId: "4", player2EntryId: "5" },
      { player1EntryId: "2", player2EntryId: null },
      { player1EntryId: "3", player2EntryId: "6" },
    ]);
  });

  it("pairs winners in match order for the next round", () => {
    const matches = [
      { player1EntryId: "1", player2EntryId: null, result: "bye" },
      { player1EntryId: "4", player2EntryId: "5", result: "p1_win" },
      { player1EntryId: "2", player2EntryId: null, result: "bye" },
      { player1EntryId: "3", player2EntryId: "6", result: "p2_win" },
    ];

    expect(nextRoundPairs(matches)).toEqual([
      { player1EntryId: "1", player2EntryId: "4" },
      { player1EntryId: "2", player2EntryId: "6" },
    ]);
  });

  it("keeps the first and second seeds apart until the final in a six-player bracket", () => {
    const firstRound = buildBracket(["1", "2", "3", "4", "5", "6"]);
    const semifinals = nextRoundPairs([
      { ...firstRound[0], result: "bye" },
      { ...firstRound[1], result: "p1_win" },
      { ...firstRound[2], result: "bye" },
      { ...firstRound[3], result: "p1_win" },
    ]);
    const final = nextRoundPairs([
      { ...semifinals[0], result: "p1_win" },
      { ...semifinals[1], result: "p1_win" },
    ]);

    expect(semifinals).toEqual([
      { player1EntryId: "1", player2EntryId: "4" },
      { player1EntryId: "2", player2EntryId: "3" },
    ]);
    expect(final).toEqual([{ player1EntryId: "1", player2EntryId: "2" }]);
  });
});
