import { computeStandings } from "./tournament/standings";

function toId(value) {
  return value == null ? "" : String(value);
}

function findUserEntry(entries, userId) {
  const targetId = toId(userId);
  return (Array.isArray(entries) ? entries : []).find(
    (entry) => toId(entry.user?.id) === targetId && entry.status !== "dropped"
  );
}

function flattenMatches(rounds) {
  return (Array.isArray(rounds) ? rounds : []).flatMap((round) =>
    Array.isArray(round.matches) ? round.matches : []
  );
}

function standingsForTournament(item) {
  const standings = item.standings || item.tournament?.standings;
  if (Array.isArray(standings) && standings.length > 0) return standings;
  const entries = item.entries || item.tournament?.entries || [];
  return computeStandings(entries, flattenMatches(item.rounds || item.tournament?.rounds || []));
}

function countPublicDecks(publicDecks, userId) {
  const targetId = toId(userId);
  return (Array.isArray(publicDecks) ? publicDecks : []).filter(
    (deck) => deck.isPublic !== false && toId(deck.owner?.id) === targetId
  ).length;
}

export function computeUserResults(userId, tournamentsWithRounds = [], publicDecks = []) {
  const targetId = toId(userId);
  const tournaments = Array.isArray(tournamentsWithRounds) ? tournamentsWithRounds : [];
  const enteredItems = tournaments.filter((item) =>
    findUserEntry(item.entries || item.tournament?.entries || [], targetId)
  );

  const results = enteredItems
    .filter((item) => (item.tournament || item).status === "completed")
    .map((item) => {
      const tournament = item.tournament || item;
      const entry = findUserEntry(item.entries || tournament.entries || [], targetId);
      const standing = standingsForTournament(item).find(
        (standingItem) => toId(standingItem.entryId) === toId(entry?.id)
      );
      if (!entry || !standing) return null;
      return {
        tournament,
        entry,
        rank: Number(standing.rank || 0),
        wins: Number(standing.wins || 0),
        losses: Number(standing.losses || 0),
        draws: Number(standing.draws || 0),
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      String(right.tournament.startsAt || "").localeCompare(String(left.tournament.startsAt || ""))
    );

  const record = results.reduce(
    (sum, result) => ({
      wins: sum.wins + result.wins,
      losses: sum.losses + result.losses,
      draws: sum.draws + result.draws,
    }),
    { wins: 0, losses: 0, draws: 0 }
  );

  return {
    metrics: {
      tournamentCount: enteredItems.length,
      championshipCount: results.filter((result) => result.rank === 1).length,
      record,
      publicDeckCount: countPublicDecks(publicDecks, targetId),
    },
    results,
  };
}

// 「3-2-1」は勝敗分の順序を知っている人にしか読めないので、単位を付ける。
export function formatRecord(record) {
  const wins = Number(record?.wins || 0);
  const losses = Number(record?.losses || 0);
  const draws = Number(record?.draws || 0);
  return `${wins}勝${losses}敗${draws}分`;
}
