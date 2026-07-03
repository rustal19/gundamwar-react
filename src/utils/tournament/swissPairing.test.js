import { pairSwissRound } from "./swissPairing";

const entries = (ids) => ids.map((id) => ({ id, status: "checked_in" }));

describe("pairSwissRound", () => {
  it("assigns an odd-player bye to a lowest-score player without a previous bye", () => {
    const previousMatches = [
      { player1EntryId: "1", player2EntryId: null, result: "bye" },
      { player1EntryId: "2", player2EntryId: "3", result: "p1_win" },
    ];

    expect(pairSwissRound(entries(["1", "2", "3"]), previousMatches)[0]).toEqual({
      player1EntryId: "3",
      player2EntryId: null,
    });
  });

  it("avoids rematches within the same score group when possible", () => {
    const previousMatches = [
      { player1EntryId: "1", player2EntryId: "2", result: "draw" },
      { player1EntryId: "3", player2EntryId: "4", result: "draw" },
    ];

    expect(pairSwissRound(entries(["1", "2", "3", "4"]), previousMatches)).toEqual([
      { player1EntryId: "1", player2EntryId: "3" },
      { player1EntryId: "2", player2EntryId: "4" },
    ]);
  });

  it("excludes dropped entries", () => {
    const tournamentEntries = [
      { id: "1", status: "checked_in" },
      { id: "2", status: "checked_in" },
      { id: "3", status: "dropped" },
    ];

    expect(pairSwissRound(tournamentEntries, [])).toEqual([
      { player1EntryId: "1", player2EntryId: "2" },
    ]);
  });

  it("is deterministic for the same input", () => {
    const tournamentEntries = entries(["4", "2", "1", "3", "5"]);
    const previousMatches = [
      { player1EntryId: "1", player2EntryId: "2", result: "p1_win" },
      { player1EntryId: "3", player2EntryId: "4", result: "p2_win" },
    ];

    expect(pairSwissRound(tournamentEntries, previousMatches)).toEqual(
      pairSwissRound(tournamentEntries, previousMatches)
    );
  });
});
