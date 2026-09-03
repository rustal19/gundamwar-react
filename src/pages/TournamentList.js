import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AsyncState from "../components/AsyncState";
import TournamentCard from "../components/TournamentCard";
import { useAuth } from "../context/AuthContext";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import { fetchMyTournaments, fetchTournaments } from "../services/tournaments";
import { TOURNAMENT_STATUS_OPTIONS as STATUS_OPTIONS } from "../data/statusLabels";
import "./Tournaments.css";

const VIEW_ALL = "all";
const VIEW_MINE = "mine";
const PAGE_SIZE = 10;
const EMPTY_PAYLOAD = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
};

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
  const requestIdRef = useRef(0);
  const {
    status: listStatus,
    data: payload,
    error: listError,
    start: startList,
    succeed: succeedList,
    fail: failList,
    reset: resetList,
  } = useAsyncResource(EMPTY_PAYLOAD, (nextPayload) => !nextPayload?.items?.length);

  const loadTournaments = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    startList();
    try {
      const nextPayload =
        view === VIEW_MINE
          ? await fetchMyTournaments({ authMode, user }).then((result) =>
              normalizeMyTournaments(result, { status, page })
            )
          : await fetchTournaments({ status, page, authMode, user });
      if (requestIdRef.current === requestId) succeedList(nextPayload);
    } catch (_loadError) {
      if (requestIdRef.current === requestId) {
        failList(
          view === VIEW_MINE
            ? "自分の大会を読み込めませんでした。"
            : "大会一覧を読み込めませんでした。"
        );
      }
    }
  }, [authMode, failList, page, startList, status, succeedList, user, view]);

  useEffect(() => {
    if (view === VIEW_MINE && isReady === false) {
      requestIdRef.current += 1;
      startList();
      return () => {
        requestIdRef.current += 1;
      };
    }

    if (view === VIEW_MINE && !canViewMyTournaments) {
      requestIdRef.current += 1;
      resetList();
      return () => {
        requestIdRef.current += 1;
      };
    }

    loadTournaments();
    return () => {
      requestIdRef.current += 1;
    };
  }, [canViewMyTournaments, isReady, loadTournaments, resetList, startList, view]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((payload.total || 0) / (payload.pageSize || 10))),
    [payload.pageSize, payload.total]
  );
  const emptyMessage =
    view === VIEW_MINE
      ? status
        ? "選択したステータスに一致する自分の大会はありません。"
        : "参加中または運営中の大会はありません。"
      : status
        ? "選択したステータスに一致する大会はありません。"
        : "表示できる大会はありません。";

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
          {/* 「すべて」というボタンが表示範囲とステータスの両方にあるため、
              可視の見出しがないとどちらの絞り込みか区別できない。 */}
          <div className="tournament-filter-group">
            <span className="tournament-filter-label" id="tournament-view-label">
              表示範囲
            </span>
            <div
              className="tournament-tabs tournament-list-tabs"
              role="group"
              aria-labelledby="tournament-view-label"
            >
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
          </div>
          <div className="tournament-filter-group">
            <span className="tournament-filter-label" id="tournament-status-label">
              ステータス
            </span>
            <div
              className="tournament-filter"
              role="group"
              aria-labelledby="tournament-status-label"
            >
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
      </div>

      {showLoginPrompt ? (
        <div className="tournament-login-prompt">
          <span>ログインすると自分の大会を確認できます。</span>
          <Link to="/profile">ログイン</Link>
        </div>
      ) : (
        <AsyncState
          status={listStatus}
          error={listError}
          idleMessage="大会一覧はまだ読み込まれていません。"
          loadingMessage="大会一覧を読み込み中..."
          emptyMessage={emptyMessage}
          errorMessage={
            view === VIEW_MINE
              ? "自分の大会を読み込めませんでした。"
              : "大会一覧を読み込めませんでした。"
          }
          onRetry={loadTournaments}
          className={listStatus === ASYNC_STATUS.ERROR ? "tournament-alert" : "tournament-empty"}
          retryButtonClassName="tournament-secondary-button"
        >
          <>
            <div className="tournament-list">
              {payload.items.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>

            {totalPages > 1 ? (
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
            ) : null}
          </>
        </AsyncState>
      )}
    </main>
  );
}
