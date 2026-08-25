import React, { useMemo } from "react";
import { getRoundLabel } from "../utils/tournament/roundLabel";
import { createTournamentParticipantNameFormatter } from "../utils/tournament/participantDisplayName";

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

function playerName(entries, entryId, formatParticipantName) {
  if (entryId == null) return "未定";
  const entry = findEntry(entries, entryId);
  return formatParticipantName(entry, entryId);
}

function resultLabel(result) {
  if (result === "p1_win") return "P1勝利";
  if (result === "p2_win") return "P2勝利";
  if (result === "draw") return "引き分け";
  if (result === "bye") return "不戦勝";
  return "未報告";
}

function matchScoreLabel(match) {
  if (match.result === "bye") return "不戦勝";
  if (match.result == null) return "未報告";
  if (match.player1Games == null || match.player2Games == null) {
    return resultLabel(match.result);
  }
  return `${match.player1Games} - ${match.player2Games}（${resultLabel(match.result)}）`;
}

export default function Bracket({ rounds, entries, showResults = false }) {
  const formatParticipantName = useMemo(
    () => createTournamentParticipantNameFormatter(entries),
    [entries]
  );
  const topCutRounds = (Array.isArray(rounds) ? rounds : [])
    .filter((round) => round.stage === "top_cut")
    .slice()
    .sort((left, right) => Number(left.number) - Number(right.number));

  if (!topCutRounds.length) return null;

  return (
    <div className="tournament-bracket" aria-label="トーナメント表">
      {topCutRounds.map((round) => {
        const matches = (round.matches || [])
          .slice()
          .sort((left, right) => Number(left.tableNo || 0) - Number(right.tableNo || 0));
        const isFinal = matches.length === 1;
        const showRoundResults = showResults || round.status === "completed";
        const roundLabel = getRoundLabel(round, topCutRounds);
        return (
          <section
            key={round.id}
            className={isFinal ? "bracket-round final" : "bracket-round"}
            aria-label={roundLabel}
          >
            <h3>{roundLabel}</h3>
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
                          <span>{playerName(entries, entryId, formatParticipantName)}</span>
                          {isWinner ? <strong>✓</strong> : null}
                        </div>
                      );
                    })}
                    {showRoundResults ? (
                      <div className="bracket-result">{matchScoreLabel(match)}</div>
                    ) : null}
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
