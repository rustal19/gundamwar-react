import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AsyncState from "../components/AsyncState";
import Bracket from "../components/Bracket";
import CardHoverPreview from "../components/CardHoverPreview";
import RegulationCardInput, {
  createRegulationCardState,
  getRegulationCardErrors,
  getRegulationCardIds,
  getRegulationCardReferences,
} from "../components/RegulationCardInput";
import RegulationSetInput, {
  createRegulationSetState,
  getRegulationAllowedSets,
} from "../components/RegulationSetInput";
import RoundTabs from "../components/RoundTabs";
import { useAuth } from "../context/AuthContext";
import { useDeckPreview } from "../hooks/useDeckPreview";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import {
  addTournamentCoOrganizer,
  approveEntry,
  completeRound,
  createManualEntry,
  createNextRound,
  createTournament,
  deleteRound,
  deleteTournament,
  fetchEntries,
  fetchRoundsForManage,
  fetchStandings,
  fetchTournament,
  fetchTournamentBans,
  getTournamentPermissions,
  kickEntry,
  promoteWaitlistedEntries,
  rejectEntry,
  reopenRound,
  removeTournamentCoOrganizer,
  reportMatchResult,
  startRoundTimer,
  updateEntryStatus,
  updateRoundMatches,
  updateTournament,
  unbanTournamentUser,
} from "../services/tournaments";
import { fetchUsers } from "../services/users";
import { getCardCode } from "../utils/cardImages";
import {
  DECKLIST_STATE_LABELS,
  ENTRY_STATUS_LABELS,
  TOURNAMENT_STATUS_LABELS,
} from "../data/statusLabels";
import { buildDeckExport, groupDeckItemsByType } from "../utils/deckExport";
import { formatDeckCountSummary, getDeckCounts } from "../utils/deckCounts";
import { FORMAT_PRESETS, OTHER_FORMAT_NAME } from "../data/formats";
import { createTournamentParticipantNameFormatter } from "../utils/tournament/participantDisplayName";
import {
  getRoundLabel,
  getRoundLabelForNumber,
  getRoundProgressLabel,
} from "../utils/tournament/roundLabel";
import {
  getSwissEndCondition,
  getSwissRoundCount,
  normalizeSwissEndCondition,
  SWISS_END_CONDITION_FIXED_ROUNDS,
  SWISS_END_CONDITION_UNDEFEATED,
} from "../utils/tournament/swiss";
import { computeStandings } from "../utils/tournament/standings";
import "./Tournaments.css";

const DEFAULT_FORM = {
  title: "",
  description: "",
  format: "swiss",
  swissRounds: "",
  swissEndCondition: SWISS_END_CONDITION_FIXED_ROUNDS,
  topCutSize: "",
  status: "draft",
  startsAt: "",
  registrationClosesAt: "",
  checkinOpensAt: "",
  capacity: "",
  venue: "",
  isOnline: false,
  isListed: true,
  selfCheckin: false,
  decklistsPublic: false,
  decklistRequired: false,
  announcement: "",
  roundTimeMinutes: "",
  lateEntry: false,
  regulation: {
    name: "スタンダード",
    mainMin: 50,
    mainMax: 50,
    sideSize: 10,
    maxCopies: 3,
    bannedCards: [],
    limitedCards: [],
    bannedCardInput: createRegulationCardState([]),
    limitedCardInput: createRegulationCardState([]),
    allowedSets: null,
    allowedSetInput: createRegulationSetState(null),
  },
};

const STATUS_LABELS = TOURNAMENT_STATUS_LABELS;

const TABS = [
  ["rounds", "ラウンド運営"],
  ["participants", "参加者"],
  ["info", "大会情報"],
  ["standings", "順位表"],
];

const BO3_PRESETS = [
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
];

function TournamentAsyncState({ status, ...props }) {
  return (
    <AsyncState
      status={status}
      className={status === ASYNC_STATUS.ERROR ? "tournament-alert" : "tournament-empty"}
      retryButtonClassName="tournament-secondary-button"
      {...props}
    />
  );
}

function readyOrEmptyStatus(status) {
  return status === ASYNC_STATUS.EMPTY ? ASYNC_STATUS.SUCCESS : status;
}

