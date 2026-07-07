import { getMyStatusPhase } from "./TournamentMyStatus";

const entry = { id: "entry-1", status: "registered" };

describe("getMyStatusPhase", () => {
  it("returns before_start for an entered registration tournament before the start date", () => {
    const phase = getMyStatusPhase(
      { status: "registration", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      entry,
      [],
      new Date(2026, 6, 11, 23, 59)
    );

    expect(phase).toBe("before_start");
  });

  it("returns checkin on the start date before rounds are generated", () => {
    const phase = getMyStatusPhase(
      { status: "registration", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      entry,
      [],
      new Date(2026, 6, 12, 8, 0)
    );

    expect(phase).toBe("checkin");
  });

  it("returns round once at least one round exists", () => {
    const phase = getMyStatusPhase(
      { status: "in_progress", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      entry,
      [{ id: "round-1", number: 1, matches: [] }],
      new Date(2026, 6, 12, 10, 30)
    );

    expect(phase).toBe("round");
  });

  it("returns not_entered without my entry", () => {
    const phase = getMyStatusPhase(
      { status: "registration", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      null,
      [],
      new Date(2026, 6, 11, 10, 0)
    );

    expect(phase).toBe("not_entered");
  });
});
