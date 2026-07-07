import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchTournaments } from "../services/tournaments";
import { TOURNAMENT_STATUS_LABELS } from "../data/statusLabels";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import "./PortalHome.css";


function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countDeckItems(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Number(item?.count || 0),
    0
  );
}

export default function PortalHome({ compact = false }) {
  const { authMode } = useAuth();
  const location = useLocation();
  const [tournaments, setTournaments] = useState([]);
  const [decks, setDecks] = useState([]);
  const [isTournamentsLoaded, setIsTournamentsLoaded] = useState(false);
  const [isDecksLoaded, setIsDecksLoaded] = useState(false);
  const [tournamentsError, setTournamentsError] = useState("");
  const [decksError, setDecksError] = useState("");

  const paths = useMemo(
    () => ({
      search: buildPathWithForcedMobileLayout("/search", location.search),
      deck: buildPathWithForcedMobileLayout("/deck", location.search),
      decks: buildPathWithForcedMobileLayout("/decks", location.search),
      tournaments: buildPathWithForcedMobileLayout("/tournaments", location.search),
    }),
    [location.search]
  );

  const buildPath = (path) => buildPathWithForcedMobileLayout(path, location.search);

  useEffect(() => {
    let isActive = true;
    setIsTournamentsLoaded(false);
    setTournamentsError("");

    Promise.all([
      Promise.resolve(fetchTournaments({ status: "registration", page: 1, authMode })),
      Promise.resolve(fetchTournaments({ status: "in_progress", page: 1, authMode })),
    ])
      .then(([registration, inProgress]) => {
        if (!isActive) return;
        const nextItems = [...(registration?.items || []), ...(inProgress?.items || [])]
          .sort((left, right) =>
            String(left.startsAt || "").localeCompare(String(right.startsAt || ""))
          )
          .slice(0, 5);
        setTournaments(nextItems);
      })
      .catch((error) => {
        if (!isActive) return;
        setTournamentsError(error.message);
        setTournaments([]);
      })
      .finally(() => {
        if (isActive) setIsTournamentsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode]);

  useEffect(() => {
    let isActive = true;
    setIsDecksLoaded(false);
    setDecksError("");

    Promise.resolve(fetchPublicDecks({ page: 1, authMode }))
      .then((payload) => {
        if (!isActive) return;
        setDecks((payload?.items || []).slice(0, 5));
      })
      .catch((error) => {
        if (!isActive) return;
        setDecksError(error.message);
        setDecks([]);
      })
      .finally(() => {
        if (isActive) setIsDecksLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode]);

  return (
    <main className={compact ? "portal-home compact" : "portal-home"}>
      <section className="portal-hero">
        <p className="portal-eyebrow">Gundam War Database</p>
        <h1>Gundam War Database</h1>
        <p>
          ガンダムウォーのカード検索、デッキ構築、公開デッキ、大会情報をまとめて扱える
          非公式ファンサイトです。
        </p>
      </section>

      <section className="portal-section">
        <div className="portal-section-header">
          <div>
            <p className="portal-eyebrow">Tournaments</p>
            <h2>開催予定・進行中の大会</h2>
          </div>
          <Link className="portal-more-link" to={paths.tournaments}>
            もっと見る
          </Link>
        </div>

        {!isTournamentsLoaded ? (
          <div className="portal-empty">読み込み中...</div>
        ) : tournamentsError ? (
          <div className="portal-empty">{tournamentsError}</div>
        ) : tournaments.length === 0 ? (
          <div className="portal-empty">開催予定・進行中の大会はありません。</div>
        ) : (
          <div className="portal-list">
            {tournaments.map((tournament) => (
              <article key={tournament.id} className="portal-row">
                <div>
                  <h3>
                    <Link to={buildPath(`/tournaments/${tournament.id}`)}>{tournament.title}</Link>
                  </h3>
                  <p>{tournament.description || "説明はありません。"}</p>
                </div>
                <div className="portal-meta">
                  <span className={`portal-status ${tournament.status}`}>
                    {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
                  </span>
                  <span>開始 {formatDate(tournament.startsAt)}</span>
                  <span>
                    参加 {tournament.entryCount || 0}
                    {tournament.capacity == null ? "" : ` / ${tournament.capacity}`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="portal-section">
        <div className="portal-section-header">
          <div>
            <p className="portal-eyebrow">Decks</p>
            <h2>新着公開デッキ</h2>
          </div>
          <Link className="portal-more-link" to={paths.decks}>
            もっと見る
          </Link>
        </div>

        {!isDecksLoaded ? (
          <div className="portal-empty">読み込み中...</div>
        ) : decksError ? (
          <div className="portal-empty">{decksError}</div>
        ) : decks.length === 0 ? (
          <div className="portal-empty">公開デッキはありません。</div>
        ) : (
          <div className="portal-list">
            {decks.map((deck) => (
              <article key={deck.id} className="portal-row">
                <div>
                  <h3>
                    <Link to={buildPath(`/decks/${deck.id}`)}>{deck.title}</Link>
                  </h3>
                  <p>{deck.description || "説明はありません。"}</p>
                </div>
                <div className="portal-meta">
                  <span>{deck.owner?.name || "-"}</span>
                  <span>{`${countDeckItems(deck.items)}枚`}</span>
                  <span>{formatDate(deck.publishedAt || deck.updatedAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="portal-actions" aria-label="主要機能">
        <Link className="portal-action-card" to={paths.search}>
          <span>カード検索</span>
          <strong>条件を指定してカードを探す</strong>
        </Link>
        <Link className="portal-action-card" to={paths.deck}>
          <span>デッキ構築</span>
          <strong>カードを選んでデッキを作る</strong>
        </Link>
      </section>
    </main>
  );
}
