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

  it("excludes unchecked and checked-in waitlisted entries", () => {
    const tournamentEntries = [
      { id: "1", status: "checked_in" },
      { id: "2", status: "checked_in" },
      { id: "3", status: "registered" },
      { id: "4", status: "pending" },
      { id: "5", status: "checked_in", isWaitlisted: true },
    ];

    expect(pairSwissRound(tournamentEntries, [])).toEqual([
      { player1EntryId: "1", player2EntryId: "2" },
    ]);
  });

  it("uses results against dropped opponents when choosing the next bye", () => {
    const activeEntries = entries(["A", "C", "D"]);
    const standingsEntries = [
      ...activeEntries,
      { id: "B", status: "dropped" },
    ];
    const pairs = pairSwissRound(
      activeEntries,
      [{ player1EntryId: "A", player2EntryId: "B", result: "p1_win" }],
      standingsEntries
    );

    expect(pairs[0]).toEqual({ player1EntryId: "C", player2EntryId: null });
    expect(pairs.flatMap((pair) => [pair.player1EntryId, pair.player2EntryId])).not.toContain(
      "B"
    );
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

  it("generates five consecutive rounds for forty players in practical time", () => {
    const tournamentEntries = entries(
      Array.from({ length: 40 }, (_, index) => String(index + 1))
    );
    const previousMatches = [];
    const startedAt = Date.now();

    for (let round = 0; round < 5; round += 1) {
      const pairs = pairSwissRound(tournamentEntries, previousMatches);
      const paired = new Set();

      expect(pairs).toHaveLength(20);
      pairs.forEach((pair) => {
        expect(paired.has(pair.player1EntryId)).toBe(false);
        expect(paired.has(pair.player2EntryId)).toBe(false);
        paired.add(pair.player1EntryId);
        paired.add(pair.player2EntryId);

        previousMatches.push({
          player1EntryId: pair.player1EntryId,
          player2EntryId: pair.player2EntryId,
          result: "p1_win",
        });
      });
    }

    expect(Date.now() - startedAt).toBeLessThan(3000);
  });
});
