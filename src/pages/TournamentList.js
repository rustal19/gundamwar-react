import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchTournaments } from "../services/tournaments";
import "./Tournaments.css";

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "registration", label: "受付中" },
  { value: "in_progress", label: "進行中" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "中止" },
];

const STATUS_LABELS = {
  registration: "受付中",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "中止",
};

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

function formatVenue(tournament) {
  const venue = tournament.venue?.trim();
  if (venue) return venue;
  return tournament.isOnline ? "オンライン" : "未設定";
}

export default function TournamentList({ compact = false }) {
  const { authMode, isOrganizer } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const [payload, setPayload] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    fetchTournaments({ status, page, authMode })
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
  }, [authMode, page, status]);

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

      {error ? <div className="tournament-alert">{error}</div> : null}
      {isLoading ? <div className="tournament-muted">読み込み中...</div> : null}

      <div className="tournament-list">
        {payload.items.length === 0 && !isLoading ? (
          <div className="tournament-empty">表示できる大会がありません。</div>
        ) : null}
        {payload.items.map((tournament) => (
          <article key={tournament.id} className="tournament-row">
            <div className="tournament-row-main">
              <div className="tournament-row-title">
                <Link to={`/tournaments/${tournament.id}`}>{tournament.title}</Link>
                <span className={`tournament-status ${tournament.status}`}>
                  {STATUS_LABELS[tournament.status] || tournament.status}
                </span>
              </div>
              <p>{tournament.description || "説明はありません。"}</p>
            </div>
            <div className="tournament-row-meta">
              <span>開始 {formatDate(tournament.startsAt)}</span>
              <span>開催地 {formatVenue(tournament)}</span>
              <span>締切 {formatDate(tournament.registrationClosesAt)}</span>
              <span>
                参加 {tournament.entryCount || 0}
                {tournament.capacity == null ? "" : ` / ${tournament.capacity}`}
              </span>
            </div>
          </article>
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
    </main>
  );
}
