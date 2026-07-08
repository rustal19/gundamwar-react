import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GoogleSignInPanel from "../components/GoogleSignInPanel";
import { useAuth, validateNickname } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchMyTournaments, fetchRounds, fetchStandings } from "../services/tournaments";
import { computeUserResults, formatRecord } from "../utils/userResults";
import "./Profile.css";

function displayName(user) {
  return user?.nickname || user?.displayNickname || user?.name || "プレイヤー";
}

function initialsFor(user) {
  const source = displayName(user).trim();
  return source ? source.slice(0, 2).toUpperCase() : "GW";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}

function findCurrentTable(rounds, entryId) {
  const activeRound = (rounds || [])
    .slice()
    .sort((left, right) => Number(right.number || 0) - Number(left.number || 0))
    .find((round) => round.status === "in_progress" || round.status === "completed");
  const match = (activeRound?.matches || []).find((item) =>
    [item.player1EntryId, item.player2EntryId].some(
      (matchEntryId) => matchEntryId != null && String(matchEntryId) === String(entryId)
    )
  );
  return match?.tableNo || null;
}

function groupMyTournaments(items) {
  return {
    upcoming: items.filter(({ tournament }) => tournament.status === "registration"),
    active: items.filter(({ tournament }) => tournament.status === "in_progress"),
    past: items.filter(({ tournament }) => ["completed", "cancelled"].includes(tournament.status)),
  };
}

function TournamentGroup({ title, items, emptyText }) {
  return (
    <section className="profile-list-section">
      <h3>{title}</h3>
      {items.length === 0 ? <p className="profile-empty">{emptyText}</p> : null}
      <div className="profile-tournament-list">
        {items.map(({ tournament, entry, needsDecklist, rounds }) => {
          const tableNo = tournament.status === "in_progress" ? findCurrentTable(rounds, entry.id) : null;
          return (
            <Link key={tournament.id} to={`/tournaments/${tournament.id}`} className="profile-tournament-row">
              <div>
                <strong>{tournament.title}</strong>
                <span>{formatDate(tournament.startsAt)} / {entry.status}</span>
              </div>
              <div className="profile-row-meta">
                {needsDecklist ? <span className="profile-badge accent">未提出</span> : null}
                {tableNo ? <span className="profile-badge soft">卓 {tableNo}</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function Profile({ compact = false }) {
  const { authMode, isAuthenticated, isReady, updateProfile, user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [myTournaments, setMyTournaments] = useState([]);
  const [publicDecks, setPublicDecks] = useState([]);

  useEffect(() => {
    setNickname(user?.nickname || "");
    setMessage("");
    setErrorMessage("");
  }, [user?.nickname]);

  const loadMyPage = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setMyTournaments([]);
      setPublicDecks([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [tournamentPayload, deckPayload] = await Promise.all([
        fetchMyTournaments({ authMode, user }),
        fetchPublicDecks({ authMode, page: 1 }),
      ]);
      const entries = tournamentPayload.items || [];
      const enriched = await Promise.all(
        entries.map(async (item) => {
          const [roundPayload, standingPayload] = await Promise.all([
            fetchRounds(item.tournament.id, { authMode, user }).catch(() => ({ rounds: [] })),
            item.tournament.status === "completed"
              ? fetchStandings(item.tournament.id, { authMode }).catch(() => ({ items: [] }))
              : Promise.resolve({ items: [] }),
          ]);
          return {
            ...item,
            entries: [item.entry],
            rounds: roundPayload.rounds || [],
            standings: standingPayload.items || standingPayload.standings || [],
          };
        })
      );
      setMyTournaments(enriched);
      setPublicDecks(deckPayload.items || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [authMode, isAuthenticated, user]);

  useEffect(() => {
    loadMyPage();
  }, [loadMyPage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateNickname(nickname);
    if (validationError) {
      setErrorMessage(validationError);
      setMessage("");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      await updateProfile({ nickname });
      setMessage("プロフィールを更新しました。");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const grouped = useMemo(() => groupMyTournaments(myTournaments), [myTournaments]);
  const results = useMemo(
    () => computeUserResults(user?.id, myTournaments, publicDecks),
    [myTournaments, publicDecks, user?.id]
  );

  if (!isReady) {
    return (
      <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
        <div className="profile-panel">読み込み中...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
        <section className="profile-panel">
          <h1>マイページ</h1>
          <p className="profile-note">ログインすると参加大会と戦績を確認できます。</p>
          <GoogleSignInPanel />
        </section>
      </main>
    );
  }

  return (
    <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
      <section className="profile-panel profile-identity">
        <div className="profile-avatar" aria-hidden="true">{initialsFor(user)}</div>
        <div className="profile-identity-main">
          <h1>{displayName(user)}</h1>
          <p className="profile-google-name">{user?.name || "-"}</p>
          <Link to={`/users/${user.id}`} className="profile-public-link">公開ページを見る</Link>
        </div>
        <form className="profile-form profile-nickname-form" onSubmit={handleSubmit}>
          <label className="profile-field" htmlFor="profile-nickname">
            <span>ニックネーム変更</span>
            <input
              id="profile-nickname"
              type="text"
              value={nickname}
              minLength={2}
              maxLength={20}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="2〜20文字"
            />
          </label>
          <button type="submit" className="deck-primary-button" disabled={isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </button>
        </form>
      </section>

      {errorMessage ? <p className="profile-error">{errorMessage}</p> : null}
      {message ? <p className="profile-message">{message}</p> : null}

      <section className="profile-metrics" aria-label="戦績サマリー">
        <div><span>参加大会数</span><strong>{results.metrics.tournamentCount}</strong></div>
        <div><span>優勝数</span><strong>{results.metrics.championshipCount}</strong></div>
        <div><span>通算</span><strong>{formatRecord(results.metrics.record)}</strong></div>
        <div><span>公開デッキ数</span><strong>{results.metrics.publicDeckCount}</strong></div>
      </section>

      <section className="profile-panel">
        <div className="profile-section-heading">
          <h2>あなたの大会</h2>
          {isLoading ? <span>読み込み中...</span> : null}
        </div>
        <TournamentGroup title="参加予定" items={grouped.upcoming} emptyText="参加予定の大会はありません。" />
        <TournamentGroup title="進行中" items={grouped.active} emptyText="進行中の大会はありません。" />
        <TournamentGroup title="過去" items={grouped.past} emptyText="過去の大会はありません。" />
      </section>

      <section className="profile-panel">
        <h2>過去の戦績</h2>
        {results.results.length === 0 ? <p className="profile-empty">完了した大会の戦績はまだありません。</p> : null}
        <div className="profile-results-list">
          {results.results.map((result) => (
            <Link key={result.tournament.id} to={`/tournaments/${result.tournament.id}`} className="profile-result-row">
              <div>
                <strong>{result.tournament.title}</strong>
                <span>{result.wins}-{result.losses}-{result.draws}</span>
              </div>
              <span className={result.rank === 1 ? "profile-badge soft" : "profile-badge"}>
                {result.rank === 1 ? "優勝" : `${result.rank}位`}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
