import { computeStandings } from "./standings";

const entries = ["A", "B", "C", "D"].map((id) => ({ id, status: "checked_in" }));

describe("computeStandings", () => {
  it("sorts by points before opponent match win percentage", () => {
    const standings = computeStandings(entries, [
      { player1EntryId: "A", player2EntryId: "B", result: "p1_win" },
      { player1EntryId: "B", player2EntryId: "C", result: "p1_win" },
      { player1EntryId: "C", player2EntryId: "D", result: "p1_win" },
      { player1EntryId: "D", player2EntryId: "A", result: "p1_win" },
      { player1EntryId: "A", player2EntryId: "C", result: "p1_win" },
    ]);

    expect(standings[0].entryId).toBe("A");
    expect(standings[0].points).toBe(6);
  });

  it("uses OMW% before head-to-head for tied points", () => {
    const standings = computeStandings(entries, [
      { player1EntryId: "B", player2EntryId: "A", result: "p1_win" },
      { player1EntryId: "A", player2EntryId: "C", result: "p1_win" },
      { player1EntryId: "D", player2EntryId: "A", result: "p1_win" },
      { player1EntryId: "D", player2EntryId: "C", result: "p1_win" },
    ]);

    expect(standings.findIndex((standing) => standing.entryId === "A")).toBeLessThan(
      standings.findIndex((standing) => standing.entryId === "B")
    );
  });

  it("uses head-to-head after tied points and tied OMW%", () => {
    const standings = computeStandings(entries, [
      { player1EntryId: "A", player2EntryId: "B", result: "p1_win" },
      { player1EntryId: "B", player2EntryId: "C", result: "p1_win" },
      { player1EntryId: "D", player2EntryId: "A", result: "p1_win" },
      { player1EntryId: "C", player2EntryId: "D", result: "p1_win" },
    ]);

    expect(standings.findIndex((standing) => standing.entryId === "A")).toBeLessThan(
      standings.findIndex((standing) => standing.entryId === "B")
    );
  });

  it("floors opponent match win percentage at one third", () => {
    const standings = computeStandings(entries.slice(0, 3), [
      { player1EntryId: "A", player2EntryId: "B", result: "p1_win" },
      { player1EntryId: "C", player2EntryId: "B", result: "p1_win" },
    ]);

    expect(standings.find((standing) => standing.entryId === "A").omwPercent).toBeCloseTo(1 / 3);
  });

  it("excludes bye wins from an opponent's OMW% denominator", () => {
    const standings = computeStandings(entries.slice(0, 3), [
      { player1EntryId: "B", player2EntryId: null, result: "bye" },
      { player1EntryId: "B", player2EntryId: "C", result: "p1_win" },
      { player1EntryId: "B", player2EntryId: "A", result: "p1_win" },
    ]);

    expect(standings.find((standing) => standing.entryId === "A").omwPercent).toBeCloseTo(1);
  });

  it("counts rounds before joinedAtRound as losses without affecting OMW%", () => {
    const standings = computeStandings(
      [
        { id: "A", status: "checked_in" },
        { id: "B", status: "checked_in" },
        { id: "C", status: "registered", joinedAtRound: 3 },
      ],
      [
        { player1EntryId: "C", player2EntryId: "A", result: "p1_win" },
      ]
    );

    const late = standings.find((standing) => standing.entryId === "C");
    expect(late.losses).toBe(2);
    expect(late.points).toBe(3);
    expect(late.omwPercent).toBeCloseTo(1 / 3);
  });
});
