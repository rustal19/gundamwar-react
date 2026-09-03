import { computeUserResults, formatRecord } from "./userResults";

function entry(id, userId) {
  return {
    id,
    tournamentId: "t1",
    user: { id: userId, name: userId },
    status: "checked_in",
    joinedAtRound: 1,
  };
}

describe("computeUserResults", () => {
  it("computes profile metrics and completed tournament results", () => {
    const myEntry = entry("e1", "u1");
    const otherEntry = entry("e2", "u2");
    const output = computeUserResults(
      "u1",
      [
        {
          tournament: { id: "t1", title: "Championship", status: "completed", startsAt: "2026-07-01" },
          entries: [myEntry, otherEntry],
          standings: [{ entryId: "e1", rank: 1, wins: 3, losses: 0, draws: 1 }],
        },
        {
          tournament: { id: "t2", title: "Open", status: "registration", startsAt: "2026-08-01" },
          entries: [entry("e3", "u1")],
        },
      ],
      [
        { id: "d1", isPublic: true, owner: { id: "u1" } },
        { id: "d2", isPublic: false, owner: { id: "u1" } },
        { id: "d3", isPublic: true, owner: { id: "u2" } },
      ]
    );

    expect(output.metrics).toEqual({
      tournamentCount: 2,
      championshipCount: 1,
      record: { wins: 3, losses: 0, draws: 1 },
      publicDeckCount: 1,
    });
    expect(output.results).toEqual([
      expect.objectContaining({ rank: 1, wins: 3, losses: 0, draws: 1 }),
    ]);
    expect(formatRecord(output.metrics.record)).toBe("3勝0敗1分");
  });

  it("falls back to rounds when standings are not supplied", () => {
    const output = computeUserResults("u1", [
      {
        tournament: { id: "t1", title: "Round Cup", status: "completed" },
        entries: [entry("e1", "u1"), entry("e2", "u2")],
        rounds: [
          {
            id: "r1",
            status: "completed",
            matches: [{ id: "m1", player1EntryId: "e1", player2EntryId: "e2", result: "p1_win" }],
          },
        ],
      },
    ]);

    expect(output.results[0]).toMatchObject({ rank: 1, wins: 1, losses: 0, draws: 0 });
  });
});
