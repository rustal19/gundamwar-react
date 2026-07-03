function nextPowerOfTwo(value) {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

function seedOrder(size) {
  if (size === 1) return [1];
  return seedOrder(size / 2).flatMap((seed) => [seed, size + 1 - seed]);
}

function winnerOf(match) {
  if (match.winnerEntryId != null) return match.winnerEntryId;
  if (match.result === "bye" || match.player2EntryId == null) return match.player1EntryId;
  if (match.result === "p1_win") return match.player1EntryId;
  if (match.result === "p2_win") return match.player2EntryId;
  return null;
}

export function buildBracket(entryIds) {
  if (entryIds.length === 0) return [];
  if (entryIds.length === 1) {
    return [{ player1EntryId: entryIds[0], player2EntryId: null }];
  }

  const bracketSize = nextPowerOfTwo(entryIds.length);
  const slots = seedOrder(bracketSize).map((seed) => entryIds[seed - 1] ?? null);
  const matches = [];

  for (let i = 0; i < slots.length; i += 2) {
    const [player1EntryId, player2EntryId] = [slots[i], slots[i + 1]];
    matches.push(
      player1EntryId == null
        ? { player1EntryId: player2EntryId, player2EntryId: null }
        : { player1EntryId, player2EntryId }
    );
  }

  return matches;
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