function localizedActionError(error, fallback = "操作に失敗しました。もう一度お試しください。") {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(message) ? message : fallback;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function listToText(value) {
  if (value == null) return "";
  return Array.isArray(value) ? value.join("\n") : String(value);
}

function textToList(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeReferenceList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  return textToList(value);
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formFromTournament(tournament, knownRegulation = null) {
  const bannedCards = normalizeReferenceList(tournament.regulation?.bannedCards);
  const limitedCards = normalizeReferenceList(tournament.regulation?.limitedCards);
  return {
    ...DEFAULT_FORM,
    ...tournament,
    swissRounds: tournament.swissRounds ?? "",
    swissEndCondition: getSwissEndCondition(tournament),
    topCutSize: tournament.topCutSize ?? "",
    startsAt: toDateTimeLocal(tournament.startsAt),
    registrationClosesAt: toDateTimeLocal(tournament.registrationClosesAt),
    checkinOpensAt: toDateTimeLocal(tournament.checkinOpensAt),
    capacity: tournament.capacity ?? "",
    venue: tournament.venue || "",
    announcement: tournament.announcement || "",
    roundTimeMinutes: tournament.roundTimeMinutes ?? "",
    isOnline: Boolean(tournament.isOnline),
    isListed: tournament.isListed !== false,
    selfCheckin: Boolean(tournament.selfCheckin),
    decklistsPublic: Boolean(tournament.decklistsPublic),
    decklistRequired: Boolean(tournament.decklistRequired),
    lateEntry: Boolean(tournament.lateEntry),
    regulation: {
      ...DEFAULT_FORM.regulation,
      ...(tournament.regulation || {}),
      bannedCards,
      limitedCards,
      bannedCardInput: createRegulationCardState(bannedCards, {
        trustExistingIds: true,
        knownCards: knownRegulation?.bannedCardInput?.selectedCards,
      }),
      limitedCardInput: createRegulationCardState(limitedCards, {
        trustExistingIds: true,
        knownCards: knownRegulation?.limitedCardInput?.selectedCards,
      }),
      allowedSetInput: createRegulationSetState(tournament.regulation?.allowedSets),
    },
  };
}

function allowedSetsFromRegulation(regulation) {
  if (regulation?.allowedSetInput) {
    return getRegulationAllowedSets(regulation.allowedSetInput);
  }
  const values = textToList(regulation?.allowedSetsText ?? regulation?.allowedSets);
  return values.length ? values : null;
}

function allowedSetsMatch(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return listToText(left) === listToText(right);
}

function payloadFromForm(form) {
  return {
    title: form.title,
    description: form.description,
    format: form.format,
    swissRounds: numberOrNull(form.swissRounds),
    swissEndCondition: normalizeSwissEndCondition(form.swissEndCondition),
    topCutSize: numberOrNull(form.topCutSize),
    status: form.status,
    startsAt: fromDateTimeLocal(form.startsAt),
    registrationClosesAt: fromDateTimeLocal(form.registrationClosesAt),
    checkinOpensAt: fromDateTimeLocal(form.checkinOpensAt) || null,
    capacity: numberOrNull(form.capacity),
    venue: form.venue?.trim() ? form.venue.trim() : null,
    isOnline: Boolean(form.isOnline),
    isListed: Boolean(form.isListed),
    selfCheckin: Boolean(form.selfCheckin),
    decklistsPublic: Boolean(form.decklistsPublic),
    decklistRequired: Boolean(form.decklistRequired),
    announcement: form.announcement?.trim() ? form.announcement.trim() : null,
    roundTimeMinutes: numberOrNull(form.roundTimeMinutes),
    lateEntry: Boolean(form.lateEntry),
    regulation: {
      name: form.regulation.name,
      mainMin: Number(form.regulation.mainMin) || 0,
      mainMax: Number(form.regulation.mainMax) || 0,
      sideSize: Number(form.regulation.sideSize) || 0,
      maxCopies: Number(form.regulation.maxCopies) || 0,
      bannedCards: form.regulation.bannedCardInput
        ? getRegulationCardIds(form.regulation.bannedCardInput)
        : normalizeReferenceList(form.regulation.bannedCards),
      limitedCards: form.regulation.limitedCardInput
        ? getRegulationCardIds(form.regulation.limitedCardInput)
        : normalizeReferenceList(form.regulation.limitedCards),
      allowedSets: allowedSetsFromRegulation(form.regulation),
    },
  };
}

function countCards(items, zone) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => !zone || item.zone === zone)
    .reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function formatDeckItemsCount(items) {
  const { mainCount, sideCount } = getDeckCounts(items);
  return formatDeckCountSummary(mainCount, sideCount);
}

function splitDeckItems(items) {
  const deckItems = Array.isArray(items) ? items : [];
  return {
    mainItems: deckItems.filter((item) => item.zone !== "side"),
    sideItems: deckItems.filter((item) => item.zone === "side"),
  };
}

function buildEntryDeckExport(entry, formatParticipantName) {
  const { mainItems, sideItems } = splitDeckItems(entry.deckItems);
  const name = formatParticipantName(entry, entry.id || "-");
  const deckText = mainItems.length || sideItems.length
    ? buildDeckExport(groupDeckItemsByType(mainItems), sideItems)
    : "未提出";
  return [`# ${name}`, deckText].join("\n");
}

function buildAllDeckExport(entries, formatParticipantName) {
  return (entries || [])
    .map((entry) => buildEntryDeckExport(entry, formatParticipantName))
    .join("\n\n---\n\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value, fallback) {
  const name = String(value || fallback || "download")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  return name || fallback || "download";
}

function findEntry(entries, entryId) {
  return entries.find((entry) => entry.id === entryId) || null;
}

function entryName(entries, entryId, formatParticipantName) {
  return formatParticipantName(findEntry(entries, entryId), entryId || "Bye");
}

function scoreLabel(match) {
  if (match.result === "bye") return "不戦勝";
  if (match.player1Games != null && match.player2Games != null) {
    return `${match.player1Games}-${match.player2Games}`;
  }
  if (match.result === "p1_win") return "P1勝利";
  if (match.result === "p2_win") return "P2勝利";
  if (match.result === "draw") return "引き分け";
  return "未報告";
}

function roundIsComplete(round) {
  return (round.matches || []).every((match) => Boolean(match.result));
}

function regulationMatchesPreset(regulation, presetRegulation) {
  const bannedCards = regulation?.bannedCardInput
    ? getRegulationCardIds(regulation.bannedCardInput)
    : normalizeReferenceList(regulation?.bannedCards);
  const limitedCards = regulation?.limitedCardInput
    ? getRegulationCardIds(regulation.limitedCardInput)
    : normalizeReferenceList(regulation?.limitedCards);
  const hasUnresolvedCards =
    getRegulationCardErrors("禁止カード", regulation?.bannedCardInput).length > 0 ||
    getRegulationCardErrors("制限カード", regulation?.limitedCardInput).length > 0;
  return (
    !hasUnresolvedCards &&
    regulation?.name === presetRegulation?.name &&
    Number(regulation?.mainMin) === Number(presetRegulation?.mainMin) &&
    Number(regulation?.mainMax) === Number(presetRegulation?.mainMax) &&
    Number(regulation?.sideSize) === Number(presetRegulation?.sideSize) &&
    Number(regulation?.maxCopies) === Number(presetRegulation?.maxCopies) &&
    allowedSetsMatch(allowedSetsFromRegulation(regulation), presetRegulation?.allowedSets) &&
    listToText(bannedCards) === listToText(presetRegulation?.bannedCards) &&
    listToText(limitedCards) === listToText(presetRegulation?.limitedCards)
  );
}

function regulationCardInputErrors(regulation) {
  return [
    ...getRegulationCardErrors("禁止カード", regulation?.bannedCardInput),
    ...getRegulationCardErrors("制限カード", regulation?.limitedCardInput),
  ];
}

function hasMoreRoundsToPlay(form, rounds, activeEntryCount) {
  const completed = rounds.filter((round) => round.status === "completed");
  const lastCompleted = completed[completed.length - 1];

  if (form.format === "single_elim") {
    return !lastCompleted || (lastCompleted.matches || []).length > 1;
  }

  const topCutCompleted = completed.filter((round) => round.stage === "top_cut");
  if (topCutCompleted.length > 0) {
    const lastTopCut = topCutCompleted[topCutCompleted.length - 1];
    return (lastTopCut.matches || []).length > 1;
  }

  const swissCompleted = completed.filter((round) => round.stage !== "top_cut").length;
  const swissLimit =
    getSwissRoundCount(form) ??
    Math.max(1, Math.ceil(Math.log2(Math.max(2, activeEntryCount))));
  if (swissCompleted < swissLimit) return true;
  return Boolean(numberOrNull(form.topCutSize));
}

function pairingEntriesForRound(entries, roundNumber) {
  return (entries || []).filter(
    (entry) =>
      entry.status === "checked_in" &&
      !entry.isWaitlisted &&
      Number(entry.joinedAtRound || 1) <= Number(roundNumber)
  );
}

function uncheckedEntriesForRound(entries, roundNumber) {
  return (entries || []).filter(
    (entry) =>
      entry.status === "registered" &&
      !entry.isWaitlisted &&
      Number(entry.joinedAtRound || 1) <= Number(roundNumber)
  );
}

function compareEntriesByRegistrationOrder(left, right) {
  const createdAtComparison = String(left.createdAt || "").localeCompare(
    String(right.createdAt || "")
  );
  if (createdAtComparison !== 0) return createdAtComparison;
  return String(left.id).localeCompare(String(right.id), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function roundGenerationDisabledReason(form, rounds, entries) {
  if (form.status === "completed") {
    return "大会は完了しています。";
  }

  if ((rounds || []).some((round) => round.status !== "completed")) {
    return "現在のラウンドを完了してください。";
  }

  const nextRoundNumber = (rounds || []).length + 1;
  const activeEntryCount = pairingEntriesForRound(entries, nextRoundNumber).length;
  if (activeEntryCount < 2) {
    return `次ラウンド生成にはチェックイン済みの参加者が2人以上必要です（現在${activeEntryCount}人）。`;
  }

  if ((rounds || []).length > 0 && !hasMoreRoundsToPlay(form, rounds, activeEntryCount)) {
    return "予定されている全ラウンドが終了しています。";
  }

  return "";
}

function nextActionText(form, rounds, activeEntryCount) {
  const status = form.status;
  if (status === "draft") return "内容を保存して「受付開始」を押してください。";
  if (status === "registration") return "当日になったら「進行開始」→ラウンド生成を行ってください。";
  if (status === "in_progress" && rounds.length === 0) {
    return `${getRoundLabelForNumber(1, rounds, form)}を生成してください。`;
  }
  if (status === "in_progress") {
    const activeRound = [...rounds].reverse().find((round) => round.status !== "completed") || rounds[rounds.length - 1];
    if (rounds.length && rounds.every((round) => round.status === "completed")) {
      return hasMoreRoundsToPlay(form, rounds, activeEntryCount)
        ? "次のラウンドを生成してください。"
        : "「完了」を押して大会を終了してください。";
    }
    const unreportedCount = (activeRound?.matches || []).filter((match) => !match.result).length;
    if (unreportedCount > 0) return `未報告卓が${unreportedCount}卓あります。結果を入力してください。`;
    return "全卓報告済みです。「ラウンド完了」を押して次のラウンドへ進んでください。";
  }
  if (status === "completed") return "大会は完了しています。直前に完了したラウンドの結果を修正できます。";
  if (status === "cancelled") return "大会は中止されています。";
  return "大会状況を確認してください。";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAuditDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function parseDeckText(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return lines.map((line, index) => {
    const [name, count = "1", zone = "main"] = line.split(",").map((item) => item.trim());
    return {
      cardId: `manual-${Date.now()}-${index}`,
      card: { id: `manual-${index}`, name: name || `カード${index + 1}` },
      count: Number(count) || 1,
      zone: zone === "side" ? "side" : "main",
    };
  });
}

function remainingTime(round, minutes, now) {
  if (!round?.timerStartedAt || !minutes) return "未開始";
  const started = new Date(round.timerStartedAt).getTime();
  if (Number.isNaN(started)) return "未開始";
  const remainingMs = Math.max(0, started + Number(minutes) * 60000 - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return remainingMs <= 0 ? "時間切れ" : `${mm}:${ss}`;
}

function TournamentDeckRows({ items, compact }) {
  return (
    <table className="tournament-table tournament-card-table tournament-decklist-table">
      <thead>
        <tr>
          <th>区分</th>
          <th>番号</th>
          <th>カード</th>
          <th className="num">枚数</th>
        </tr>
      </thead>
      <tbody>
        {(items || []).map((item, index) => {
          const card = item.card || {};
          return (
            <tr key={`${item.cardId || card.name}-${item.zone || "main"}-${index}`}>
              <td data-label="区分">{item.zone === "side" ? "サイド" : "メイン"}</td>
              <td data-label="番号">{getCardCode(card) || "-"}</td>
              <td data-label="カード">
                <CardHoverPreview card={card} compact={compact}>
                  {card.name || item.cardId}
                </CardHoverPreview>
              </td>
              <td className="num" data-label="枚数">{item.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RoundRollbackConfirmDialog({
  firstDiscardedRoundLabel,
  isSubmitting,
  onCancel,
  onConfirm,
  releasesTournamentCompletion,
  targetRoundLabel,
}) {
  const hasLaterRounds = Boolean(firstDiscardedRoundLabel);
  const dialogTitle = hasLaterRounds ? "後続ラウンド破棄の確認" : "大会完了解除の確認";
  const description = [
    `${targetRoundLabel}を完了前に戻して結果を修正します。`,
    releasesTournamentCompletion
      ? "大会の完了状態も解除され、進行中に戻ります。"
      : "",
    hasLaterRounds
      ? `${firstDiscardedRoundLabel}以降のラウンドと対戦結果をすべて破棄します。破棄した内容は元に戻せません。`
      : "",
    "続行しますか？",
  ].join("");

  return (
    <div className="tournament-dialog-backdrop" role="presentation">
      <div
        className="tournament-deck-dialog tournament-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-rollback-dialog-title"
        aria-describedby="round-rollback-dialog-description"
      >
        <div className="tournament-dialog-header">
          <h3 id="round-rollback-dialog-title">{dialogTitle}</h3>
        </div>
        <p id="round-rollback-dialog-description">{description}</p>
        <div className="tournament-entry-actions tournament-confirm-actions">
          <button type="button" className="danger-button" onClick={onConfirm} disabled={isSubmitting}>
            {hasLaterRounds
              ? `${firstDiscardedRoundLabel}以降を破棄して修正`
              : "大会の完了状態を解除して修正"}
          </button>
          <button
            type="button"
            className="tournament-secondary-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

function KickEntryConfirmDialog({ entry, isSubmitting, onCancel, onConfirm }) {
  const [ban, setBan] = useState(false);
  const canBan = entry.user?.id != null;

  return (
    <div className="tournament-dialog-backdrop" role="presentation">
      <div
        className="tournament-deck-dialog tournament-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kick-entry-dialog-title"
        aria-describedby="kick-entry-dialog-description"
      >
        <div className="tournament-dialog-header">
          <h3 id="kick-entry-dialog-title">参加者をキック</h3>
        </div>
        <p id="kick-entry-dialog-description">
          {entry.user?.name || "この参加者"}を大会枠から外します。対戦表に登場済みの場合は、
          過去の戦績を保持するためドロップ扱いになります。
        </p>
        {canBan ? (
          <label className="tournament-checkbox tournament-kick-ban-option">
            <input
              type="checkbox"
              checked={ban}
              onChange={(event) => setBan(event.target.checked)}
            />
            再エントリーも禁止する
          </label>
        ) : (
          <p className="tournament-muted">
            ユーザーIDのないゲストは、再エントリー禁止の対象にはできません。
          </p>
        )}
        <div className="tournament-entry-actions tournament-confirm-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => onConfirm(canBan && ban)}
            disabled={isSubmitting}
          >
            {canBan && ban ? "キックして再エントリーも禁止" : "キックのみ実行"}
          </button>
          <button
            type="button"
            className="tournament-secondary-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

function RoundManagePanel({
  entries,
  formatParticipantName,
  form,
  isSubmitting,
  onFinishRound,
  onGenerateRound,
  onReportScore,
  onReopenRound,
  onRepairRound,
  onSaveAnnouncement,
  onSavePairings,
  onStartTimer,
  rounds,
  selectedRoundNumber,
  setSelectedRoundNumber,
}) {
  const [editingMatchId, setEditingMatchId] = useState("");
  const [customScore, setCustomScore] = useState({ player1Games: "", player2Games: "" });
  const [pairingEdits, setPairingEdits] = useState([]);
  const [announcementText, setAnnouncementText] = useState(form.announcement || "");
  const [now, setNow] = useState(Date.now());
  const selectedRound = useMemo(
    () => rounds.find((round) => Number(round.number) === Number(selectedRoundNumber)) || rounds[rounds.length - 1],
    [rounds, selectedRoundNumber]
  );
  const latestCompletedRound = useMemo(
    () =>
      rounds
        .filter((round) => round.status === "completed")
        .reduce(
          (latest, round) =>
            !latest || Number(round.number) > Number(latest.number) ? round : latest,
          null
        ),
    [rounds]
  );
  const activeEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status === "checked_in" &&
          !entry.isWaitlisted &&
          Number(entry.joinedAtRound || 1) <= Number(selectedRound?.number || 1)
      ),
    [entries, selectedRound]
  );
  const nextRoundNumber = rounds.length + 1;
  const uncheckedEntryCount = uncheckedEntriesForRound(entries, nextRoundNumber).length;
  const generateRoundDisabledReason = roundGenerationDisabledReason(form, rounds, entries);
  const generateRoundDisabled = isSubmitting || Boolean(generateRoundDisabledReason);
  const generateRoundDescriptionIds = [
    generateRoundDisabledReason ? "round-generation-disabled-reason" : "",
    uncheckedEntryCount > 0 ? "round-generation-unchecked-notice" : "",
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const roundGenerationMessages = (
    <>
      {generateRoundDisabledReason ? (
        <p id="round-generation-disabled-reason" className="tournament-muted">
          次ラウンドを生成できません: {generateRoundDisabledReason}
        </p>
      ) : null}
      {uncheckedEntryCount > 0 ? (
        <p id="round-generation-unchecked-notice" className="tournament-checkin-warning">
          {`未チェックインが${uncheckedEntryCount}人います。チェックインせずに次ラウンドを生成すると、その${uncheckedEntryCount}人はペアリング対象から除外されます。`}
        </p>
      ) : null}
    </>
  );

  useEffect(() => {
    setAnnouncementText(form.announcement || "");
  }, [form.announcement]);

  useEffect(() => {
    if (!selectedRound) {
      setPairingEdits([]);
      return;
    }
    setPairingEdits(
      (selectedRound.matches || []).map((match) => ({
        id: match.id,
        tableNo: match.tableNo,
        player1EntryId: match.player1EntryId,
        player2EntryId: match.player2EntryId || "",
      }))
    );
  }, [selectedRound]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  if (!rounds.length) {
    return (
      <section className="tournament-tab-panel">
        <div className="tournament-round-header">
          <h2>ラウンド運営</h2>
          <button
            type="button"
            onClick={onGenerateRound}
            disabled={generateRoundDisabled}
            title={generateRoundDisabledReason || undefined}
            aria-describedby={generateRoundDescriptionIds}
          >
            次ラウンド生成
          </button>
        </div>
        {roundGenerationMessages}
        {!form.roundTimeMinutes ? (
          <p className="tournament-muted">大会情報タブでラウンド制限時間を設定すると、残り時間タイマーを表示できます。</p>
        ) : null}
        <div className="tournament-empty">まだラウンドがありません。</div>
      </section>
    );
  }

  const canEditPairing = selectedRound?.status !== "completed";
  const reopenDisabledReason =
    latestCompletedRound?.id !== selectedRound?.id
      ? `修正できるのは直前に完了した${
          latestCompletedRound ? getRoundLabel(latestCompletedRound, rounds) : "ラウンド"
        }だけです。`
      : !["in_progress", "completed"].includes(form.status)
        ? "進行中または完了した大会のラウンドのみ修正できます。"
        : "";

  return (
    <section className="tournament-tab-panel">
      <div className="tournament-round-header">
        <h2>ラウンド運営</h2>
        <button
          type="button"
          onClick={onGenerateRound}
          disabled={generateRoundDisabled}
          title={generateRoundDisabledReason || undefined}
          aria-describedby={generateRoundDescriptionIds}
        >
          次ラウンド生成
        </button>
      </div>
      {roundGenerationMessages}
      {!form.roundTimeMinutes ? (
        <p className="tournament-muted">大会情報タブでラウンド制限時間を設定すると、残り時間タイマーを表示できます。</p>
      ) : null}
      <RoundTabs
        rounds={rounds.map((round) => ({ ...round, isCurrent: round.status !== "completed" }))}
        selectedRoundNumber={selectedRoundNumber}
        onChange={setSelectedRoundNumber}
      />
      {selectedRound ? (
        <>
          <div className="tournament-manage-strip">
            <span>{getRoundProgressLabel(selectedRound, rounds, form)}</span>
            <span>{selectedRound.status === "completed" ? "完了" : "進行中"}</span>
            {form.roundTimeMinutes ? <span>残り {remainingTime(selectedRound, form.roundTimeMinutes, now)}</span> : null}
            {form.roundTimeMinutes ? (
              <button
                type="button"
                onClick={() => onStartTimer(selectedRound.id)}
                disabled={isSubmitting || selectedRound.status === "completed" || form.status === "completed"}
              >
                {selectedRound.timerStartedAt ? "タイマー再開始" : "タイマー開始"}
              </button>
            ) : null}
          </div>
          {selectedRound.stage === "top_cut" ? (
            <Bracket rounds={rounds} entries={entries} showResults />
          ) : null}
          {(selectedRound.matches || []).length > 0 ? (
            <div className="tournament-table-wrap tournament-card-table-wrap">
              <table className="tournament-table tournament-card-table manage-table">
              <thead>
                <tr>
                  <th className="num">卓</th>
                  <th>プレイヤー1</th>
                  <th>プレイヤー2</th>
                  <th>結果</th>
                  <th>入力</th>
                </tr>
              </thead>
              <tbody>
                {(selectedRound.matches || []).map((match) => {
                  const isReported = Boolean(match.result);
                  const isBye = !match.player2EntryId || match.result === "bye";
                  return (
                    <tr key={match.id} className={!isReported ? "unreported-match" : ""}>
                      <td className="num" data-label="卓">{match.tableNo}</td>
                      <td className="tournament-card-title-cell" data-label="プレイヤー1">
                        {entryName(entries, match.player1EntryId, formatParticipantName)}
                      </td>
                      <td data-label="プレイヤー2">
                        {isBye
                          ? "Bye"
                          : entryName(entries, match.player2EntryId, formatParticipantName)}
                      </td>
                      <td data-label="結果">
                        {isReported ? (
                          <span className={`score-badge ${match.result === "p2_win" ? "loss" : ""}`}>
                            {scoreLabel(match)}
                          </span>
                        ) : (
                          <span className="tournament-muted">未報告</span>
                        )}
                      </td>
                      <td className="tournament-score-actions" data-label="入力">
                        {isBye ? (
                          <span className="tournament-muted">自動</span>
                        ) : selectedRound.status === "completed" || form.status === "completed" ? (
                          <span className="tournament-muted">完了</span>
                        ) : editingMatchId === match.id || !isReported ? (
                          <>
                            {BO3_PRESETS.filter(
                              ([p1, p2]) => selectedRound.stage !== "top_cut" || p1 !== p2
                            ).map(([p1, p2]) => (
                              <button
                                key={`${match.id}-${p1}-${p2}`}
                                type="button"
                                onClick={() => onReportScore(match.id, p1, p2).then(() => setEditingMatchId(""))}
                              >
                                {p1}-{p2}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMatchId(match.id);
                                setCustomScore({
                                  player1Games: match.player1Games ?? "",
                                  player2Games: match.player2Games ?? "",
                                });
                              }}
                            >
                              任意スコア
                            </button>
                            {editingMatchId === match.id ? (
                              <span className="custom-score-input">
                                <input
                                  aria-label="プレイヤー1ゲーム数"
                                  aria-invalid={
                                    selectedRound.stage === "top_cut" &&
                                    customScore.player1Games !== "" &&
                                    customScore.player2Games !== "" &&
                                    Number(customScore.player1Games) === Number(customScore.player2Games)
                                  }
                                  type="number"
                                  min="0"
                                  max="2"
                                  value={customScore.player1Games}
                                  onChange={(event) =>
                                    setCustomScore((current) => ({ ...current, player1Games: event.target.value }))
                                  }
                                />
                                <input
                                  aria-label="プレイヤー2ゲーム数"
                                  aria-invalid={
                                    selectedRound.stage === "top_cut" &&
                                    customScore.player1Games !== "" &&
                                    customScore.player2Games !== "" &&
                                    Number(customScore.player1Games) === Number(customScore.player2Games)
                                  }
                                  type="number"
                                  min="0"
                                  max="2"
                                  value={customScore.player2Games}
                                  onChange={(event) =>
                                    setCustomScore((current) => ({ ...current, player2Games: event.target.value }))
                                  }
                                />
                                <button
                                  type="button"
                                  disabled={
                                    customScore.player1Games === "" ||
                                    customScore.player2Games === "" ||
                                    (selectedRound.stage === "top_cut" &&
                                      Number(customScore.player1Games) === Number(customScore.player2Games))
                                  }
                                  onClick={() =>
                                    onReportScore(
                                      match.id,
                                      Number(customScore.player1Games),
                                      Number(customScore.player2Games)
                                    ).then(() => setEditingMatchId(""))
                                  }
                                >
                                  保存
                                </button>
                                {selectedRound.stage === "top_cut" &&
                                customScore.player1Games !== "" &&
                                customScore.player2Games !== "" &&
                                Number(customScore.player1Games) === Number(customScore.player2Games) ? (
                                  <span className="tournament-checkin-warning" role="alert">
                                    SEラウンドでは同数のスコアを保存できません。
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <button type="button" onClick={() => setEditingMatchId(match.id)}>
                            訂正
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          ) : (
            <div className="tournament-empty">このラウンドには対戦がありません。</div>
          )}
          <details className="pairing-editor">
            <summary>ペアリング編集</summary>
            <div className="pairing-editor-list">
              {pairingEdits.map((match, index) => (
                <div key={match.id || index} className="pairing-editor-row">
                  <label>
                    卓番号
                    <input
                      type="number"
                      min="1"
                      value={match.tableNo}
                      disabled={!canEditPairing}
                      onChange={(event) =>
                        setPairingEdits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, tableNo: event.target.value } : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    プレイヤー1
                    <select
                      value={match.player1EntryId}
                      disabled={!canEditPairing}
                      onChange={(event) =>
                        setPairingEdits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, player1EntryId: event.target.value } : item
                          )
                        )
                      }
                    >
                      {activeEntries.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {formatParticipantName(entry, entry.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    プレイヤー2
                    <select
                      value={match.player2EntryId}
                      disabled={!canEditPairing}
                      onChange={(event) =>
                        setPairingEdits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, player2EntryId: event.target.value } : item
                          )
                        )
                      }
                    >
                      <option value="">Bye</option>
                      {activeEntries.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {formatParticipantName(entry, entry.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
            <div className="tournament-entry-actions">
              <button
                type="button"
                disabled={!canEditPairing || isSubmitting}
                onClick={() => onSavePairings(selectedRound.id, pairingEdits)}
              >
                ペアリングを保存
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={!canEditPairing || isSubmitting}
                onClick={() => onRepairRound(selectedRound.id)}
              >
                破棄して組み直す
              </button>
            </div>
          </details>
          <div className="tournament-entry-actions tournament-manage-actions">
            {selectedRound.status === "completed" ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(reopenDisabledReason) || isSubmitting}
                  title={reopenDisabledReason || undefined}
                  onClick={() => onReopenRound(selectedRound.id)}
                >
                  結果を修正
                </button>
                {reopenDisabledReason ? (
                  <span className="tournament-muted">{reopenDisabledReason}</span>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                disabled={!roundIsComplete(selectedRound) || isSubmitting || form.status === "completed"}
                onClick={() => onFinishRound(selectedRound.id)}
              >
                ラウンド完了
              </button>
            )}
          </div>
          <div className="announcement-editor">
            <label>
              アナウンス
              <textarea value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} />
            </label>
            <button type="button" onClick={() => onSaveAnnouncement(announcementText)} disabled={isSubmitting}>
              掲示する
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function ParticipantsPanel({
  bans = [],
  bansStatus,
  bansError,
  compact,
  entries,
  formatParticipantName,
  form,
  isSubmitting,
  onApprove,
  onCreateManual,
  onDeckLockChange,
  onDeckRegister,
  onKick,
  onPromoteWaitlist,
  onReject,
  onRetryBans,
  onRetryRounds,
  onStatusChange,
  onUnban,
  rounds,
  roundsStatus,
  roundsError,
}) {
  const [missingOnly, setMissingOnly] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualDeckText, setManualDeckText] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [kickTarget, setKickTarget] = useState(null);
  const pendingEntries = entries.filter((entry) => entry.status === "pending");
  const waitlistedEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.isWaitlisted && entry.status !== "dropped")
        .slice()
        .sort(compareEntriesByRegistrationOrder),
    [entries]
  );
  const waitlistPositions = useMemo(
    () => new Map(waitlistedEntries.map((entry, index) => [entry.id, index + 1])),
    [waitlistedEntries]
  );
  const visibleEntries = entries.filter(
    (entry) => !missingOnly || entry.decklistState === "none"
  );
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) || null;
  // デッキ詳細は参加者表の後ろに描画されるため、参加者が多いと「閲覧」を押した位置から
  // 画面数個ぶん離れた場所に出る。押しても何も起きなかったように見えるので、
  // 開いたら見出しへスクロールしてフォーカスを移す。
  const deckViewerHeadingRef = useRef(null);
  useEffect(() => {
    if (!selectedEntryId) return;
    const heading = deckViewerHeadingRef.current;
    if (!heading) return;
    heading.scrollIntoView({ block: "start" });
    heading.focus();
  }, [selectedEntryId]);
  const selectedDeck = useMemo(() => splitDeckItems(selectedEntry?.deckItems), [selectedEntry?.deckItems]);
  const selectedMainCount = countCards(selectedDeck.mainItems);
  const selectedSideCount = countCards(selectedDeck.sideItems);
  const { previewBlob, isRendering: isPreviewRendering } = useDeckPreview({
    open: Boolean(selectedEntry?.deckItems?.length),
    mainItems: selectedDeck.mainItems,
    sideItems: selectedDeck.sideItems,
    mainCount: selectedMainCount,
    sideCount: selectedSideCount,
  });
  const nextRound = Math.max(1, (rounds || []).length + 1);
  const decklistChangesBlocked = form.status === "completed";
  const bansReady = [ASYNC_STATUS.EMPTY, ASYNC_STATUS.SUCCESS].includes(bansStatus);
  const roundsReady = [ASYNC_STATUS.EMPTY, ASYNC_STATUS.SUCCESS].includes(roundsStatus);

  const copyAllDecks = async () => {
    setExportMessage("");
    setExportError("");
    try {
      await navigator.clipboard.writeText(buildAllDeckExport(entries, formatParticipantName));
      setExportMessage("デッキリストを一括コピーしました。");
    } catch (copyError) {
      setExportError("クリップボードへコピーできませんでした。");
    }
  };

  const downloadAllDecks = () => {
    setExportMessage("");
    setExportError("");
    const blob = new Blob([buildAllDeckExport(entries, formatParticipantName)], {
      type: "text/plain;charset=utf-8",
    });
    downloadBlob(blob, `${safeFilename(form.title, "tournament")}-decklists.txt`);
    setExportMessage("デッキリストの .txt を作成しました。");
  };

  const downloadDeckImage = () => {
    if (!previewBlob || !selectedEntry) return;
    const fileBase = `${form.title || "tournament"}-${formatParticipantName(
      selectedEntry,
      selectedEntry.id
    )}`;
    downloadBlob(previewBlob, `${safeFilename(fileBase, "deck")}.png`);
  };

  return (
    <section className="tournament-tab-panel">
      <div className="tournament-round-header">
        <h2>参加者</h2>
        <label className="inline-check">
          <input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} />
          未提出のみ
        </label>
      </div>
      <div className="tournament-output-actions">
        <button type="button" onClick={copyAllDecks} disabled={isSubmitting}>
          デッキリスト一括コピー
        </button>
        <button type="button" onClick={downloadAllDecks} disabled={isSubmitting}>
          一括ダウンロード(.txt)
        </button>
      </div>
      {exportMessage ? <div className="tournament-success">{exportMessage}</div> : null}
      {exportError ? <div className="tournament-alert">{exportError}</div> : null}
      {!roundsReady ? (
        <TournamentAsyncState
          status={roundsStatus}
          error={roundsError}
          idleMessage="ラウンド情報はまだ読み込まれていません。"
          loadingMessage="ラウンド情報を読み込み中..."
          errorMessage="参加ラウンドの情報を読み込めませんでした。"
          onRetry={onRetryRounds}
        />
      ) : null}
      {form.capacity !== "" && form.capacity != null ? (
        <div className="pending-entry-section">
          <div className="tournament-round-header">
            <h3>キャンセル待ち</h3>
            <button
              type="button"
              onClick={onPromoteWaitlist}
              disabled={isSubmitting || waitlistedEntries.length === 0}
            >
              キャンセル待ちを繰り上げる
            </button>
          </div>
          <p>
            チェックイン済みの参加者数が定員未満の場合、チェックイン済みのキャンセル待ちを登録順に繰り上げます。
          </p>
          {waitlistedEntries.length ? (
            <p className="tournament-muted">
              待機中 {waitlistedEntries.length}人 / チェックイン済み {waitlistedEntries.filter((entry) => entry.status === "checked_in").length}人
            </p>
          ) : (
            <p className="tournament-muted">キャンセル待ちの参加者はいません。</p>
          )}
        </div>
      ) : null}
      {form.lateEntry && pendingEntries.length ? (
        <div className="pending-entry-section">
          <h3>申請中</h3>
          {pendingEntries.map((entry) => (
            <div key={entry.id} className="pending-entry-row">
              <div>
                <strong>{formatParticipantName(entry, entry.id)}</strong>
                <p>
                  {`許可後にチェックインすると、${getRoundLabelForNumber(
                    entry.joinedAtRound || nextRound,
                    rounds,
                    form
                  )}からペアリング対象になります。それ以前は不戦敗として扱われます。`}
                </p>
              </div>
              <div className="tournament-row-actions">
                <button type="button" onClick={() => onApprove(entry.id)} disabled={isSubmitting || !roundsReady}>
                  許可
                </button>
                <button type="button" onClick={() => onReject(entry.id)} disabled={isSubmitting}>
                  却下
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="pending-entry-section tournament-ban-section">
        <h3>再エントリー禁止中</h3>
        <TournamentAsyncState
          status={bansStatus}
          error={bansError}
          idleMessage="再エントリー禁止情報はまだ読み込まれていません。"
          loadingMessage="再エントリー禁止情報を読み込み中..."
          emptyMessage="再エントリー禁止中のユーザーはいません。"
          errorMessage="再エントリー禁止情報を読み込めませんでした。"
          onRetry={onRetryBans}
        >
          <>
            {bans.map((record) => (
              <div key={record.user.id} className="pending-entry-row">
                <div>
                  <strong>{record.user.name || "参加者"}</strong>
                  <p>
                    ユーザーID: {record.user.id}
                    {record.bannedAt ? ` / 禁止日時: ${formatAuditDateTime(record.bannedAt)}` : ""}
                  </p>
                </div>
                <div className="tournament-row-actions">
                  <button
                    type="button"
                    onClick={() => onUnban(record.user.id)}
                    disabled={isSubmitting}
                    aria-label={`${record.user.name || "参加者"} の再エントリー禁止を解除`}
                  >
                    禁止を解除
                  </button>
                </div>
              </div>
            ))}
          </>
        </TournamentAsyncState>
      </div>
      <div className="manual-entry-form">
        <h3>+ 参加者を追加</h3>
        <input
          aria-label="参加者名"
          placeholder="参加者名"
          value={manualName}
          onChange={(event) => setManualName(event.target.value)}
        />
        {/* プレースホルダーだけだと入力を始めた時点で記法が読めなくなる */}
        <label className="manual-entry-deck-field" htmlFor="manual-entry-deck">
          <span>デッキリスト(任意)</span>
          <textarea
            id="manual-entry-deck"
            aria-label="任意デッキ"
            aria-describedby="manual-entry-deck-help"
            value={manualDeckText}
            onChange={(event) => setManualDeckText(event.target.value)}
          />
          <span id="manual-entry-deck-help" className="tournament-muted">
            1行に1枚ずつ「カード名,枚数,main」または「カード名,枚数,side」。
            main はメインデッキ、side はサイドボードです。
            <br />
            例: ガンダム,3,main
          </span>
        </label>
        <button
          type="button"
          disabled={isSubmitting || !manualName.trim()}
          onClick={() =>
            onCreateManual(manualName, manualDeckText).then(() => {
              setManualName("");
              setManualDeckText("");
            })
          }
        >
          追加
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="tournament-empty">参加者はまだ登録されていません。</div>
      ) : visibleEntries.length === 0 ? (
        <div className="tournament-empty">デッキリスト未提出の参加者はいません。</div>
      ) : (
        <div className="tournament-table-wrap tournament-card-table-wrap">
          <table className="tournament-table tournament-card-table tournament-participants-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>名前</th>
              <th>参加状態</th>
              <th>デッキリスト</th>
              <th>デッキ操作の履歴</th>
              <th>参加区分</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry, index) => {
              const awaitingResubmission = Boolean(entry.deckUnlockedAt && !entry.deckLockedAt);
              const canUnlock = Boolean(entry.deckLockedAt && form.status !== "completed");
              const canRelock = Boolean(
                !entry.deckLockedAt && entry.deckUnlockedAt && !decklistChangesBlocked
              );
              const isBanned = Boolean(
                entry.user?.id != null &&
                  bans.some((record) => record.user.id === String(entry.user.id))
              );
              return (
                <tr key={entry.id}>
                  <td className="num" data-label="番号">{index + 1}</td>
                  <td className="tournament-card-title-cell" data-label="名前">
                    {formatParticipantName(entry, "-")}
                  </td>
                  <td data-label="参加状態">
                    {entry.isWaitlisted && entry.status !== "dropped"
                      ? `キャンセル待ち（${waitlistPositions.get(entry.id)}番目） / ${ENTRY_STATUS_LABELS[entry.status] || entry.status}`
                      : ENTRY_STATUS_LABELS[entry.status] || entry.status}
                  </td>
                  <td data-label="デッキリスト">
                    <div className="tournament-deck-state-cell">
                      <span className={`decklist-state-badge ${entry.decklistState || "unknown"}`}>
                        {DECKLIST_STATE_LABELS[entry.decklistState] || "状態不明"}
                      </span>
                      {entry.decklistSubmittedAt ? (
                        <span className="tournament-deck-state-time">
                          提出 {formatDateTime(entry.decklistSubmittedAt)}
                        </span>
                      ) : null}
                      {entry.decklistState === "none" && entry.deckLockedAt ? (
                        <span className="mini-badge deck-lock-note">未提出のままロック中</span>
                      ) : null}
                      {awaitingResubmission ? (
                        <span className="mini-badge deck-unlocked-note">
                          {form.status === "completed"
                            ? "ロック解除済み・未再提出"
                            : "ロック解除済み・再提出待ち"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="デッキ操作の履歴">
                    <div className="tournament-deck-audit">
                      {entry.deckUpdatedAt ? (
                        <span>
                          {entry.deckUpdatedBy?.name || "主催者"}が修正 {formatAuditDateTime(entry.deckUpdatedAt)}
                        </span>
                      ) : null}
                      {entry.deckUnlockedAt ? (
                        <span>
                          {entry.deckUnlockedBy?.name || "主催者"}がロック解除 {formatAuditDateTime(entry.deckUnlockedAt)}
                        </span>
                      ) : null}
                      {!entry.deckUpdatedAt && !entry.deckUnlockedAt ? <span>-</span> : null}
                    </div>
                  </td>
                  <td data-label="参加区分">
                    {entry.user?.id == null ? <span className="mini-badge">ゲスト</span> : null}
                    {entry.isWaitlisted && entry.status !== "dropped" ? (
                      <span className="mini-badge">キャンセル待ち</span>
                    ) : null}
                    {Number(entry.joinedAtRound || 1) > 1 ? (
                      <span className="mini-badge">
                        {getRoundLabelForNumber(entry.joinedAtRound, rounds, form)}から
                      </span>
                    ) : null}
                  </td>
                  <td className="tournament-row-actions" data-label="操作">
                    <button type="button" onClick={() => setSelectedEntryId(entry.id)} disabled={isSubmitting}>
                      デッキリストを見る
                    </button>
                    {!decklistChangesBlocked ? (
                      <button type="button" onClick={() => onDeckRegister(entry.id)} disabled={isSubmitting}>
                        デッキ登録
                      </button>
                    ) : null}
                    {canUnlock ? (
                      <button
                        type="button"
                        onClick={() => onDeckLockChange(entry.id, false)}
                        disabled={isSubmitting}
                      >
                        ロックを解除して再提出可能にする
                      </button>
                    ) : null}
                    {canRelock ? (
                      <button
                        type="button"
                        onClick={() => onDeckLockChange(entry.id, true)}
                        disabled={isSubmitting}
                      >
                        手動で再ロック
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onStatusChange(entry.id, "checked_in")}
                      disabled={isSubmitting || !bansReady || isBanned}
                      title={
                        !bansReady
                          ? "再エントリー禁止情報の読み込み後に操作できます。"
                          : isBanned
                            ? "再エントリー禁止を解除してからチェックインしてください。"
                            : undefined
                      }
                    >
                      チェックイン
                    </button>
                    <button
                      type="button"
                      onClick={() => onStatusChange(entry.id, "dropped")}
                      disabled={isSubmitting}
                    >
                      ドロップ
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => setKickTarget(entry)}
                      disabled={isSubmitting}
                    >
                      キック
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}
      {selectedEntry ? (
        <div className="tournament-deck-viewer">
          <div className="tournament-round-header">
            <h3 ref={deckViewerHeadingRef} tabIndex={-1}>
              {formatParticipantName(selectedEntry, "-")} のデッキリスト
            </h3>
            <button type="button" onClick={() => setSelectedEntryId("")}>
              閉じる
            </button>
          </div>
          {selectedEntry.deckItems?.length ? (
            <>
              <div className="tournament-deck-summary">
                提出済み（{formatDeckItemsCount(selectedEntry.deckItems)}）
              </div>
              <div className="tournament-output-actions">
                <button type="button" onClick={downloadDeckImage} disabled={!previewBlob || isPreviewRendering}>
                  画像を保存
                </button>
              </div>
              <TournamentDeckRows items={selectedEntry.deckItems} compact={compact} />
            </>
          ) : (
            <div className="tournament-muted">デッキリストは提出されていません。</div>
          )}
        </div>
      ) : null}
      {kickTarget ? (
        <KickEntryConfirmDialog
          entry={kickTarget}
          isSubmitting={isSubmitting}
          onCancel={() => setKickTarget(null)}
          onConfirm={(ban) => {
            const entryId = kickTarget.id;
            setKickTarget(null);
            onKick(entryId, ban);
          }}
        />
      ) : null}
    </section>
  );
}

function CoOrganizersPanel({
  authMode,
  canManageCoOrganizers,
  isSubmitting,
  onAdd,
  onRemove,
  tournament,
}) {
  const [query, setQuery] = useState("");
  const searchRequestIdRef = useRef(0);
  const {
    status: searchStatus,
    data: results,
    error: searchError,
    start: startSearch,
    succeed: succeedSearch,
    fail: failSearch,
    reset: resetSearch,
  } = useAsyncResource([]);
  const coOrganizers = Array.isArray(tournament?.coOrganizers)
    ? tournament.coOrganizers
    : [];
  const operatorIds = new Set(
    [tournament?.createdBy, ...coOrganizers]
      .map((operator) => operator?.id == null ? "" : String(operator.id))
      .filter(Boolean)
  );
  const addableResults = results.filter(
    (candidate) => !operatorIds.has(String(candidate.id))
  );

  const runUserSearch = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    startSearch();
    try {
      const payload = await fetchUsers({ query: normalizedQuery, authMode });
      if (searchRequestIdRef.current !== requestId) return;
      succeedSearch(
        (payload.items || []).filter((candidate) => !operatorIds.has(String(candidate.id)))
      );
    } catch (_error) {
      if (searchRequestIdRef.current !== requestId) return;
      failSearch("ユーザーを検索できませんでした。");
    }
  };
  const searchUsers = (event) => {
    event.preventDefault();
    runUserSearch();
  };
  const displayedSearchStatus =
    searchStatus === ASYNC_STATUS.SUCCESS && addableResults.length === 0
      ? ASYNC_STATUS.EMPTY
      : searchStatus;

  useEffect(
    () => () => {
      searchRequestIdRef.current += 1;
    },
    []
  );

  return (
    <section className="tournament-tab-panel tournament-co-organizers" aria-labelledby="co-organizers-title">
      <h2 id="co-organizers-title">大会運営者</h2>
      <div className="pending-entry-section">
        <h3>主催者</h3>
        <p>
          {tournament?.createdBy?.id ? (
            <Link to={`/users/${tournament.createdBy.id}`}>
              {tournament.createdBy.name || tournament.createdBy.id}
            </Link>
          ) : (
            tournament?.createdBy?.name || "未設定"
          )}
        </p>
      </div>
      <div className="pending-entry-section">
        <h3>共同運営者</h3>
        {coOrganizers.length ? (
          coOrganizers.map((operator) => (
            <div key={operator.id} className="pending-entry-row">
              <div>
                <strong>
                  <Link to={`/users/${operator.id}`}>{operator.name || operator.id}</Link>
                </strong>
                <p>ユーザーID: {operator.id}</p>
              </div>
              {canManageCoOrganizers ? (
                <button
                  type="button"
                  className="danger-button"
                  disabled={isSubmitting}
                  aria-label={`${operator.name || operator.id} を共同運営者から削除`}
                  onClick={() => onRemove(operator.id)}
                >
                  削除
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="tournament-muted">共同運営者はいません。</p>
        )}
      </div>
      {canManageCoOrganizers ? (
        <div className="pending-entry-section">
          <h3>共同運営者を追加</h3>
          <form className="manual-entry-form" onSubmit={searchUsers}>
            <input
              aria-label="共同運営者を検索"
              placeholder="ニックネーム・ユーザーIDで検索"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                searchRequestIdRef.current += 1;
                resetSearch();
              }}
            />
            <button type="submit" disabled={searchStatus === ASYNC_STATUS.LOADING || !query.trim()}>
              {searchStatus === ASYNC_STATUS.LOADING ? "検索中..." : "検索"}
            </button>
          </form>
          <TournamentAsyncState
            status={displayedSearchStatus}
            error={searchError}
            idleMessage="共同運営者の検索はまだ実行されていません。"
            loadingMessage="ユーザーを検索中..."
            emptyMessage="追加できるユーザーが見つかりません。"
            errorMessage="ユーザーを検索できませんでした。"
            onRetry={runUserSearch}
          >
            <>
              {addableResults.map((candidate) => {
                const label = candidate.nickname || candidate.id;
                return (
                  <div key={candidate.id} className="pending-entry-row">
                    <div>
                      <strong>{label}</strong>
                      <p>ユーザーID: {candidate.id}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      aria-label={`${label} を共同運営者に追加`}
                      onClick={() => onAdd(candidate.id)}
                    >
                      追加
                    </button>
                  </div>
                );
              })}
            </>
          </TournamentAsyncState>
        </div>
      ) : (
        <p className="tournament-muted">共同運営者の追加・削除は主催者または管理者のみ行えます。</p>
      )}
    </section>
  );
}

function InfoPanel({
  entries,
  form,
  formatParticipantName,
  hasRounds,
  roundSettingsLockMessage,
  isNew,
  isSubmitting,
  onSave,
  regulationViolations,
  setField,
  setOnline,
  setRegulationCardInput,
  setRegulationField,
  setRegulationSetInput,
}) {
  const selectedPreset = FORMAT_PRESETS.find((preset) =>
    regulationMatchesPreset(form.regulation, preset.regulation)
  );
  const selectedPresetName = selectedPreset?.name || OTHER_FORMAT_NAME;
  const cardInputErrors = regulationCardInputErrors(form.regulation);
  const setFormatPreset = (name) => {
    const preset = FORMAT_PRESETS.find((item) => item.name === name);
    if (!preset) return;
    setField("regulation", {
      ...preset.regulation,
      bannedCardInput: createRegulationCardState(preset.regulation?.bannedCards, {
        trustExistingIds: true,
        knownCards: form.regulation?.bannedCardInput?.selectedCards,
      }),
      limitedCardInput: createRegulationCardState(preset.regulation?.limitedCards, {
        trustExistingIds: true,
        knownCards: form.regulation?.limitedCardInput?.selectedCards,
      }),
      allowedSetInput: createRegulationSetState(preset.regulation?.allowedSets),
    });
  };

  return (
    <form className="tournament-manage-form" onSubmit={onSave}>
      {regulationViolations.length ? (
        <div className="tournament-validation-alert">
          <strong>レギュレーション変更で確認が必要なデッキがあります。</strong>
          <ul>
            {regulationViolations.map((item) => (
              <li key={item.entryId}>
                {formatParticipantName(
                  findEntry(entries, item.entryId),
                  item.entryName || item.entryId
                )}: {item.violations.map((violation) => violation.message).join(" / ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <section className="manage-form-section">
        <h2>基本情報</h2>
        <div className="tournament-form-grid">
          <label>
            タイトル
            <input value={form.title} onChange={(event) => setField("title", event.target.value)} required />
          </label>
          <label>
            定員（人）
            <input type="number" min="1" value={form.capacity} placeholder="制限なし" onChange={(event) => setField("capacity", event.target.value)} />
          </label>
          <label className="tournament-form-wide">
            説明
            <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </label>
          <div className="tournament-form-wide tournament-listing-setting">
            <label className="tournament-checkbox">
              <input
                type="checkbox"
                checked={form.isListed}
                aria-describedby="tournament-listing-description"
                onChange={(event) => setField("isListed", event.target.checked)}
              />
              大会一覧に掲載する
            </label>
            {/* 「ローカル大会」は同じ画面の「オンライン大会」(開催方式)と紛らわしい。
                ここは公開範囲の設定なので、公開範囲の言葉で書く。 */}
            <p id="tournament-listing-description" className="tournament-muted">
              オフにするとURL限定公開(一覧に非掲載)になり、大会一覧とホームの新着には表示されません。大会URLを知っている人だけが詳細を開き、通常どおり参加登録できます。開催方式(オンライン/会場)とは別の設定です。
            </p>
          </div>
        </div>
      </section>

      <section className="manage-form-section">
        <h2>日時と会場</h2>
        <div className="tournament-form-grid">
          <label>
            開始日時
            <input type="datetime-local" value={form.startsAt} onChange={(event) => setField("startsAt", event.target.value)} required />
          </label>
          <label>
            受付締切
            <input
              type="datetime-local"
              value={form.registrationClosesAt}
              onChange={(event) => setField("registrationClosesAt", event.target.value)}
            />
          </label>
          <label>
            チェックイン開始
            <input
              type="datetime-local"
              value={form.checkinOpensAt}
              max={form.startsAt || undefined}
              onChange={(event) => setField("checkinOpensAt", event.target.value)}
              title="大会の開始日時以前を設定してください"
            />
          </label>
          <label>
            開催地
            <input value={form.venue} placeholder="オンラインの場合は空で可" onChange={(event) => setField("venue", event.target.value)} />
          </label>
          <div className="manage-inline-checks">
            <label className="tournament-checkbox">
              <input type="checkbox" checked={form.isOnline} onChange={(event) => setOnline(event.target.checked)} />
              オンライン大会
            </label>
            <label className="tournament-checkbox">
              <input type="checkbox" checked={form.selfCheckin} onChange={(event) => setField("selfCheckin", event.target.checked)} />
              セルフチェックインを許可
            </label>
          </div>
        </div>
      </section>

      <section className="manage-form-section">
        <h2>進行方式</h2>
        <div className="tournament-form-grid">
          <label title={roundSettingsLockMessage}>
            形式 {hasRounds ? "🔒" : ""}
            <select value={form.format} onChange={(event) => setField("format", event.target.value)} disabled={hasRounds}>
              <option value="swiss">スイス</option>
              <option value="single_elim">シングルエリミネーション</option>
            </select>
          </label>
          {/* スイス回戦数・終了条件・トップカットはスイスにしか効かない。
              シングルエリミネーションでも編集できると、どの値が使われるのか
              分からなくなるので、形式に応じて出し分ける。 */}
          {form.format === "swiss" ? (
            <>
              <label title={roundSettingsLockMessage}>
                スイス回戦数（回戦） {hasRounds ? "🔒" : ""}
                <input
                  type="number"
                  min="1"
                  aria-label="スイス回戦数"
                  value={form.swissRounds}
                  placeholder="自動"
                  disabled={hasRounds}
                  onChange={(event) => setField("swissRounds", event.target.value)}
                />
                <span className="tournament-muted">未入力の場合、参加人数から初戦生成時に確定します。</span>
              </label>
              <label title={roundSettingsLockMessage}>
                終了条件 {hasRounds ? "🔒" : ""}
                <select
                  aria-label="終了条件"
                  value={form.swissEndCondition}
                  disabled={hasRounds}
                  onChange={(event) => setField("swissEndCondition", event.target.value)}
                >
                  <option value={SWISS_END_CONDITION_FIXED_ROUNDS}>規定回戦数で終了</option>
                  <option value={SWISS_END_CONDITION_UNDEFEATED}>全勝者が1人以下になったら終了</option>
                </select>
              </label>
              <label title={roundSettingsLockMessage}>
                トップカット（人） {hasRounds ? "🔒" : ""}
                <input
                  type="number"
                  min="2"
                  value={form.topCutSize}
                  placeholder="なし"
                  disabled={hasRounds}
                  onChange={(event) => setField("topCutSize", event.target.value)}
                />
              </label>
            </>
          ) : (
            <p className="tournament-muted">
              シングルエリミネーションでは、スイス回戦数・終了条件・トップカットは使いません。
            </p>
          )}
          <label>
            ラウンド制限時間（分）
            <input
              type="number"
              min="1"
              value={form.roundTimeMinutes}
              placeholder="なし"
              onChange={(event) => setField("roundTimeMinutes", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="manage-form-section">
        <h2>デッキとレギュレーション</h2>
        <div className="tournament-form-grid">
          <label className="tournament-checkbox">
            <input type="checkbox" checked={form.decklistRequired} onChange={(event) => setField("decklistRequired", event.target.checked)} />
            デッキリスト必須
          </label>
          <label className="tournament-checkbox">
            <input type="checkbox" checked={form.decklistsPublic} onChange={(event) => setField("decklistsPublic", event.target.checked)} />
            終了後にデッキリストを公開
          </label>
          <label className="tournament-checkbox">
            <input type="checkbox" checked={form.lateEntry} onChange={(event) => setField("lateEntry", event.target.checked)} />
            途中参加を許可
          </label>
          <label>
            フォーマットプリセット
            <select value={selectedPresetName} onChange={(event) => setFormatPreset(event.target.value)}>
              {FORMAT_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
              <option value={OTHER_FORMAT_NAME}>{OTHER_FORMAT_NAME}</option>
            </select>
          </label>
        </div>
        {selectedPreset?.note ? (
          <p className="tournament-muted">補足: {selectedPreset.note}</p>
        ) : null}
        <details className="manage-regulation-details">
          <summary>詳細を編集</summary>
          <div className="tournament-form-grid">
            <label>
              名称
              <input value={form.regulation.name} onChange={(event) => setRegulationField("name", event.target.value)} />
            </label>
            <label>
              メイン下限（枚）
              <input type="number" value={form.regulation.mainMin} onChange={(event) => setRegulationField("mainMin", event.target.value)} />
            </label>
            <label>
              メイン上限（枚）
              <input type="number" value={form.regulation.mainMax} onChange={(event) => setRegulationField("mainMax", event.target.value)} />
            </label>
            <label>
              サイド枚数（枚）
              <input type="number" value={form.regulation.sideSize} onChange={(event) => setRegulationField("sideSize", event.target.value)} />
            </label>
            <label>
              同名カードの上限（枚）
              <input type="number" value={form.regulation.maxCopies} onChange={(event) => setRegulationField("maxCopies", event.target.value)} />
            </label>
            <RegulationSetInput
              value={form.regulation.allowedSetInput}
              onChange={setRegulationSetInput}
            />
            <RegulationCardInput
              idPrefix="banned-cards"
              label="禁止カード"
              value={form.regulation.bannedCardInput}
              onChange={(updater) => setRegulationCardInput("bannedCardInput", updater)}
            />
            <RegulationCardInput
              idPrefix="limited-cards"
              label="制限カード"
              value={form.regulation.limitedCardInput}
              onChange={(updater) => setRegulationCardInput("limitedCardInput", updater)}
            />
          </div>
        </details>
      </section>
      {cardInputErrors.length ? (
        <div id="regulation-card-save-errors" className="tournament-validation-alert" role="alert">
          <strong>未解決の禁止・制限カードがあるため保存できません。</strong>
          <ul>
            {cardInputErrors.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="tournament-entry-actions tournament-manage-actions">
        <button
          type="submit"
          disabled={isSubmitting || cardInputErrors.length > 0}
          aria-describedby={cardInputErrors.length ? "regulation-card-save-errors" : undefined}
        >
          {isNew ? "作成" : "保存"}
        </button>
      </div>
    </form>
  );
}

function StandingsPanel({
  entries,
  formatParticipantName,
  rounds,
  selectedRoundNumber,
  setSelectedRoundNumber,
  standings,
}) {
  const swissRounds = useMemo(
    () => (rounds || []).filter((round) => round.stage !== "top_cut"),
    [rounds]
  );
  const topCutRounds = useMemo(
    () => (rounds || []).filter((round) => round.stage === "top_cut"),
    [rounds]
  );
  const selectedSwissRound = swissRounds.find(
    (round) => Number(round.number) === Number(selectedRoundNumber)
  );
  const swissStandings = useMemo(() => {
    if (!swissRounds.length) return topCutRounds.length ? [] : standings;
    const matches = swissRounds
      .filter(
        (round) =>
          !selectedSwissRound || Number(round.number) <= Number(selectedSwissRound.number)
      )
      .flatMap((round) => round.matches || []);
    return computeStandings(entries, matches);
  }, [entries, selectedSwissRound, standings, swissRounds, topCutRounds.length]);
  const showSwissStandings = swissRounds.length > 0 || topCutRounds.length === 0;

  return (
    <section className="tournament-tab-panel">
      <h2>{topCutRounds.length ? "大会結果" : "順位表"}</h2>
      {topCutRounds.length ? (
        <div className="tournament-rounds">
          <h3>トップカット</h3>
          <Bracket rounds={rounds} entries={entries} showResults />
        </div>
      ) : null}
      {showSwissStandings ? (
        <div className="tournament-rounds">
          {topCutRounds.length ? <h3>スイス順位表</h3> : null}
          <RoundTabs
            rounds={swissRounds}
            selectedRoundNumber={selectedRoundNumber}
            onChange={setSelectedRoundNumber}
          />
          {swissStandings.length > 0 ? (
            <div className="tournament-table-wrap tournament-card-table-wrap">
              <table className="tournament-table tournament-card-table tournament-standings-table">
              <thead>
                <tr>
                  <th className="num">順位</th>
                  <th>プレイヤー</th>
                  <th className="num">勝</th>
                  <th className="num">敗</th>
                  <th className="num">分</th>
                  <th className="num">勝点</th>
                  <th className="num" title="対戦相手の平均勝率。同じ勝敗数の中で順位を決めるために使う">
                    OMW%（対戦相手勝率）
                  </th>
                </tr>
              </thead>
              <tbody>
                {swissStandings.map((standing) => {
                  const entry = standing.entry || findEntry(entries, standing.entryId);
                  return (
                    <tr key={standing.entryId}>
                      <td className="num" data-label="順位">{standing.rank}</td>
                      <td className="tournament-card-title-cell" data-label="プレイヤー">
                        {formatParticipantName(entry, standing.entryId)}
                      </td>
                      <td className="num" data-label="勝">{standing.wins}</td>
                      <td className="num" data-label="敗">{standing.losses}</td>
                      <td className="num" data-label="分">{standing.draws}</td>
                      <td className="num" data-label="勝点">{standing.points}</td>
                      <td className="num" data-label="OMW%（対戦相手勝率）">
                        {Math.round(Number(standing.omwPercent || 0) * 1000) / 10}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          ) : (
            <div className="tournament-empty">スイス順位データはまだありません。</div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function TournamentManage({ compact = false }) {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { authMode, isAuthenticated, isReady, user } = useAuth();
  const requestContextKey = [
    id || "new",
    authMode || "",
    user?.id || "",
    user?.role || "",
    isReady === false ? "pending" : "ready",
  ].join("::");
  const currentRequestContextRef = useRef(requestContextKey);
  currentRequestContextRef.current = requestContextKey;
  const isCurrentRequestContext = useCallback(
    (contextKey) => currentRequestContextRef.current === contextKey,
    []
  );
  const [form, setForm] = useState(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState("rounds");
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(null);
  const [selectedStandingRoundNumber, setSelectedStandingRoundNumber] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [tournamentContextKey, setTournamentContextKey] = useState("");
  const [regulationViolations, setRegulationViolations] = useState([]);
  const [roundRollbackConfirmation, setRoundRollbackConfirmation] = useState(null);
  const requestIdRef = useRef({ tournament: 0, entries: 0, bans: 0, rounds: 0, standings: 0 });
  const {
    status: tournamentStatus,
    data: tournament,
    error: tournamentError,
    start: startTournament,
    succeed: succeedTournament,
    fail: failTournament,
  } = useAsyncResource(null);
  const {
    status: tournamentRefreshStatus,
    error: tournamentRefreshError,
    start: startTournamentRefresh,
    fail: failTournamentRefresh,
    reset: resetTournamentRefresh,
  } = useAsyncResource(null);
  const {
    status: entriesStatus,
    data: entries,
    error: entriesError,
    start: startEntries,
    succeed: succeedEntries,
    fail: failEntries,
  } = useAsyncResource([]);
  const {
    status: bansStatus,
    data: bans,
    error: bansError,
    start: startBans,
    succeed: succeedBans,
    fail: failBans,
  } = useAsyncResource([]);
  const {
    status: roundsStatus,
    data: rounds,
    error: roundsError,
    start: startRounds,
    succeed: succeedRounds,
    fail: failRounds,
  } = useAsyncResource([]);
  const {
    status: standingsStatus,
    data: standings,
    error: standingsError,
    start: startStandings,
    succeed: succeedStandings,
    fail: failStandings,
  } = useAsyncResource([]);
  const formatParticipantName = useMemo(
    () => createTournamentParticipantNameFormatter(entries),
    [entries]
  );
  const permissions = useMemo(
    () => getTournamentPermissions(isNew ? null : tournament, user),
    [isNew, tournament, user]
  );

  const latestRoundNumber = rounds.length ? rounds[rounds.length - 1].number : null;
  const detailUrl = isNew ? "" : `${window.location.origin}/tournaments/${id}`;
  const displayUrl = isNew ? "" : `/tournaments/${id}/display`;

  const loadTournament = useCallback(async ({ background = false } = {}) => {
    const contextKey = requestContextKey;
    if (isNew || !isCurrentRequestContext(contextKey)) return null;
    const requestId = requestIdRef.current.tournament + 1;
    requestIdRef.current.tournament = requestId;
    setTournamentContextKey(contextKey);
    if (!background) {
      startTournament();
      resetTournamentRefresh();
    }
    setIsAccessDenied(false);
    try {
      const nextTournament = await fetchTournament(id, { authMode, user });
      if (
        requestIdRef.current.tournament !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      succeedTournament(nextTournament);
      resetTournamentRefresh();
      setForm((current) => formFromTournament(nextTournament, current.regulation));
      return nextTournament;
    } catch (loadError) {
      if (
        requestIdRef.current.tournament !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const accessDenied = loadError?.status === 401 || loadError?.status === 403;
      if (accessDenied) {
        setIsAccessDenied(true);
        failTournament("大会情報を読み込めませんでした。");
      } else if (background) {
        failTournamentRefresh(
          "操作は完了しましたが、最新の大会情報を再読み込みできませんでした。"
        );
      } else {
        failTournament("大会情報を読み込めませんでした。");
      }
      return null;
    }
  }, [
    authMode,
    failTournament,
    failTournamentRefresh,
    id,
    isCurrentRequestContext,
    isNew,
    requestContextKey,
    resetTournamentRefresh,
    startTournament,
    succeedTournament,
    user,
  ]);

  const retryTournamentRefresh = useCallback(() => {
    startTournamentRefresh();
    return loadTournament({ background: true });
  }, [loadTournament, startTournamentRefresh]);

  const loadEntries = useCallback(async ({ background = false } = {}) => {
    const contextKey = requestContextKey;
    if (isNew || !isCurrentRequestContext(contextKey)) return [];
    const requestId = requestIdRef.current.entries + 1;
    requestIdRef.current.entries = requestId;
    if (!background) startEntries();
    try {
      const payload = await fetchEntries(id, { authMode, user });
      if (
        requestIdRef.current.entries !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const nextEntries = payload.items || [];
      succeedEntries(nextEntries);
      return nextEntries;
    } catch (_loadError) {
      if (
        requestIdRef.current.entries !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      failEntries("参加者情報を読み込めませんでした。");
      return null;
    }
  }, [
    authMode,
    failEntries,
    id,
    isCurrentRequestContext,
    isNew,
    requestContextKey,
    startEntries,
    succeedEntries,
    user,
  ]);

  const loadBans = useCallback(async ({ background = false } = {}) => {
    const contextKey = requestContextKey;
    if (isNew || !isCurrentRequestContext(contextKey)) return [];
    const requestId = requestIdRef.current.bans + 1;
    requestIdRef.current.bans = requestId;
    if (!background) startBans();
    try {
      const payload = await fetchTournamentBans(id, { authMode, user });
      if (
        requestIdRef.current.bans !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const nextBans = payload.items || [];
      succeedBans(nextBans);
      return nextBans;
    } catch (_loadError) {
      if (
        requestIdRef.current.bans !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      failBans("再エントリー禁止情報を読み込めませんでした。");
      return null;
    }
  }, [
    authMode,
    failBans,
    id,
    isCurrentRequestContext,
    isNew,
    requestContextKey,
    startBans,
    succeedBans,
    user,
  ]);

  const loadRounds = useCallback(async ({ background = false } = {}) => {
    const contextKey = requestContextKey;
    if (isNew || !isCurrentRequestContext(contextKey)) return [];
    const requestId = requestIdRef.current.rounds + 1;
    requestIdRef.current.rounds = requestId;
    if (!background) startRounds();
    try {
      const payload = await fetchRoundsForManage(id, { authMode, user });
      if (
        requestIdRef.current.rounds !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const nextRounds = payload.rounds || [];
      succeedRounds(nextRounds);
      if (nextRounds.length) {
        setSelectedRoundNumber((current) =>
          nextRounds.some((round) => Number(round.number) === Number(current))
            ? current
            : nextRounds[nextRounds.length - 1].number
        );
      } else {
        setSelectedRoundNumber(null);
      }
      const nextSwissRounds = nextRounds.filter((round) => round.stage !== "top_cut");
      setSelectedStandingRoundNumber((current) =>
        nextSwissRounds.some((round) => Number(round.number) === Number(current))
          ? current
          : nextSwissRounds[nextSwissRounds.length - 1]?.number ?? null
      );
      return nextRounds;
    } catch (_loadError) {
      if (
        requestIdRef.current.rounds !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      failRounds("ラウンド情報を読み込めませんでした。");
      return null;
    }
  }, [
    authMode,
    failRounds,
    id,
    isCurrentRequestContext,
    isNew,
    requestContextKey,
    startRounds,
    succeedRounds,
    user,
  ]);

  const loadStandings = useCallback(async ({ background = false } = {}) => {
    const contextKey = requestContextKey;
    if (isNew || !isCurrentRequestContext(contextKey)) return [];
    const requestId = requestIdRef.current.standings + 1;
    requestIdRef.current.standings = requestId;
    if (!background) startStandings();
    try {
      const payload = await fetchStandings(id, { authMode });
      if (
        requestIdRef.current.standings !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const nextStandings = payload.items || [];
      succeedStandings(nextStandings);
      return nextStandings;
    } catch (_loadError) {
      if (
        requestIdRef.current.standings !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      failStandings("順位表を読み込めませんでした。");
      return null;
    }
  }, [
    authMode,
    failStandings,
    id,
    isCurrentRequestContext,
    isNew,
    requestContextKey,
    startStandings,
    succeedStandings,
  ]);

  const loadAll = useCallback(async ({ background = false } = {}) => {
    if (
      isNew ||
      isReady === false ||
      !isCurrentRequestContext(requestContextKey)
    ) return;
    return Promise.all([
      loadTournament({ background }),
      loadEntries({ background }),
      loadBans({ background }),
      loadRounds({ background }),
      loadStandings({ background }),
    ]);
  }, [
    isCurrentRequestContext,
    isNew,
    isReady,
    loadBans,
    loadEntries,
    loadRounds,
    loadStandings,
    loadTournament,
    requestContextKey,
  ]);

  useEffect(() => {
    setForm(DEFAULT_FORM);
    setActiveTab("rounds");
    setSelectedRoundNumber(null);
    setSelectedStandingRoundNumber(null);
    setIsSubmitting(false);
    setMessage("");
    setError("");
    setIsAccessDenied(false);
    setTournamentContextKey(isNew ? requestContextKey : "");
    setRegulationViolations([]);
    setRoundRollbackConfirmation(null);
    resetTournamentRefresh();
  }, [isNew, requestContextKey, resetTournamentRefresh]);

  useEffect(() => {
    const requestIds = requestIdRef.current;
    if (isReady !== false) loadAll();
    return () => {
      requestIds.tournament += 1;
      requestIds.entries += 1;
      requestIds.bans += 1;
      requestIds.rounds += 1;
      requestIds.standings += 1;
    };
  }, [isReady, loadAll]);

  useEffect(() => {
    if (latestRoundNumber != null && selectedRoundNumber == null) {
      setSelectedRoundNumber(latestRoundNumber);
    }
  }, [latestRoundNumber, selectedRoundNumber]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setOnline = (checked) => {
    setForm((current) => ({
      ...current,
      isOnline: checked,
      selfCheckin: checked ? true : current.selfCheckin,
    }));
  };

  const setRegulationField = (field, value) => {
    setForm((current) => ({
      ...current,
      regulation: { ...current.regulation, [field]: value },
    }));
  };

  const setRegulationCardInput = useCallback((field, updater) => {
    const referenceField = field === "bannedCardInput" ? "bannedCards" : "limitedCards";
    setForm((current) => {
      const currentInput = current.regulation?.[field] || createRegulationCardState([]);
      const nextInput = typeof updater === "function" ? updater(currentInput) : updater;
      return {
        ...current,
        regulation: {
          ...current.regulation,
          [field]: nextInput,
          [referenceField]: getRegulationCardReferences(nextInput),
        },
      };
    });
  }, []);

  const setRegulationSetInput = useCallback((updater) => {
    setForm((current) => {
      const currentInput =
        current.regulation?.allowedSetInput ||
        createRegulationSetState(current.regulation?.allowedSets);
      const nextInput = typeof updater === "function" ? updater(currentInput) : updater;
      return {
        ...current,
        regulation: {
          ...current.regulation,
          allowedSetInput: nextInput,
          allowedSets: getRegulationAllowedSets(nextInput),
        },
      };
    });
  }, []);

  const runAction = async (action, successMessage = "") => {
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return null;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await action(actionContextKey);
      if (!isCurrentRequestContext(actionContextKey)) return result;
      const resolvedSuccessMessage =
        typeof successMessage === "function" ? successMessage(result) : successMessage;
      const refreshResults = await loadAll({ background: true });
      if (
        isCurrentRequestContext(actionContextKey) &&
        refreshResults?.[0] != null &&
        resolvedSuccessMessage
      ) {
        setMessage(resolvedSuccessMessage);
      }
      return result;
    } catch (actionError) {
      if (isCurrentRequestContext(actionContextKey)) {
        setError(localizedActionError(actionError));
      }
      return null;
    } finally {
      if (isCurrentRequestContext(actionContextKey)) setIsSubmitting(false);
    }
  };

  const saveTournament = async (event) => {
    event.preventDefault();
    const cardInputErrors = regulationCardInputErrors(form.regulation);
    if (cardInputErrors.length) {
      setMessage("");
      setError(`大会を保存できません。${cardInputErrors.join(" / ")}`);
      return;
    }
    if (!event.currentTarget.checkValidity()) return;
    await runAction(async (actionContextKey) => {
      const payload = payloadFromForm(form);
      if (isNew) {
        const created = await createTournament({ ...payload, authMode, user });
        if (!isCurrentRequestContext(actionContextKey)) return;
        setMessage("大会を作成しました。");
        navigate(`/tournaments/${created.id}/manage`, { replace: true });
        return;
      }
      const updated = await updateTournament({ id, ...payload, authMode, user });
      if (!isCurrentRequestContext(actionContextKey)) return;
      setForm((current) => formFromTournament(updated, current.regulation));
      setRegulationViolations(
        (updated.violations || []).map((item) => ({
          ...item,
          entryName: formatParticipantName(findEntry(entries, item.entryId), item.entryId),
        }))
      );
      setMessage("大会情報を保存しました。");
    });
  };

  const changeStatus = (status) =>
    runAction(async (actionContextKey) => {
      const updated = await updateTournament({ id, status, authMode, user });
      if (!isCurrentRequestContext(actionContextKey)) return updated;
      succeedTournament(updated);
      setForm((current) => formFromTournament(updated, current.regulation));
      return updated;
    }, "ステータスを更新しました。");

  const cancelTournament = () => {
    if (!window.confirm("大会を中止します。よろしいですか？")) return;
    changeStatus("cancelled");
  };

  const removeDraft = () => {
    if (!window.confirm("下書きを削除します。よろしいですか？")) return;
    runAction(async (actionContextKey) => {
      await deleteTournament(id, { authMode, user });
      if (!isCurrentRequestContext(actionContextKey)) return;
      navigate("/tournaments", { replace: true });
    }, "下書きを削除しました。");
  };

  const copyUrl = async () => {
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return;
    setError("");
    try {
      await navigator.clipboard.writeText(detailUrl);
      if (isCurrentRequestContext(actionContextKey)) {
        setMessage("大会URLをコピーしました。");
      }
    } catch (copyError) {
      if (isCurrentRequestContext(actionContextKey)) {
        setError("URLをコピーできませんでした。");
      }
    }
  };

  const generateRound = () =>
    runAction(
      async () => createNextRound(id, { authMode, user }),
      "次ラウンドを生成しました。"
    );

  const reportScore = (matchId, player1Games, player2Games) => {
    const round = rounds.find((item) =>
      (item.matches || []).some((match) => match.id === matchId)
    );
    return runAction(
      async () =>
        reportMatchResult({
          matchId,
          player1Games,
          player2Games,
          stage: round?.stage,
          authMode,
          user,
        }),
      "結果を保存しました。"
    );
  };

  const finishRound = (roundId) =>
    runAction(
      async () => completeRound(roundId, { authMode, user }),
      "ラウンドを完了しました。"
    );

  const reopenCompletedRound = async (
    roundId,
    { discardLaterRounds = false, tournamentCompletionConfirmed = false } = {}
  ) => {
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return;
    const targetRound = rounds.find((round) => round.id === roundId);
    const latestCompletedRound = rounds
      .filter((round) => round.status === "completed")
      .reduce(
        (latest, round) =>
          !latest || Number(round.number) > Number(latest.number) ? round : latest,
        null
      );

    if (
      form.status === "completed" &&
      targetRound?.id === latestCompletedRound?.id &&
      !tournamentCompletionConfirmed
    ) {
      const laterRounds = rounds.filter(
        (round) => Number(round.number) > Number(targetRound.number)
      );
      setError("");
      setMessage("");
      setRoundRollbackConfirmation({
        contextKey: actionContextKey,
        roundId,
        targetRoundNumber: targetRound.number,
        targetRoundLabel: getRoundLabel(targetRound, rounds),
        firstDiscardedRoundNumber: laterRounds.length
          ? Math.min(...laterRounds.map((round) => Number(round.number)))
          : null,
        firstDiscardedRoundLabel: laterRounds.length
          ? getRoundLabel(
              laterRounds.reduce((first, round) =>
                Number(round.number) < Number(first.number) ? round : first
              ),
              rounds
            )
          : "",
        releasesTournamentCompletion: true,
      });
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const reopened = await reopenRound(roundId, { authMode, discardLaterRounds, user });
      if (!isCurrentRequestContext(actionContextKey)) return;
      setRoundRollbackConfirmation(null);
      setMessage(
        `${getRoundLabel(reopened, rounds)}を完了前に戻しました。結果を修正してください。`
      );
      await loadAll({ background: true });
    } catch (actionError) {
      if (!isCurrentRequestContext(actionContextKey)) return;
      if (!discardLaterRounds && actionError.code === "later_rounds_exist") {
        const firstDiscardedRoundNumber =
          actionError.firstDiscardedRoundNumber || Number(targetRound?.number || 0) + 1;
        const firstDiscardedRound = rounds.find(
          (round) => Number(round.number) === Number(firstDiscardedRoundNumber)
        );
        setRoundRollbackConfirmation({
          contextKey: actionContextKey,
          roundId,
          targetRoundNumber: targetRound?.number,
          targetRoundLabel: targetRound ? getRoundLabel(targetRound, rounds) : "対象ラウンド",
          firstDiscardedRoundNumber,
          firstDiscardedRoundLabel: firstDiscardedRound
            ? getRoundLabel(firstDiscardedRound, rounds)
            : getRoundLabelForNumber(firstDiscardedRoundNumber, rounds, form),
          releasesTournamentCompletion: form.status === "completed",
        });
      } else {
        setError(localizedActionError(actionError, "ラウンドを完了前に戻せませんでした。"));
      }
    } finally {
      if (isCurrentRequestContext(actionContextKey)) setIsSubmitting(false);
    }
  };

  const confirmRoundRollback = () => {
    if (
      !roundRollbackConfirmation ||
      !isCurrentRequestContext(roundRollbackConfirmation.contextKey)
    ) return;
    reopenCompletedRound(roundRollbackConfirmation.roundId, {
      discardLaterRounds: roundRollbackConfirmation.firstDiscardedRoundNumber != null,
      tournamentCompletionConfirmed: roundRollbackConfirmation.releasesTournamentCompletion,
    });
  };

  const savePairings = (roundId, matches) =>
    runAction(
      async () =>
        updateRoundMatches({
          roundId,
          matches: matches.map((match) => ({
            ...match,
            tableNo: Number(match.tableNo),
            player2EntryId: match.player2EntryId || null,
          })),
          authMode,
          user,
        }),
      "ペアリングを保存しました。"
    );

  const repairRound = (roundId) => {
    if (!window.confirm("このラウンドを破棄して組み直します。よろしいですか？")) return;
    runAction(async () => {
      await deleteRound(roundId, { authMode, user });
      await createNextRound(id, { authMode, user });
    }, "ラウンドを組み直しました。");
  };

  const saveAnnouncement = (announcement) =>
    runAction(
      async () => updateTournament({ id, announcement: announcement.trim() || null, authMode, user }),
      announcement.trim() ? "アナウンスを掲示しました。" : "アナウンスを取り下げました。"
    );

  const approvePendingEntry = (entryId) =>
    runAction(
      async () => approveEntry({ tournamentId: id, entryId, authMode, user }),
      "申請を許可しました。"
    );

  const rejectPendingEntry = (entryId) =>
    runAction(
      async () => rejectEntry({ tournamentId: id, entryId, authMode, user }),
      "申請を却下しました。"
    );

  const createManual = (name, deckText) =>
    runAction(
      async () =>
        createManualEntry({
          tournamentId: id,
          name,
          deckItems: parseDeckText(deckText),
          authMode,
          user,
        }),
      "参加者を追加しました。"
    );

  const changeEntryStatus = (entryId, status) =>
    runAction(
      async () => updateEntryStatus({ tournamentId: id, entryId, status, authMode, user }),
      "参加者の状態を更新しました。"
    );

  const promoteWaitlist = () =>
    runAction(
      async () => promoteWaitlistedEntries({ tournamentId: id, authMode, user }),
      (result) => {
        if (result.promotedCount > 0) {
          return `キャンセル待ちから${result.promotedCount}人を繰り上げました。`;
        }
        if (result.remainingSlots === 0) {
          return "チェックイン済みの参加者が定員に達しているため、繰り上げませんでした。";
        }
        return "チェックイン済みのキャンセル待ちがいないため、繰り上げませんでした。";
      }
    );

  const kickParticipant = (entryId, ban) =>
    runAction(
      async () => kickEntry({ tournamentId: id, entryId, ban, authMode, user }),
      ban
        ? "参加者をキックし、再エントリーを禁止しました。"
        : "参加者をキックしました。"
    );

  const unbanParticipant = (userId) =>
    runAction(
      async () => unbanTournamentUser({ tournamentId: id, userId, authMode, user }),
      "再エントリー禁止を解除しました。"
    );

  const changeDecklistLock = (entryId, decklistLocked) =>
    runAction(
      async () =>
        updateEntryStatus({
          tournamentId: id,
          entryId,
          decklistLocked,
          authMode,
          user,
        }),
      decklistLocked
        ? "デッキリストを再ロックしました。"
        : "デッキリストのロックを解除しました。本人が再提出できます。"
    );

  const deckRegister = (entryId) => {
    const name = window.prompt("カード名を1行ずつ入力してください。空で未提出に戻します。", "");
    if (name == null) return;
    runAction(
      async () =>
        updateEntryStatus({
          tournamentId: id,
          entryId,
          deckItems: parseDeckText(name),
          authMode,
          user,
        }),
      "デッキを登録しました。"
    );
  };

  const startTimer = (roundId) =>
    runAction(
      async () => startRoundTimer(roundId, { authMode, user }),
      "タイマーを開始しました。"
    );

  const addCoOrganizer = (userId) =>
    runAction(async (actionContextKey) => {
      const updated = await addTournamentCoOrganizer({
        tournamentId: id,
        userId,
        authMode,
        user,
      });
      if (!isCurrentRequestContext(actionContextKey)) return;
      succeedTournament(updated);
    }, "共同運営者を追加しました。");

  const removeCoOrganizer = (userId) =>
    runAction(async (actionContextKey) => {
      const updated = await removeTournamentCoOrganizer({
        tournamentId: id,
        userId,
        authMode,
        user,
      });
      if (!isCurrentRequestContext(actionContextKey)) return;
      succeedTournament(updated);
    }, "共同運営者を削除しました。");

  const canAccess = isNew ? permissions.canCreate : permissions.canManage;
  const tournamentContextMatches = tournamentContextKey === requestContextKey;
  const displayedTournamentStatus =
    isReady === false || !tournamentContextMatches
      ? ASYNC_STATUS.LOADING
      : tournamentStatus;
  const displayedAccessDenied = tournamentContextMatches && isAccessDenied;

  if (isReady === false) {
    return (
      <main className={compact ? "tournament-page compact" : "tournament-page"}>
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <TournamentAsyncState
          status={ASYNC_STATUS.LOADING}
          loadingMessage="認証情報を確認中..."
        />
      </main>
    );
  }

  if (!tournamentContextMatches) {
    return (
      <main className={compact ? "tournament-page compact" : "tournament-page"}>
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <TournamentAsyncState
          status={ASYNC_STATUS.LOADING}
          loadingMessage={isNew ? "大会作成画面を準備中..." : "大会情報を読み込み中..."}
        />
      </main>
    );
  }

  if (
    !isNew &&
    displayedTournamentStatus !== ASYNC_STATUS.SUCCESS &&
    !displayedAccessDenied
  ) {
    return (
      <main className={compact ? "tournament-page compact" : "tournament-page"}>
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <TournamentAsyncState
          status={displayedTournamentStatus}
          error={tournamentError}
          idleMessage="大会情報はまだ読み込まれていません。"
          loadingMessage="大会情報を読み込み中..."
          emptyMessage="管理する大会が見つかりません。"
          errorMessage="大会情報を読み込めませんでした。"
          onRetry={loadTournament}
        />
      </main>
    );
  }

  if (!canAccess || displayedAccessDenied) {
    return (
      <main className={compact ? "tournament-page compact" : "tournament-page"}>
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <div className="tournament-alert">
          {/* 未ログインは「権限がない」のではなくログインすれば解決するので、文面と導線を分ける。 */}
          {!isAuthenticated ? (
            <>
              <p>
                {isNew
                  ? "大会を作成するにはログインが必要です。"
                  : "この大会の管理画面を開くにはログインが必要です。"}
              </p>
              <Link to="/profile">ログイン画面へ</Link>
            </>
          ) : !isNew || displayedAccessDenied ? (
            "この大会を管理する権限がありません。"
          ) : (
            "主催者または管理者のみ利用できます。"
          )}
        </div>
      </main>
    );
  }

  const entriesReady = [ASYNC_STATUS.EMPTY, ASYNC_STATUS.SUCCESS].includes(entriesStatus);
  const roundsReady = [ASYNC_STATUS.EMPTY, ASYNC_STATUS.SUCCESS].includes(roundsStatus);
  const tournamentRefreshPending = [ASYNC_STATUS.LOADING, ASYNC_STATUS.ERROR].includes(
    tournamentRefreshStatus
  );
  const lifecycleDataReady = entriesReady && roundsReady && !tournamentRefreshPending;
  const lifecycleDataHasError =
    entriesStatus === ASYNC_STATUS.ERROR ||
    roundsStatus === ASYNC_STATUS.ERROR ||
    tournamentRefreshStatus === ASYNC_STATUS.ERROR;
  const lifecycleDataMessage = lifecycleDataReady
    ? ""
    : tournamentRefreshStatus === ASYNC_STATUS.LOADING
      ? "最新の大会情報を再読み込み中のため、大会状態の変更・中止・削除はできません。"
      : tournamentRefreshStatus === ASYNC_STATUS.ERROR
      ? "最新の大会情報を確認できないため、大会状態の変更・中止・削除はできません。大会情報を再試行してください。"
      : lifecycleDataHasError
      ? "参加者またはラウンド情報を確認できないため、大会状態の変更・中止・削除はできません。表示中のエラーから再試行してください。"
      : "参加者とラウンド情報を読み込み中のため、大会状態の変更・中止・削除はできません。";
  const lifecycleActionDescriptionId = lifecycleDataReady
    ? undefined
    : "tournament-lifecycle-data-status";
  const hasRounds = !isNew && roundsStatus !== ASYNC_STATUS.EMPTY;
  const roundSettingsLockMessage = !hasRounds
    ? ""
    : roundsReady
      ? "ラウンド生成後は変更できません"
      : "ラウンド情報を確認できないため変更できません";

  return (
    <main className={compact ? "tournament-page compact" : "tournament-page"}>
      <Link to="/tournaments" className="tournament-back-link">
        大会一覧へ
      </Link>
      <div className="tournament-page-header manage-header">
        <div>
          <p className="tournament-eyebrow">大会管理</p>
          <h1>{isNew ? "大会を作成" : form.title || "大会管理"}</h1>
        </div>
        {!isNew ? (
          <div className="tournament-header-actions">
            <span className={`tournament-status ${form.status}`}>{STATUS_LABELS[form.status] || form.status}</span>
            <button type="button" onClick={copyUrl}>
              URLコピー
            </button>
            <a className="tournament-create-link" href={displayUrl} target="_blank" rel="noreferrer">
              掲示用に開く
            </a>
          </div>
        ) : null}
      </div>

      {message ? <div className="tournament-success">{message}</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}
      {[ASYNC_STATUS.LOADING, ASYNC_STATUS.ERROR].includes(tournamentRefreshStatus) ? (
        <TournamentAsyncState
          status={tournamentRefreshStatus}
          error={tournamentRefreshError}
          loadingMessage="大会情報を再読み込み中..."
          errorMessage="操作は完了しましたが、最新の大会情報を再読み込みできませんでした。"
          onRetry={retryTournamentRefresh}
        />
      ) : null}

      {!isNew ? (
        <>
          {entriesReady && roundsReady ? (
            <div className="next-action-band">
              <strong>次にやること:</strong>{" "}
              {nextActionText(
                form,
                rounds,
                pairingEntriesForRound(entries, rounds.length + 1).length
              )}
            </div>
          ) : (
            <div className="next-action-band">
              <strong>次にやること:</strong> 参加者とラウンド情報の読み込み後に表示します。
            </div>
          )}
          {!lifecycleDataReady ? (
            <p
              id="tournament-lifecycle-data-status"
              className={lifecycleDataHasError ? "tournament-alert" : "tournament-muted"}
              role="status"
            >
              {lifecycleDataMessage}
            </p>
          ) : null}
          <div className="status-action-row">
            <button
              type="button"
              disabled={isSubmitting || !lifecycleDataReady || form.status !== "draft"}
              aria-describedby={lifecycleActionDescriptionId}
              title={!lifecycleDataReady ? lifecycleDataMessage : undefined}
              onClick={() => changeStatus("registration")}
            >
              受付開始
            </button>
            <button
              type="button"
              disabled={isSubmitting || !lifecycleDataReady || form.status !== "registration"}
              aria-describedby={lifecycleActionDescriptionId}
              title={!lifecycleDataReady ? lifecycleDataMessage : undefined}
              onClick={() => changeStatus("in_progress")}
            >
              進行開始
            </button>
            <button
              type="button"
              disabled={isSubmitting || !lifecycleDataReady || form.status !== "in_progress"}
              aria-describedby={lifecycleActionDescriptionId}
              title={!lifecycleDataReady ? lifecycleDataMessage : undefined}
              onClick={() => changeStatus("completed")}
            >
              完了
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={
                isSubmitting ||
                !lifecycleDataReady ||
                form.status === "completed" ||
                form.status === "cancelled"
              }
              aria-describedby={lifecycleActionDescriptionId}
              title={!lifecycleDataReady ? lifecycleDataMessage : undefined}
              onClick={cancelTournament}
            >
              中止
            </button>
            {form.status === "draft" && permissions.canDelete ? (
              <button
                type="button"
                className="danger-button"
                disabled={isSubmitting || !lifecycleDataReady}
                aria-describedby={lifecycleActionDescriptionId}
                title={!lifecycleDataReady ? lifecycleDataMessage : undefined}
                onClick={removeDraft}
              >
                下書きを削除
              </button>
            ) : null}
          </div>
          <nav className="tournament-tabs manage-tabs" aria-label="管理タブ">
            {TABS.map(([value, label]) => (
              <button key={value} type="button" className={activeTab === value ? "active" : ""} onClick={() => setActiveTab(value)}>
                {label}
              </button>
            ))}
          </nav>
        </>
      ) : null}

      {(isNew || activeTab === "info") && (
        <>
          {!isNew && !roundsReady ? (
            <TournamentAsyncState
              status={roundsStatus}
              error={roundsError}
              idleMessage="ラウンド情報はまだ読み込まれていません。"
              loadingMessage="ラウンド情報を読み込み中です。形式と回戦設定は確認後に変更できます。"
              errorMessage="ラウンド情報を読み込めませんでした。形式と回戦設定は変更できません。"
              onRetry={loadRounds}
            />
          ) : null}
          <InfoPanel
            entries={entries}
            form={form}
            formatParticipantName={formatParticipantName}
            hasRounds={hasRounds}
            roundSettingsLockMessage={roundSettingsLockMessage}
            isNew={isNew}
            isSubmitting={isSubmitting}
            onSave={saveTournament}
            regulationViolations={regulationViolations}
            setField={setField}
            setOnline={setOnline}
            setRegulationCardInput={setRegulationCardInput}
            setRegulationField={setRegulationField}
            setRegulationSetInput={setRegulationSetInput}
          />
          {!isNew && tournament ? (
            <CoOrganizersPanel
              authMode={authMode}
              canManageCoOrganizers={permissions.canManageCoOrganizers}
              isSubmitting={isSubmitting}
              onAdd={addCoOrganizer}
              onRemove={removeCoOrganizer}
              tournament={tournament}
            />
          ) : null}
        </>
      )}

      {!isNew && activeTab === "rounds" ? (
        <TournamentAsyncState
          status={readyOrEmptyStatus(roundsStatus)}
          error={roundsError}
          idleMessage="ラウンド情報はまだ読み込まれていません。"
          loadingMessage="ラウンド情報を読み込み中..."
          errorMessage="ラウンド情報を読み込めませんでした。"
          onRetry={loadRounds}
        >
          <TournamentAsyncState
            status={readyOrEmptyStatus(entriesStatus)}
            error={entriesError}
            idleMessage="参加者情報はまだ読み込まれていません。"
            loadingMessage="参加者情報を読み込み中..."
            errorMessage="ラウンド運営に必要な参加者情報を読み込めませんでした。"
            onRetry={loadEntries}
          >
            <RoundManagePanel
              entries={entries}
              formatParticipantName={formatParticipantName}
              form={form}
              isSubmitting={isSubmitting}
              onFinishRound={finishRound}
              onGenerateRound={generateRound}
              onReportScore={reportScore}
              onReopenRound={reopenCompletedRound}
              onRepairRound={repairRound}
              onSaveAnnouncement={saveAnnouncement}
              onSavePairings={savePairings}
              onStartTimer={startTimer}
              rounds={rounds}
              selectedRoundNumber={selectedRoundNumber}
              setSelectedRoundNumber={setSelectedRoundNumber}
            />
          </TournamentAsyncState>
        </TournamentAsyncState>
      ) : null}

      {!isNew && activeTab === "participants" ? (
        <TournamentAsyncState
          status={readyOrEmptyStatus(entriesStatus)}
          error={entriesError}
          idleMessage="参加者情報はまだ読み込まれていません。"
          loadingMessage="参加者情報を読み込み中..."
          errorMessage="参加者情報を読み込めませんでした。"
          onRetry={loadEntries}
        >
          <ParticipantsPanel
            bans={bans}
            bansStatus={bansStatus}
            bansError={bansError}
            compact={compact}
            entries={entries}
            formatParticipantName={formatParticipantName}
            form={form}
            isSubmitting={isSubmitting}
            onApprove={approvePendingEntry}
            onCreateManual={createManual}
            onDeckLockChange={changeDecklistLock}
            onDeckRegister={deckRegister}
            onKick={kickParticipant}
            onPromoteWaitlist={promoteWaitlist}
            onReject={rejectPendingEntry}
            onRetryBans={loadBans}
            onStatusChange={changeEntryStatus}
            onUnban={unbanParticipant}
            rounds={rounds}
            roundsStatus={roundsStatus}
            roundsError={roundsError}
            onRetryRounds={loadRounds}
          />
        </TournamentAsyncState>
      ) : null}

      {!isNew && activeTab === "standings" ? (
        <TournamentAsyncState
          status={readyOrEmptyStatus(roundsStatus)}
          error={roundsError}
          idleMessage="ラウンド情報はまだ読み込まれていません。"
          loadingMessage="順位計算に必要なラウンド情報を読み込み中..."
          errorMessage="順位計算に必要なラウンド情報を読み込めませんでした。"
          onRetry={loadRounds}
        >
          <TournamentAsyncState
            status={readyOrEmptyStatus(entriesStatus)}
            error={entriesError}
            idleMessage="参加者情報はまだ読み込まれていません。"
            loadingMessage="順位計算に必要な参加者情報を読み込み中..."
            errorMessage="順位計算に必要な参加者情報を読み込めませんでした。"
            onRetry={loadEntries}
          >
            <TournamentAsyncState
              status={standingsStatus}
              error={standingsError}
              idleMessage="順位表はまだ読み込まれていません。"
              loadingMessage="順位表を読み込み中..."
              emptyMessage="順位データはまだありません。"
              errorMessage="順位表を読み込めませんでした。"
              onRetry={loadStandings}
            >
              <StandingsPanel
                entries={entries}
                formatParticipantName={formatParticipantName}
                rounds={rounds}
                selectedRoundNumber={selectedStandingRoundNumber}
                setSelectedRoundNumber={setSelectedStandingRoundNumber}
                standings={standings}
              />
            </TournamentAsyncState>
          </TournamentAsyncState>
        </TournamentAsyncState>
      ) : null}

      {roundRollbackConfirmation &&
      isCurrentRequestContext(roundRollbackConfirmation.contextKey) ? (
        <RoundRollbackConfirmDialog
          firstDiscardedRoundLabel={roundRollbackConfirmation.firstDiscardedRoundLabel}
          isSubmitting={isSubmitting}
          onCancel={() => setRoundRollbackConfirmation(null)}
          onConfirm={confirmRoundRollback}
          releasesTournamentCompletion={roundRollbackConfirmation.releasesTournamentCompletion}
          targetRoundLabel={roundRollbackConfirmation.targetRoundLabel}
        />
      ) : null}
    </main>
  );
}
