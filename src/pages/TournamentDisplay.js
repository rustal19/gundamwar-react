import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchRounds, fetchTournament } from "../services/tournaments";
import { computeStandings } from "../utils/tournament/standings";
import "./Tournaments.css";

function findEntry(entries, entryId) {
  return entries.find((entry) => entry.id === entryId) || null;
}

function sortedMatches(round) {
  return (round?.matches || [])
    .slice()
    .sort((left, right) => Number(left.tableNo || 0) - Number(right.tableNo || 0));
}

function resultLabel(match) {
  if (!match?.result) return "未報告";
  if (match.result === "p1_win") return "P1 勝ち";
  if (match.result === "p2_win") return "P2 勝ち";
  if (match.result === "draw") return "引き分け";
  if (match.result === "bye") return "不戦勝";
  return "未報告";
}

function remainingTime(round, minutes, now) {
  if (!round?.timerStartedAt || !minutes) return "";
  const startedAt = new Date(round.timerStartedAt).getTime();
  if (Number.isNaN(startedAt)) return "";
  const remainingMs = Math.max(0, startedAt + Number(minutes) * 60000 - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutesPart = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const secondsPart = String(totalSeconds % 60).padStart(2, "0");
  return remainingMs <= 0 ? "時間切れ" : `${minutesPart}:${secondsPart}`;
}

export default function TournamentDisplay() {
  const { id } = useParams();
  const { authMode, user } = useAuth();
  const [activeView, setActiveView] = useState("pairings");
  const [tournament, setTournament] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDisplay = useCallback(async () => {
    try {
      const [nextTournament, roundPayload] = await Promise.all([
        fetchTournament(id, { authMode, user }),
        fetchRounds(id, { authMode, user }),
      ]);
      setTournament(nextTournament);
      setRounds(roundPayload.rounds || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "掲示用表示を読み込めませんでした。");
    } finally {
      setIsLoading(false);
    }
  }, [authMode, id, user]);

  useEffect(() => {
    loadDisplay();
    const pollId = window.setInterval(loadDisplay, 5000);
    return () => window.clearInterval(pollId);
  }, [loadDisplay]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const entries = useMemo(() => tournament?.entries || [], [tournament?.entries]);
  const currentRound = useMemo(
    () => rounds.find((round) => round.status !== "completed") || rounds[rounds.length - 1] || null,
    [rounds]
  );
  const timerText = remainingTime(currentRound, tournament?.roundTimeMinutes, now);
  const standings = useMemo(() => {
    const matches = rounds
      .filter((round) => !currentRound || Number(round.number) <= Number(currentRound.number))
      .flatMap((round) => round.matches || []);
    return computeStandings(entries, matches).map((standing) => ({
      ...standing,
      entry: findEntry(entries, standing.entryId),
    }));
  }, [currentRound, entries, rounds]);

  return (
    <main className="tournament-display-page">
      <header className="tournament-display-header">
        <div>
          <h1>{tournament?.title || "大会掲示"}</h1>
          <p>{currentRound ? `現在ラウンド: 第${currentRound.number}回戦` : "ラウンド未作成"}</p>
        </div>
        {timerText ? (
          <div className="tournament-display-timer" aria-label="残り時間">
            {timerText}
          </div>
        ) : null}
      </header>

      <div className="tournament-display-switch" role="tablist" aria-label="掲示内容">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "pairings"}
          className={activeView === "pairings" ? "active" : ""}
          onClick={() => setActiveView("pairings")}
        >
          ペアリング
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "standings"}
          className={activeView === "standings" ? "active" : ""}
          onClick={() => setActiveView("standings")}
        >
          順位表
        </button>
      </div>

      <p className="tournament-display-note">この画面は5秒ごとに自動更新されます。</p>

      {isLoading ? <div className="tournament-display-empty">読み込み中...</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}

      {!isLoading && !error && activeView === "pairings" ? (
        <section className="tournament-display-section">
          {currentRound ? (
            <div className="tournament-display-table-wrap">
              <table className="tournament-display-table">
                <thead>
                  <tr>
                    <th className="num">卓</th>
                    <th>プレイヤー1</th>
                    <th>プレイヤー2</th>
                    <th>結果</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches(currentRound).map((match) => {
                    const player1 = findEntry(entries, match.player1EntryId);
                    const player2 = match.player2EntryId == null ? null : findEntry(entries, match.player2EntryId);
                    return (
                      <tr key={match.id}>
                        <td className="tournament-display-table-no num">{match.tableNo || "-"}</td>
                        <td>{player1?.user?.name || "-"}</td>
                        <td>{player2?.user?.name || "Bye"}</td>
                        <td>{resultLabel(match)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tournament-display-empty">ペアリングはまだありません。</div>
          )}
        </section>
      ) : null}

      {!isLoading && !error && activeView === "standings" ? (
        <section className="tournament-display-section">
          <div className="tournament-display-table-wrap">
            <table className="tournament-display-table">
              <thead>
                <tr>
                  <th className="num">順位</th>
                  <th>プレイヤー</th>
                  <th className="num">勝</th>
                  <th className="num">敗</th>
                  <th className="num">分</th>
                  <th className="num">勝点</th>
                  <th className="num">OMW%</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing) => (
                  <tr key={standing.entryId}>
                    <td className="tournament-display-table-no num">{standing.rank}</td>
                    <td>{standing.entry?.user?.name || standing.entryId}</td>
                    <td className="num">{standing.wins}</td>
                    <td className="num">{standing.losses}</td>
                    <td className="num">{standing.draws}</td>
                    <td className="num">{standing.points}</td>
                    <td className="num">{Math.round(Number(standing.omwPercent || 0) * 1000) / 10}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
