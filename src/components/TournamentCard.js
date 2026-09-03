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

// 横一列に並べると「7月15(水)」となり「日」が抜けて読めないので、月日を1語にまとめる。
function formatDateInline(parts) {
  if (parts.day === "-") return "-";
  return `${parts.month}${parts.day}日`;
}

// 縦積みでも「日」を落とさない。大会一覧のモバイル幅では CSS が
// この3要素を横一列へ変えるため(pages/Tournaments.css の @media)、
// 数字だけにすると「7月 15 (水)」と読めなくなる。
function formatDayLabel(parts) {
  if (parts.day === "-") return "-";
  return `${parts.day}日`;
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
  if (tournament.status === "draft") {
    return buildPath(`${basePath}/manage`);
  }
  if (tournament.status === "in_progress") {
    return buildPath(`${basePath}?tab=rounds`);
  }
  return buildPath(basePath);
}

export default function TournamentCard({
  tournament,
  buildPath = (path) => path,
  actionTone,
  dateLayout = "stacked",
}) {
  const dateParts = formatDateParts(tournament?.startsAt);
  const isInlineDate = dateLayout === "inline";
  const isInProgress = tournament?.status === "in_progress";
  const buttonLabel = isInProgress ? "観戦" : "詳細";
  const buttonTone =
    actionTone || (tournament?.status === "registration" ? "primary" : "secondary");

  return (
    <article className="tournament-card">
      <div className="tournament-card-date" aria-label="開催日">
        {isInlineDate ? (
          <>
            <strong>{formatDateInline(dateParts)}</strong>
            <span>{dateParts.weekday}</span>
          </>
        ) : (
          <>
            <span>{dateParts.month}</span>
            <strong>{formatDayLabel(dateParts)}</strong>
            <span>{dateParts.weekday}</span>
          </>
        )}
      </div>
      <div className="tournament-card-main">
        <div className="tournament-card-title-row">
          <h3>
            <Link to={buildDetailPath(tournament, buildPath)}>{tournament.title}</Link>
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
