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

function pairingSignature(pairs) {
  return pairs
    .map((pair) => `${pair.player1EntryId}:${pair.player2EntryId}`)
    .join("|");
}

function betterCandidate(candidate, best) {
  if (!best) return true;
  if (candidate.rematches !== best.rematches) return candidate.rematches < best.rematches;
  if (candidate.crossGroups !== best.crossGroups) return candidate.crossGroups < best.crossGroups;
  return pairingSignature(candidate.pairs) < pairingSignature(best.pairs);
}

function searchPairings(players, previousOpponents) {
  if (players.length === 0) {
    return { pairs: [], rematches: 0, crossGroups: 0 };
  }

  const [first, ...rest] = players;
  let best = null;

  rest.forEach((opponent, index) => {
    const remaining = rest.slice(0, index).concat(rest.slice(index + 1));
    const child = searchPairings(remaining, previousOpponents);
    if (!child) return;

    const isRematch = previousOpponents.has(pairKey(first.entryId, opponent.entryId)) ? 1 : 0;
    const isCrossGroup = first.points === opponent.points ? 0 : 1;
    const pair = {
      player1EntryId: first.entryId,
      player2EntryId: opponent.entryId,
    };
    const candidate = {
      pairs: [pair, ...child.pairs],
      rematches: isRematch + child.rematches,
      crossGroups: isCrossGroup + child.crossGroups,
    };

    if (betterCandidate(candidate, best)) best = candidate;
  });

  return best;
}

export function pairSwissRound(entries, previousMatches) {
  const activeEntries = entries.filter((entry) => entry.status !== "dropped");
  if (activeEntries.length === 0) return [];

  const standings = computeStandings(activeEntries, previousMatches);
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

  const result = searchPairings(players, previousOpponents);
  return pairs.concat(result ? result.pairs : []);
}
