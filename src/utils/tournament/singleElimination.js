function nextPowerOfTwo(value) {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

function winnerOf(match) {
  if (match.winnerEntryId != null) return match.winnerEntryId;
  if (match.result === "bye" || match.player2EntryId == null) return match.player1EntryId;
  if (match.result === "p1_win") return match.player1EntryId;
  if (match.result === "p2_win") return match.player2EntryId;
  return null;
}

export function buildBracket(entryIds) {
  const bracketSize = nextPowerOfTwo(entryIds.length);
  const byeCount = bracketSize - entryIds.length;
  const seededByes = entryIds.slice(0, byeCount).map((entryId) => ({
    player1EntryId: entryId,
    player2EntryId: null,
  }));

  const remaining = entryIds.slice(byeCount);
  const playedMatches = [];
  for (let i = 0; i < remaining.length / 2; i += 1) {
    playedMatches.push({
      player1EntryId: remaining[i],
      player2EntryId: remaining[remaining.length - 1 - i],
    });
  }

  return seededByes.concat(playedMatches);
}

export function nextRoundPairs(matches) {
  const winners = matches.map(winnerOf).filter((entryId) => entryId != null);
  return winners
    .reduce((pairs, entryId, index, sortedWinners) => {
      if (index % 2 === 0) {
        pairs.push({
          player1EntryId: entryId,
          player2EntryId: sortedWinners[index + 1] ?? null,
        });
      }
      return pairs;
    }, []);
}
