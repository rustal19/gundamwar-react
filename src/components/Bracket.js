import React from "react";

function findEntry(entries, entryId) {
  return (Array.isArray(entries) ? entries : []).find((entry) => entry.id === entryId) || null;
}

function winnerEntryId(match) {
  if (match.winnerEntryId != null) return match.winnerEntryId;
  if (match.result === "bye" || match.player2EntryId == null) return match.player1EntryId;
  if (match.result === "p1_win") return match.player1EntryId;
  if (match.result === "p2_win") return match.player2EntryId;
  return null;
}

function playerName(entries, entryId) {
  if (entryId == null) return "未定";
  const entry = findEntry(entries, entryId);
  return entry?.user?.name || entryId;
}

export default function Bracket({ rounds, entries, showResults = false }) {
  const topCutRounds = (Array.isArray(rounds) ? rounds : [])
    .filter((round) => round.stage === "top_cut")
    .slice()
    .sort((left, right) => Number(left.number) - Number(right.number));

  if (!topCutRounds.length) return null;

  return (
    <div className="tournament-bracket" aria-label="トーナメント表">
      {topCutRounds.map((round, roundIndex) => {
        const matches = (round.matches || [])
          .slice()
          .sort((left, right) => Number(left.tableNo || 0) - Number(right.tableNo || 0));
        const isFinal = roundIndex === topCutRounds.length - 1;
        return (
          <section
            key={round.id}
            className={isFinal ? "bracket-round final" : "bracket-round"}
          >
            <h3>第{round.number}回戦</h3>
            <div className="bracket-match-list">
              {matches.map((match) => {
                const winner = winnerEntryId(match);
                const players = [match.player1EntryId, match.player2EntryId];
                return (
                  <div key={match.id} className="bracket-match">
                    <div className="bracket-table">卓 {match.tableNo || "-"}</div>
                    {players.map((entryId, playerIndex) => {
                      const isWinner = winner != null && entryId === winner;
                      const isPending = entryId == null;
                      return (
                        <div
                          key={`${match.id}-${playerIndex}`}
                          className={[
                            "bracket-player",
                            isWinner ? "winner" : "",
                            isPending ? "pending" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span>{playerName(entries, entryId)}</span>
                          {isWinner ? <strong>✓</strong> : null}
                        </div>
                      );
                    })}
                    {showResults ? <div className="bracket-result">{match.result || "未報告"}</div> : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
