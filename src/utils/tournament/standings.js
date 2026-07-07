const RESULT_POINTS = {
  p1_win: [3, 0],
  p2_win: [0, 3],
  draw: [1, 1],
  bye: [3, 0],
};

export function compareEntryIds(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function createRecord(entryId) {
  return {
    entryId,
    rank: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    matchPoints: 0,
    omwPercent: 0,
    opponents: [],
  };
}

function joinedAtRound(entry) {
  const round = Number(entry?.joinedAtRound ?? 1);
  return Number.isFinite(round) && round > 1 ? Math.floor(round) : 1;
}

function isCompletedMatch(match) {
  return match && match.result && RESULT_POINTS[match.result];
}

function applyMatch(records, match) {
  if (!isCompletedMatch(match)) return;

  const p1 = records.get(match.player1EntryId);
  const p2 = match.player2EntryId == null ? null : records.get(match.player2EntryId);
  if (!p1 || (match.player2EntryId != null && !p2)) return;

  if (match.result === "bye") {
    p1.wins += 1;
    p1.points += 3;
    return;
  }

  const [p1Points, p2Points] = RESULT_POINTS[match.result];
  p1.points += p1Points;
  p2.points += p2Points;
  p1.matchPoints += p1Points;
  p2.matchPoints += p2Points;
  p1.opponents.push(p2.entryId);
  p2.opponents.push(p1.entryId);

  if (match.result === "draw") {
    p1.draws += 1;
    p2.draws += 1;
  } else if (match.result === "p1_win") {
    p1.wins += 1;
    p2.losses += 1;
  } else if (match.result === "p2_win") {
    p2.wins += 1;
    p1.losses += 1;
  }
}

function opponentMatchWinPercent(record) {
  const played = record.opponents.length;
  if (played === 0) return 1 / 3;
  return Math.max(1 / 3, record.matchPoints / (played * 3));
}

function headToHeadWins(recordA, recordB, matches) {
  return matches.reduce((wins, match) => {
    if (!isCompletedMatch(match) || match.player2EntryId == null || match.result === "draw") {
      return wins;
    }

    const isAPlayer1 = match.player1EntryId === recordA.entryId && match.player2EntryId === recordB.entryId;
    const isAPlayer2 = match.player2EntryId === recordA.entryId && match.player1EntryId === recordB.entryId;
    if ((isAPlayer1 && match.result === "p1_win") || (isAPlayer2 && match.result === "p2_win")) {
      return wins + 1;
    }
    return wins;
  }, 0);
}

export function computeStandings(entries, matches) {
  const records = new Map(
    entries
      .filter((entry) => entry.status !== "dropped")
      .sort((a, b) => compareEntryIds(a.id, b.id))
      .map((entry) => [entry.id, createRecord(entry.id)])
  );

  entries.forEach((entry) => {
    const record = records.get(entry.id);
    if (!record) return;
    record.losses += Math.max(0, joinedAtRound(entry) - 1);
  });

  matches.forEach((match) => applyMatch(records, match));

  records.forEach((record) => {
    if (record.opponents.length === 0) {
      record.omwPercent = 0;
      return;
    }

    const total = record.opponents.reduce((sum, opponentId) => {
      const opponent = records.get(opponentId);
      return sum + (opponent ? opponentMatchWinPercent(opponent) : 0);
    }, 0);
    record.omwPercent = total / record.opponents.length;
  });

  const sorted = Array.from(records.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.omwPercent !== a.omwPercent) return b.omwPercent - a.omwPercent;

    const aWins = headToHeadWins(a, b, matches);
    const bWins = headToHeadWins(b, a, matches);
    if (bWins !== aWins) return bWins - aWins;

    return compareEntryIds(a.entryId, b.entryId);
  });

  return sorted.map((record, index) => ({
    entryId: record.entryId,
    rank: index + 1,
    wins: record.wins,
    losses: record.losses,
    draws: record.draws,
    points: record.points,
    omwPercent: record.omwPercent,
  }));
}
