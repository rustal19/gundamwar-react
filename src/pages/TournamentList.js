import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import TournamentCard from "../components/TournamentCard";
import { useAuth } from "../context/AuthContext";
import { fetchMyTournaments, fetchTournaments } from "../services/tournaments";
import { TOURNAMENT_STATUS_OPTIONS as STATUS_OPTIONS } from "../data/statusLabels";
import "./Tournaments.css";

const VIEW_ALL = "all";
const VIEW_MINE = "mine";
const PAGE_SIZE = 10;

function normalizeMyTournaments(payload, { status, page }) {
  const items = (payload?.items || [])
    .filter((item) => item?.entry?.status !== "dropped")
    .map((item) => item?.tournament || item)
    .filter(Boolean)
    .filter((tournament) => !status || tournament.status === status);
  const start = (page - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    total: items.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

export default function TournamentList({ compact = false }) {
  const { authMode, isAuthenticated, isOrganizer, isReady, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const view = searchParams.get("view") === VIEW_MINE ? VIEW_MINE : VIEW_ALL;
  const canViewMyTournaments = Boolean(isAuthenticated && user?.id);
  const showLoginPrompt =
    view === VIEW_MINE && isReady !== false && !canViewMyTournaments;
  const [payload, setPayload] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (view === VIEW_MINE && isReady === false) {
      setIsLoading(true);
      setError("");
      return () => {
        cancelled = true;
      };
    }

    if (view === VIEW_MINE && !canViewMyTournaments) {
      setPayload({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
      setIsLoading(false);
      setError("");
      return () => {
        cancelled = true;
      };
    }

    setPayload({ items: [], total: 0, page, pageSize: PAGE_SIZE });
    setIsLoading(true);
    setError("");
    const request =
      view === VIEW_MINE
        ? fetchMyTournaments({ authMode, user }).then((nextPayload) =>
            normalizeMyTournaments(nextPayload, { status, page })
          )
        : fetchTournaments({ status, page, authMode, user });

    request
      .then((nextPayload) => {
        if (!cancelled) setPayload(nextPayload);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authMode, canViewMyTournaments, isReady, page, status, user, view]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((payload.total || 0) / (payload.pageSize || 10))),
    [payload.pageSize, payload.total]
  );

  const setFilter = (nextStatus) => {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set("status", nextStatus);
    else next.delete("status");
    next.set("page", "1");
    setSearchParams(next);
  };

  const setView = (nextView) => {
    if (nextView === VIEW_MINE && !canViewMyTournaments) return;
    const next = new URLSearchParams(searchParams);
    if (nextView === VIEW_MINE) next.set("view", VIEW_MINE);
    else next.delete("view");
    next.set("page", "1");
    setSearchParams(next);
  };

  const setPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return (
    <main className={compact ? "tournament-page compact" : "tournament-page"}>
      <div className="tournament-page-header">
        <div>
          <p className="tournament-eyebrow">大会一覧</p>
          <h1>大会</h1>
        </div>
        <div className="tournament-header-actions">
          {isOrganizer ? (
            <Link to="/tournaments/new" className="tournament-create-link">
              大会を作成
            </Link>
          ) : null}
          <div className="tournament-tabs tournament-list-tabs" role="group" aria-label="大会の表示範囲">
            <button
              type="button"
              className={view === VIEW_ALL ? "active" : ""}
              aria-pressed={view === VIEW_ALL}
              onClick={() => setView(VIEW_ALL)}
            >
              すべて
            </button>
            <button
              type="button"
              className={view === VIEW_MINE ? "active" : ""}
              aria-pressed={view === VIEW_MINE}
              disabled={!canViewMyTournaments}
              title={!canViewMyTournaments ? "ログイン後に利用できます" : undefined}
              onClick={() => setView(VIEW_MINE)}
            >
              自分の大会
            </button>
          </div>
          <div className="tournament-filter" aria-label="大会ステータス">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                className={status === option.value ? "active" : ""}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showLoginPrompt ? (
        <div className="tournament-login-prompt">
          <span>ログインすると自分の大会を確認できます。</span>
          <Link to="/profile">ログイン</Link>
        </div>
      ) : (
        <>
          {error ? <div className="tournament-alert">{error}</div> : null}
          {isLoading ? <div className="tournament-muted">読み込み中...</div> : null}

          <div className="tournament-list">
            {payload.items.length === 0 && !isLoading ? (
              <div className="tournament-empty">表示できる大会がありません。</div>
            ) : null}
            {payload.items.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>

          <div className="tournament-pagination">
            <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
              前へ
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              次へ
            </button>
          </div>
        </>
      )}
    </main>
  );
}
