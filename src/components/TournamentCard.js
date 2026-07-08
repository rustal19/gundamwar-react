import React from "react";
import { Link } from "react-router-dom";
import { ClockIcon, MapPinIcon, TournamentIcon, UsersIcon } from "./icons";
import { TOURNAMENT_STATUS_LABELS } from "../data/statusLabels";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const STATUS_LABELS = {
  ...TOURNAMENT_STATUS_LABELS,
  registration: "受付中",
  in_progress: "進行中",
  completed: "終了",
  cancelled: "中止",
  draft: "下書き",
};

const FORMAT_LABELS = {
  swiss: "スイスドロー",
  single_elim: "シングルエリミネーション",
};

function formatDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { month: "-", day: "-", weekday: "-" };
  }
  return {
    month: `${date.getMonth() + 1}月`,
    day: String(date.getDate()),
    weekday: `(${WEEKDAYS[date.getDay()]})`,
  };
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVenue(tournament) {
  const venue = tournament?.venue?.trim();
  if (venue) return venue;
  return tournament?.isOnline ? "オンライン" : "未設定";
}

function formatTournamentFormat(tournament) {
  const format = FORMAT_LABELS[tournament?.format] || tournament?.format || "形式未設定";
  const regulation = tournament?.regulation?.name || "レギュレーション未設定";
  return `${format}・${regulation}`;
}

function buildDetailPath(tournament, buildPath) {
  const basePath = `/tournaments/${tournament.id}`;
  if (tournament.status === "in_progress") {
    return buildPath(`${basePath}?tab=rounds`);
  }
  return buildPath(basePath);
}

export default function TournamentCard({ tournament, buildPath = (path) => path }) {
  const dateParts = formatDateParts(tournament?.startsAt);
  const isInProgress = tournament?.status === "in_progress";
  const buttonLabel = isInProgress ? "観戦" : "詳細";
  const buttonTone = tournament?.status === "registration" ? "primary" : "secondary";

  return (
    <article className="tournament-card">
      <div className="tournament-card-date" aria-label="開催日">
        <span>{dateParts.month}</span>
        <strong>{dateParts.day}</strong>
        <span>{dateParts.weekday}</span>
      </div>
      <div className="tournament-card-main">
        <div className="tournament-card-title-row">
          <h3>
            <Link to={buildPath(`/tournaments/${tournament.id}`)}>{tournament.title}</Link>
          </h3>
          <span className={`tournament-status ${tournament.status}`}>
            {STATUS_LABELS[tournament.status] || tournament.status}
          </span>
        </div>
        <div className="tournament-card-meta">
          <span>
            <ClockIcon size={14} />
            {formatTime(tournament.startsAt)}
          </span>
          <span>
            <MapPinIcon size={14} />
            {formatVenue(tournament)}
          </span>
          <span>
            <TournamentIcon size={14} />
            {formatTournamentFormat(tournament)}
          </span>
          <span>
            <UsersIcon size={14} />
            {tournament.entryCount || 0}
            {tournament.capacity == null ? "" : ` / ${tournament.capacity}`}
          </span>
        </div>
      </div>
      <Link className={`tournament-card-action ${buttonTone}`} to={buildDetailPath(tournament, buildPath)}>
        {buttonLabel}
      </Link>
    </article>
  );
}
