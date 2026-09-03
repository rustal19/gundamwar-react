import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Bracket from "../components/Bracket";
import { useAuth } from "../context/AuthContext";
import { fetchRounds, fetchTournament } from "../services/tournaments";
import { createTournamentParticipantNameFormatter } from "../utils/tournament/participantDisplayName";
import { getRoundProgressLabel } from "../utils/tournament/roundLabel";
import { getSwissRoundCount, getSwissRoundSummary } from "../utils/tournament/swiss";
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
  const formatParticipantName = useMemo(
    () => createTournamentParticipantNameFormatter(entries),
    [entries]
  );
  const currentRound = useMemo(
    () => rounds.find((round) => round.status !== "completed") || rounds[rounds.length - 1] || null,
    [rounds]
  );
  const timerText = remainingTime(currentRound, tournament?.roundTimeMinutes, now);
  const swissRounds = useMemo(
    () => rounds.filter((round) => round.stage !== "top_cut"),
    [rounds]
  );
  // スイスのラウンドが無い(=トーナメント表だけの)大会では、順位表タブも
  // 同じトーナメント表を出すことになる。違う操作名で同じ結果を返さないよう
  // 順位表タブ自体を出さない。
  const isBracketOnly =
    swissRounds.length === 0 && rounds.some((round) => round.stage === "top_cut");
  useEffect(() => {
    if (isBracketOnly) setActiveView("pairings");
  }, [isBracketOnly]);
  const standings = useMemo(() => {
    const matches = swissRounds
      .filter((round) => !currentRound || Number(round.number) <= Number(currentRound.number))
      .flatMap((round) => round.matches || []);
    return computeStandings(entries, matches).map((standing) => ({
      ...standing,
      entry: findEntry(entries, standing.entryId),
    }));
  }, [currentRound, entries, swissRounds]);

  return (
    <main className="tournament-display-page">
      <header className="tournament-display-header">
        <div>
          <h1>{tournament?.title || (isLoading ? "読み込み中..." : "大会掲示")}</h1>
          {/* 未取得・取得失敗を「ラウンド未作成」と書くと、まだ読めていないだけの
              状態を確定した事実として掲示してしまう。 */}
          <p>
            {isLoading
              ? "読み込み中..."
              : error
                ? "大会情報を取得できていません"
                : currentRound
                  ? `現在ラウンド: ${getRoundProgressLabel(currentRound, rounds, tournament)}`
                  : tournament && tournament.format !== "single_elim"
                    ? `スイス: ${getSwissRoundSummary(tournament)} / ラウンド未作成`
                    : "ラウンド未作成"}
          </p>
          {currentRound?.stage === "top_cut" && getSwissRoundCount(tournament) ? (
            <p>スイス: {getSwissRoundSummary(tournament)}</p>
          ) : null}
        </div>
        {timerText ? (
          <div className="tournament-display-timer" aria-label="残り時間">
            <span className="tournament-display-timer-label">残り時間</span>
            <span className="tournament-display-timer-value">{timerText}</span>
          </div>
        ) : null}
      </header>

      {isBracketOnly ? (
        <h2 className="tournament-display-section-title">トーナメント表</h2>
      ) : (
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
      )}

      <p className="tournament-display-note">この画面は5秒ごとに自動更新されます。</p>

      {isLoading ? <div className="tournament-display-empty">読み込み中...</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}

      {!isLoading && !error && activeView === "pairings" ? (
        <section className="tournament-display-section">
          {currentRound ? (
            currentRound.stage === "top_cut" ? (
              <Bracket rounds={rounds} entries={entries} />
            ) : sortedMatches(currentRound).length === 0 ? (
              // ラウンドはあるが対戦が0件のとき、見出しだけの表を掲示しない
              <div className="tournament-display-empty">
                このラウンドの対戦はまだ作成されていません。
              </div>
            ) : (
              <div className="tournament-display-table-wrap">
                <table className="tournament-display-table tournament-display-pairings-table">
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
                          <td className="tournament-display-table-no num" data-label="卓">
                            {match.tableNo || "-"}
                          </td>
                          <td className="tournament-display-player-one" data-label="プレイヤー1">
                            {formatParticipantName(player1, "-")}
                          </td>
                          <td className="tournament-display-player-two" data-label="プレイヤー2">
                            {formatParticipantName(player2, "Bye")}
                          </td>
                          <td className="tournament-display-result" data-label="結果">
                            {resultLabel(match)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="tournament-display-empty">ペアリングはまだありません。</div>
          )}
        </section>
      ) : null}

      {!isLoading && !error && activeView === "standings" ? (
        <section className="tournament-display-section">
          {swissRounds.length ? (
            <div className="tournament-display-table-wrap">
              <table className="tournament-display-table tournament-display-standings-table">
                <thead>
                  <tr>
                    <th className="num">順位</th>
                    <th>プレイヤー</th>
                    <th className="num">勝</th>
                    <th className="num">敗</th>
                    <th className="num">分</th>
                    <th className="num">勝点</th>
                    <th className="num">OMW%（対戦相手勝率）</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((standing) => (
                    <tr key={standing.entryId}>
                      <td className="tournament-display-table-no num" data-label="順位">
                        {standing.rank}
                      </td>
                      <td className="tournament-display-standing-player" data-label="プレイヤー">
                        {formatParticipantName(standing.entry, standing.entryId)}
                      </td>
                      <td className="num tournament-display-wins" data-label="勝">
                        {standing.wins}
                      </td>
                      <td className="num tournament-display-losses" data-label="敗">
                        {standing.losses}
                      </td>
                      <td className="num tournament-display-draws" data-label="分">
                        {standing.draws}
                      </td>
                      <td className="num tournament-display-points" data-label="勝点">
                        {standing.points}
                      </td>
                      <td className="num tournament-display-omw" data-label="OMW%">
                        {Math.round(Number(standing.omwPercent || 0) * 1000) / 10}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : rounds.some((round) => round.stage === "top_cut") ? (
            <Bracket rounds={rounds} entries={entries} />
          ) : (
            <div className="tournament-display-empty">順位表はまだありません。</div>
          )}
        </section>
      ) : null}
    </main>
  );
}
