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
});
