import { compareEntryIds, computeStandings } from "./standings";

function hasBye(entryId, previousMatches) {
  return previousMatches.some(
    (match) =>
      match.player1EntryId === entryId &&
      (match.player2EntryId == null || match.result === "bye")
  );
}

function pairKey(a, b) {
  return [a, b].sort(compareEntryIds).join("::");
}

function buildPreviousOpponentSet(previousMatches) {
  return new Set(
    previousMatches
      .filter((match) => match.player1EntryId != null && match.player2EntryId != null)
      .map((match) => pairKey(match.player1EntryId, match.player2EntryId))
  );
}

function chooseByeEntry(standings, previousMatches) {
  const candidates = standings
    .slice()
    .sort((a, b) => {
      if (a.points !== b.points) return a.points - b.points;
      return compareEntryIds(a.entryId, b.entryId);
    });

  return (
    candidates.find((standing) => !hasBye(standing.entryId, previousMatches))?.entryId ??
    candidates[0]?.entryId ??
    null
  );
}

function searchPairings(players, previousOpponents, allowRematches) {
  if (players.length === 0) {
    return [];
  }

  const [first, ...rest] = players;
  const candidates = rest
    .map((opponent, index) => ({
      opponent,
      index,
      hasPlayed: previousOpponents.has(pairKey(first.entryId, opponent.entryId)),
      pointGap: Math.abs(first.points - opponent.points),
    }))
    .filter((candidate) => allowRematches || !candidate.hasPlayed)
    .sort((a, b) => {
      if (a.pointGap !== b.pointGap) return a.pointGap - b.pointGap;
      return compareEntryIds(a.opponent.entryId, b.opponent.entryId);
    });

  for (const candidate of candidates) {
    const remaining = rest.slice(0, candidate.index).concat(rest.slice(candidate.index + 1));
    const child = searchPairings(remaining, previousOpponents, allowRematches);
    if (child) {
      return [
        {
          player1EntryId: first.entryId,
          player2EntryId: candidate.opponent.entryId,
        },
        ...child,
      ];
    }
  }

  return null;
}

export function pairSwissRound(entries, previousMatches, standingsEntries = entries) {
  const activeEntries = entries.filter((entry) => entry.status !== "dropped");
  if (activeEntries.length === 0) return [];

  const activeEntryIds = new Set(activeEntries.map((entry) => entry.id));
  const standings = computeStandings(standingsEntries, previousMatches).filter((standing) =>
    activeEntryIds.has(standing.entryId)
  );
  const standingsByEntryId = new Map(standings.map((standing) => [standing.entryId, standing]));
  const previousOpponents = buildPreviousOpponentSet(previousMatches);
  const pairs = [];
  const byeEntryId = activeEntries.length % 2 === 1 ? chooseByeEntry(standings, previousMatches) : null;

  if (byeEntryId != null) {
    pairs.push({ player1EntryId: byeEntryId, player2EntryId: null });
  }

  const players = activeEntries
    .filter((entry) => entry.id !== byeEntryId)
    .map((entry) => {
      const standing = standingsByEntryId.get(entry.id);
      return {
        entryId: entry.id,
        points: standing?.points ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return compareEntryIds(a.entryId, b.entryId);
    });

  const result =
    searchPairings(players, previousOpponents, false) ??
    searchPairings(players, previousOpponents, true);
  return pairs.concat(result ?? []);
}
