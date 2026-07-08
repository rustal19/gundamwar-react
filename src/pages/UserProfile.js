import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchRounds, fetchStandings, fetchTournament, fetchTournaments } from "../services/tournaments";
import { getDeckColors } from "../utils/deckColors";
import { computeUserResults, formatRecord } from "../utils/userResults";
import NotFound from "./NotFound";
import "./Profile.css";
import "./PublicDecks.css";

function toId(value) {
  return value == null ? "" : String(value);
}

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
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function DeckColorDots({ items }) {
  const colors = getDeckColors(items);
  const displayColors = colors.length > 0 ? colors : [{ name: "不明", value: "#d8d8d8" }];

  return (
    <span
      className="public-deck-colors"
      aria-label={`デッキ色: ${displayColors.map((color) => color.name).join("、")}`}
    >
      {displayColors.map((color) => (
        <span
          key={color.name}
          className="public-deck-color-dot"
          style={{ backgroundColor: color.value }}
          title={color.name}
        />
      ))}
    </span>
  );
}

function isNotFoundError(error) {
  return error?.code === "not_found" || error?.status === 404 || /not found|見つかりません/i.test(error?.message || "");
}

async function fetchApiProfile(userId) {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/profile`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || "プロフィールが見つかりません。");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function fetchMockProfile(userId, { authMode, currentUser }) {
  const [deckPayload, tournamentPayload] = await Promise.all([
    fetchPublicDecks({ authMode, page: 1 }),
    fetchTournaments({ authMode, page: 1 }),
  ]);
  const publicDecks = (deckPayload.items || []).filter(
    (deck) => deck.isPublic !== false && toId(deck.owner?.id) === toId(userId)
  );
  const userFromDeck = publicDecks.find((deck) => deck.owner?.id)?.owner;
  const tournamentItems = await Promise.all(
    (tournamentPayload.items || []).map(async (tournament) => {
      const detail = await fetchTournament(tournament.id, { authMode, user: currentUser }).catch(() => tournament);
      const entry = (detail.entries || []).find((item) => toId(item.user?.id) === toId(userId));
      if (!entry) return null;
      const [roundPayload, standingPayload] = await Promise.all([
        fetchRounds(detail.id, { authMode, user: currentUser }).catch(() => ({ rounds: [] })),
        fetchStandings(detail.id, { authMode }).catch(() => ({ items: [] })),
      ]);
      return {
        tournament: detail,
        entries: detail.entries || [entry],
        entry,
        rounds: roundPayload.rounds || [],
        standings: standingPayload.items || standingPayload.standings || [],
      };
    })
  );
  const tournaments = tournamentItems.filter(Boolean);
  const userFromEntry = tournaments.find((item) => item.entry?.user?.id)?.entry?.user;
  const isCurrentUser = toId(currentUser?.id) === toId(userId);
  const user = {
    id: toId(userId),
    nickname:
      (isCurrentUser && (currentUser?.nickname || currentUser?.displayNickname)) ||
      userFromDeck?.name ||
      userFromEntry?.name ||
      "",
  };

  if (!user.nickname && publicDecks.length === 0 && tournaments.length === 0) {
    const error = new Error("プロフィールが見つかりません。");
    error.code = "not_found";
    throw error;
  }

  const results = computeUserResults(userId, tournaments, publicDecks);
  return {
    user,
    publicDecks,
    results: results.results,
    metrics: results.metrics,
  };
}

export default function UserProfile({ compact = false }) {
  const { id } = useParams();
  const { authMode, user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;
    setIsLoaded(false);
    setError(null);
    setProfile(null);

    const loader =
      authMode === "mock"
        ? fetchMockProfile(id, { authMode, currentUser })
        : fetchApiProfile(id);

    loader
      .then((payload) => {
        if (isActive) setProfile(payload);
      })
      .catch((loadError) => {
        if (isActive) setError(loadError);
      })
      .finally(() => {
        if (isActive) setIsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode, currentUser, id]);

  const metrics = useMemo(() => {
    if (profile?.metrics) return profile.metrics;
    const results = Array.isArray(profile?.results) ? profile.results : [];
    const record = results.reduce(
      (sum, result) => ({
        wins: sum.wins + Number(result.wins || 0),
        losses: sum.losses + Number(result.losses || 0),
        draws: sum.draws + Number(result.draws || 0),
      }),
      { wins: 0, losses: 0, draws: 0 }
    );
    return {
      tournamentCount: results.length,
      championshipCount: results.filter((result) => Number(result.rank) === 1).length,
      record,
      publicDeckCount: Array.isArray(profile?.publicDecks) ? profile.publicDecks.length : 0,
    };
  }, [id, profile]);
  const isSelf = toId(currentUser?.id) === toId(id);

  if (isLoaded && isNotFoundError(error)) return <NotFound />;

  return (
    <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
      {!isLoaded ? (
        <div className="profile-panel">読み込み中...</div>
      ) : error ? (
        <div className="profile-error">読み込みに失敗しました。再読み込みしてください。</div>
      ) : profile ? (
        <>
          <section className="profile-panel profile-identity public-profile-identity">
            <div className="profile-avatar" aria-hidden="true">{initialsFor(profile.user)}</div>
            <div className="profile-identity-main">
              <h1>{displayName(profile.user)}</h1>
              <p className="profile-note">
                参加{metrics.tournamentCount}大会・優勝{metrics.championshipCount}回・通算 {formatRecord(metrics.record)}
              </p>
              {isSelf ? <Link to="/profile" className="profile-public-link">マイページで編集</Link> : null}
            </div>
          </section>

          <section className="profile-panel">
            <h2>公開デッキ</h2>
            {profile.publicDecks.length === 0 ? <p className="profile-empty">公開デッキはありません。</p> : null}
            <div className="profile-results-list">
              {profile.publicDecks.map((deck) => (
                <Link key={deck.id} to={`/decks/${deck.id}`} className="profile-result-row">
                  <div>
                    <strong>
                      <DeckColorDots items={deck.items} />
                      {deck.title}
                    </strong>
                    <span>{formatDate(deck.publishedAt || deck.updatedAt)}</span>
                  </div>
                  {deck.format ? <span className="public-deck-format-badge">{deck.format}</span> : null}
                </Link>
              ))}
            </div>
          </section>

          <section className="profile-panel">
            <h2>大会成績</h2>
            {profile.results.length === 0 ? <p className="profile-empty">完了した大会成績はまだありません。</p> : null}
            <div className="profile-results-list">
              {profile.results.map((result) => (
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
        </>
      ) : null}
    </main>
  );
}
