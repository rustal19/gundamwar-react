import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CardHoverPreview from "../components/CardHoverPreview";
import RoundTabs from "../components/RoundTabs";
import { useAuth } from "../context/AuthContext";
import { useDeckPreview } from "../hooks/useDeckPreview";
import {
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
  rejectEntry,
  reportMatchResult,
  startRoundTimer,
  updateEntryStatus,
  updateRoundMatches,
  updateTournament,
} from "../services/tournaments";
import { getCardCode } from "../utils/cardImages";
import { ENTRY_STATUS_LABELS, TOURNAMENT_STATUS_LABELS } from "../data/statusLabels";
import { buildDeckExport, groupDeckItemsByType } from "../utils/deckExport";
import { FORMAT_PRESETS, OTHER_FORMAT_NAME } from "../data/formats";
import "./Tournaments.css";

const DEFAULT_FORM = {
  title: "",
  description: "",
  format: "swiss",
  swissRounds: "",
  topCutSize: "",
  status: "draft",
  startsAt: "",
  registrationClosesAt: "",
  capacity: "",
  venue: "",
  isOnline: false,
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
    allowedSets: null,
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

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formFromTournament(tournament) {
  return {
    ...DEFAULT_FORM,
    ...tournament,
    swissRounds: tournament.swissRounds ?? "",
    topCutSize: tournament.topCutSize ?? "",
    startsAt: toDateTimeLocal(tournament.startsAt),
    registrationClosesAt: toDateTimeLocal(tournament.registrationClosesAt),
    capacity: tournament.capacity ?? "",
    venue: tournament.venue || "",
    announcement: tournament.announcement || "",
    roundTimeMinutes: tournament.roundTimeMinutes ?? "",
    isOnline: Boolean(tournament.isOnline),
    selfCheckin: Boolean(tournament.selfCheckin),
    decklistsPublic: Boolean(tournament.decklistsPublic),
    decklistRequired: Boolean(tournament.decklistRequired),
    lateEntry: Boolean(tournament.lateEntry),
    regulation: {
      ...DEFAULT_FORM.regulation,
      ...(tournament.regulation || {}),
      bannedCardsText: listToText(tournament.regulation?.bannedCards),
      limitedCardsText: listToText(tournament.regulation?.limitedCards),
      allowedSetsText: listToText(tournament.regulation?.allowedSets),
    },
  };
}

function payloadFromForm(form) {
  return {
    title: form.title,
    description: form.description,
    format: form.format,
    swissRounds: numberOrNull(form.swissRounds),
    topCutSize: numberOrNull(form.topCutSize),
    status: form.status,
    startsAt: fromDateTimeLocal(form.startsAt),
    registrationClosesAt: fromDateTimeLocal(form.registrationClosesAt),
    capacity: numberOrNull(form.capacity),
    venue: form.venue?.trim() ? form.venue.trim() : null,
    isOnline: Boolean(form.isOnline),
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
      bannedCards: textToList(form.regulation.bannedCardsText ?? form.regulation.bannedCards),
      limitedCards: textToList(form.regulation.limitedCardsText ?? form.regulation.limitedCards),
      allowedSets: textToList(form.regulation.allowedSetsText ?? form.regulation.allowedSets).length
        ? textToList(form.regulation.allowedSetsText ?? form.regulation.allowedSets)
        : null,
    },
  };
}

function countCards(items, zone) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => !zone || item.zone === zone)
    .reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function splitDeckItems(items) {
  const deckItems = Array.isArray(items) ? items : [];
  return {
    mainItems: deckItems.filter((item) => item.zone !== "side"),
    sideItems: deckItems.filter((item) => item.zone === "side"),
  };
}

function buildEntryDeckExport(entry) {
  const { mainItems, sideItems } = splitDeckItems(entry.deckItems);
  const name = entry.user?.name || entry.id || "-";
  const deckText = mainItems.length || sideItems.length
    ? buildDeckExport(groupDeckItemsByType(mainItems), sideItems)
    : "未提出";
  return [`# ${name}`, deckText].join("\n");
}

function buildAllDeckExport(entries) {
  return (entries || []).map((entry) => buildEntryDeckExport(entry)).join("\n\n---\n\n");
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

function entryName(entries, entryId) {
  return findEntry(entries, entryId)?.user?.name || entryId || "Bye";
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
  return (
    regulation?.name === presetRegulation?.name &&
    Number(regulation?.mainMin) === Number(presetRegulation?.mainMin) &&
    Number(regulation?.mainMax) === Number(presetRegulation?.mainMax) &&
    Number(regulation?.sideSize) === Number(presetRegulation?.sideSize) &&
    Number(regulation?.maxCopies) === Number(presetRegulation?.maxCopies) &&
    listToText(regulation?.allowedSetsText ?? regulation?.allowedSets) === listToText(presetRegulation?.allowedSets) &&
    listToText(regulation?.bannedCardsText ?? regulation?.bannedCards) === listToText(presetRegulation?.bannedCards) &&
    listToText(regulation?.limitedCardsText ?? regulation?.limitedCards) === listToText(presetRegulation?.limitedCards)
  );
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
    Number(form.swissRounds) > 0
      ? Number(form.swissRounds)
      : Math.max(1, Math.ceil(Math.log2(Math.max(2, activeEntryCount))));
  if (swissCompleted < swissLimit) return true;
  return Boolean(numberOrNull(form.topCutSize));
}

function nextActionText(form, rounds, activeEntryCount) {
  const status = form.status;
  if (status === "draft") return "内容を保存して「受付開始」を押してください。";
  if (status === "registration") return "当日になったら「進行開始」→ラウンド生成を行ってください。";
  if (status === "in_progress" && rounds.length === 0) return "第1回戦を生成してください。";
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
  if (status === "completed") return "大会は完了しています。結果訂正が必要な場合は対象ラウンドから訂正してください。";
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
    <table className="tournament-table tournament-decklist-table">
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
              <td>{item.zone === "side" ? "サイド" : "メイン"}</td>
              <td>{getCardCode(card) || "-"}</td>
              <td>
                <CardHoverPreview card={card} compact={compact}>
                  {card.name || item.cardId}
                </CardHoverPreview>
              </td>
              <td className="num">{item.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RoundManagePanel({
  entries,
  form,
  isSubmitting,
  onFinishRound,
  onGenerateRound,
  onReportScore,
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
  const activeEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status !== "dropped" &&
          entry.status !== "pending" &&
          Number(entry.joinedAtRound || 1) <= Number(selectedRound?.number || 1)
      ),
    [entries, selectedRound]
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
          <button type="button" onClick={onGenerateRound} disabled={isSubmitting}>
            次ラウンド生成
          </button>
        </div>
        {!form.roundTimeMinutes ? (
          <p className="tournament-muted">大会情報タブでラウンド制限時間を設定すると、残り時間タイマーを表示できます。</p>
        ) : null}
        <div className="tournament-empty">まだラウンドがありません。</div>
      </section>
    );
  }

  const canEditPairing = selectedRound?.status !== "completed";

  return (
    <section className="tournament-tab-panel">
      <div className="tournament-round-header">
        <h2>ラウンド運営</h2>
        <button type="button" onClick={onGenerateRound} disabled={isSubmitting}>
          次ラウンド生成
        </button>
      </div>
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
            <span>第{selectedRound.number}回戦</span>
            <span>{selectedRound.status === "completed" ? "完了" : "進行中"}</span>
            {form.roundTimeMinutes ? <span>残り {remainingTime(selectedRound, form.roundTimeMinutes, now)}</span> : null}
            {form.roundTimeMinutes ? (
              <button type="button" onClick={() => onStartTimer(selectedRound.id)} disabled={isSubmitting}>
                {selectedRound.timerStartedAt ? "タイマー再開始" : "タイマー開始"}
              </button>
            ) : null}
          </div>
          <div className="tournament-table-wrap">
            <table className="tournament-table manage-table">
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
                      <td className="num">{match.tableNo}</td>
                      <td>{entryName(entries, match.player1EntryId)}</td>
                      <td>{isBye ? "Bye" : entryName(entries, match.player2EntryId)}</td>
                      <td>
                        {isReported ? (
                          <span className={`score-badge ${match.result === "p2_win" ? "loss" : ""}`}>
                            {scoreLabel(match)}
                          </span>
                        ) : (
                          <span className="tournament-muted">未報告</span>
                        )}
                      </td>
                      <td className="tournament-score-actions">
                        {isBye ? (
                          <span className="tournament-muted">自動</span>
                        ) : editingMatchId === match.id || !isReported ? (
                          <>
                            {BO3_PRESETS.map(([p1, p2]) => (
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
                              ...
                            </button>
                            {editingMatchId === match.id ? (
                              <span className="custom-score-input">
                                <input
                                  aria-label="プレイヤー1ゲーム数"
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
                          {entry.user?.name || entry.id}
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
                          {entry.user?.name || entry.id}
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
            <button
              type="button"
              disabled={selectedRound.status === "completed" || !roundIsComplete(selectedRound) || isSubmitting}
              onClick={() => onFinishRound(selectedRound.id)}
            >
              ラウンド完了
            </button>
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
  compact,
  entries,
  form,
  isSubmitting,
  onApprove,
  onCreateManual,
  onDeckRegister,
  onReject,
  onStatusChange,
  rounds,
}) {
  const [missingOnly, setMissingOnly] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualDeckText, setManualDeckText] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const pendingEntries = entries.filter((entry) => entry.status === "pending");
  const visibleEntries = entries.filter((entry) => !missingOnly || !entry.decklistSubmittedAt);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) || null;
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

  const copyAllDecks = async () => {
    setExportMessage("");
    setExportError("");
    try {
      await navigator.clipboard.writeText(buildAllDeckExport(entries));
      setExportMessage("デッキリストを一括コピーしました。");
    } catch (copyError) {
      setExportError("クリップボードへコピーできませんでした。");
    }
  };

  const downloadAllDecks = () => {
    setExportMessage("");
    setExportError("");
    const blob = new Blob([buildAllDeckExport(entries)], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${safeFilename(form.title, "tournament")}-decklists.txt`);
    setExportMessage("デッキリストの .txt を作成しました。");
  };

  const downloadDeckImage = () => {
    if (!previewBlob || !selectedEntry) return;
    const fileBase = `${form.title || "tournament"}-${selectedEntry.user?.name || selectedEntry.id}`;
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
      {form.lateEntry && pendingEntries.length ? (
        <div className="pending-entry-section">
          <h3>申請中</h3>
          {pendingEntries.map((entry) => (
            <div key={entry.id} className="pending-entry-row">
              <div>
                <strong>{entry.user?.name || entry.id}</strong>
                <p>許可すると第{entry.joinedAtRound || nextRound}回戦まで不戦敗として追加されます。</p>
              </div>
              <div className="tournament-row-actions">
                <button type="button" onClick={() => onApprove(entry.id)} disabled={isSubmitting}>
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
      <div className="manual-entry-form">
        <h3>+ 参加者を追加</h3>
        <input
          aria-label="参加者名"
          placeholder="参加者名"
          value={manualName}
          onChange={(event) => setManualName(event.target.value)}
        />
        <textarea
          aria-label="任意デッキ"
          placeholder="任意デッキ: カード名,枚数,main または side"
          value={manualDeckText}
          onChange={(event) => setManualDeckText(event.target.value)}
        />
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
        <div className="tournament-empty">参加登録されていません</div>
      ) : (
        <div className="tournament-table-wrap">
          <table className="tournament-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>名前</th>
              <th>状態</th>
              <th>提出状況</th>
              <th>バッジ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry, index) => (
              <tr key={entry.id}>
                <td className="num">{index + 1}</td>
                <td>{entry.user?.name || "-"}</td>
                <td>{ENTRY_STATUS_LABELS[entry.status] || entry.status}</td>
                <td>
                  {entry.decklistSubmittedAt ? (
                    formatDateTime(entry.decklistSubmittedAt)
                  ) : (
                    <span className="missing-badge">未提出</span>
                  )}
                </td>
                <td>
                  {entry.user?.id == null ? <span className="mini-badge">ゲスト</span> : null}
                  {Number(entry.joinedAtRound || 1) > 1 ? (
                    <span className="mini-badge">第{entry.joinedAtRound}回戦から</span>
                  ) : null}
                </td>
                <td className="tournament-row-actions">
                  <button type="button" onClick={() => setSelectedEntryId(entry.id)} disabled={isSubmitting}>
                    閲覧
                  </button>
                  <button type="button" onClick={() => onDeckRegister(entry.id)} disabled={isSubmitting}>
                    デッキ登録
                  </button>
                  <button type="button" onClick={() => onStatusChange(entry.id, "checked_in")} disabled={isSubmitting}>
                    チェックイン
                  </button>
                  <button type="button" onClick={() => onStatusChange(entry.id, "dropped")} disabled={isSubmitting}>
                    ドロップ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
      {selectedEntry ? (
        <div className="tournament-deck-viewer">
          <div className="tournament-round-header">
            <h3>{selectedEntry.user?.name || "-"} のデッキリスト</h3>
            <button type="button" onClick={() => setSelectedEntryId("")}>
              閉じる
            </button>
          </div>
          {selectedEntry.deckItems?.length ? (
            <>
              <div className="tournament-deck-summary">
                提出済み (メイン {countCards(selectedEntry.deckItems, "main")} / サイド{" "}
                {countCards(selectedEntry.deckItems, "side")})
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
    </section>
  );
}

function InfoPanel({
  form,
  hasRounds,
  isNew,
  isSubmitting,
  onSave,
  regulationViolations,
  setField,
  setOnline,
  setRegulationField,
}) {
  const selectedPresetName =
    FORMAT_PRESETS.find((preset) => regulationMatchesPreset(form.regulation, preset.regulation))?.name || OTHER_FORMAT_NAME;
  const setFormatPreset = (name) => {
    const preset = FORMAT_PRESETS.find((item) => item.name === name);
    if (!preset) return;
    setField("regulation", {
      ...preset.regulation,
      bannedCardsText: listToText(preset.regulation?.bannedCards),
      limitedCardsText: listToText(preset.regulation?.limitedCards),
      allowedSetsText: listToText(preset.regulation?.allowedSets),
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
                {item.entryName || item.entryId}: {item.violations.map((violation) => violation.message).join(" / ")}
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
            定員
            <input type="number" min="1" value={form.capacity} placeholder="制限なし" onChange={(event) => setField("capacity", event.target.value)} />
          </label>
          <label className="tournament-form-wide">
            説明
            <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </label>
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
          <label title={hasRounds ? "ラウンド生成後は変更できません" : ""}>
            形式 {hasRounds ? "🔒" : ""}
            <select value={form.format} onChange={(event) => setField("format", event.target.value)} disabled={hasRounds}>
              <option value="swiss">スイス</option>
              <option value="single_elim">シングルエリミネーション</option>
            </select>
          </label>
          <label title={hasRounds ? "ラウンド生成後は変更できません" : ""}>
            スイス回数 {hasRounds ? "🔒" : ""}
            <input
              type="number"
              min="1"
              value={form.swissRounds}
              placeholder="自動"
              disabled={hasRounds}
              onChange={(event) => setField("swissRounds", event.target.value)}
            />
          </label>
          <label title={hasRounds ? "ラウンド生成後は変更できません" : ""}>
            トップカット {hasRounds ? "🔒" : ""}
            <input
              type="number"
              min="2"
              value={form.topCutSize}
              placeholder="なし"
              disabled={hasRounds}
              onChange={(event) => setField("topCutSize", event.target.value)}
            />
          </label>
          <label>
            ラウンド制限時間
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
        <details className="manage-regulation-details">
          <summary>詳細を編集</summary>
          <div className="tournament-form-grid">
            <label>
              名称
              <input value={form.regulation.name} onChange={(event) => setRegulationField("name", event.target.value)} />
            </label>
            <label>
              メイン下限
              <input type="number" value={form.regulation.mainMin} onChange={(event) => setRegulationField("mainMin", event.target.value)} />
            </label>
            <label>
              メイン上限
              <input type="number" value={form.regulation.mainMax} onChange={(event) => setRegulationField("mainMax", event.target.value)} />
            </label>
            <label>
              サイド枚数
              <input type="number" value={form.regulation.sideSize} onChange={(event) => setRegulationField("sideSize", event.target.value)} />
            </label>
            <label>
              同名上限
              <input type="number" value={form.regulation.maxCopies} onChange={(event) => setRegulationField("maxCopies", event.target.value)} />
            </label>
            <label>
              使用可能セット
              <textarea value={form.regulation.allowedSetsText ?? ""} onChange={(event) => setRegulationField("allowedSetsText", event.target.value)} />
            </label>
            <label>
              禁止カード
              <textarea value={form.regulation.bannedCardsText ?? ""} onChange={(event) => setRegulationField("bannedCardsText", event.target.value)} />
            </label>
            <label>
              制限カード
              <textarea value={form.regulation.limitedCardsText ?? ""} onChange={(event) => setRegulationField("limitedCardsText", event.target.value)} />
            </label>
          </div>
        </details>
      </section>
      <div className="tournament-entry-actions tournament-manage-actions">
        <button type="submit" disabled={isSubmitting}>
          {isNew ? "作成" : "保存"}
        </button>
      </div>
    </form>
  );
}

function StandingsPanel({ entries, rounds, selectedRoundNumber, setSelectedRoundNumber, standings }) {
  return (
    <section className="tournament-tab-panel">
      <h2>順位表</h2>
      <RoundTabs rounds={rounds} selectedRoundNumber={selectedRoundNumber} onChange={setSelectedRoundNumber} />
      <div className="tournament-table-wrap">
        <table className="tournament-table">
          <thead>
            <tr>
              <th className="num">順位</th>
              <th>プレイヤー</th>
              <th className="num">勝</th>
              <th className="num">敗</th>
              <th className="num">分</th>
              <th className="num">勝点</th>
              <th className="num">OMW%</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const entry = standing.entry || findEntry(entries, standing.entryId);
              return (
                <tr key={standing.entryId}>
                  <td className="num">{standing.rank}</td>
                  <td>{entry?.user?.name || standing.entryId}</td>
                  <td className="num">{standing.wins}</td>
                  <td className="num">{standing.losses}</td>
                  <td className="num">{standing.draws}</td>
                  <td className="num">{standing.points}</td>
                  <td className="num">{Math.round(Number(standing.omwPercent || 0) * 1000) / 10}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TournamentManage({ compact = false }) {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { authMode, user, isOrganizer } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [entries, setEntries] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState([]);
  const [activeTab, setActiveTab] = useState("rounds");
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [regulationViolations, setRegulationViolations] = useState([]);

  const latestRoundNumber = rounds.length ? rounds[rounds.length - 1].number : null;
  const detailUrl = isNew ? "" : `${window.location.origin}/tournaments/${id}`;
  const displayUrl = isNew ? "" : `/tournaments/${id}/display`;

  const loadAll = useCallback(async () => {
    if (isNew || !isOrganizer) return;
    setIsLoading(true);
    setError("");
    try {
      const [tournament, entryPayload, roundPayload, standingPayload] = await Promise.all([
        fetchTournament(id, { authMode, user }),
        fetchEntries(id, { authMode }),
        fetchRoundsForManage(id, { authMode }),
        fetchStandings(id, { authMode }),
      ]);
      setForm(formFromTournament(tournament));
      setEntries(entryPayload.items || []);
      const nextRounds = roundPayload.rounds || [];
      setRounds(nextRounds);
      setStandings(standingPayload.items || []);
      if (nextRounds.length) {
        setSelectedRoundNumber((current) =>
          nextRounds.some((round) => Number(round.number) === Number(current))
            ? current
            : nextRounds[nextRounds.length - 1].number
        );
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [authMode, id, isNew, isOrganizer, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  const runAction = async (action, successMessage = "") => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (successMessage) setMessage(successMessage);
      await loadAll();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveTournament = async (event) => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) return;
    await runAction(async () => {
      const payload = payloadFromForm(form);
      if (isNew) {
        const created = await createTournament({ ...payload, authMode, user });
        setMessage("大会を作成しました。");
        navigate(`/tournaments/${created.id}/manage`, { replace: true });
        return;
      }
      const updated = await updateTournament({ id, ...payload, authMode, user });
      setForm(formFromTournament(updated));
      setRegulationViolations(
        (updated.violations || []).map((item) => ({
          ...item,
          entryName: findEntry(entries, item.entryId)?.user?.name,
        }))
      );
      setMessage("大会情報を保存しました。");
    });
  };

  const changeStatus = (status) =>
    runAction(async () => updateTournament({ id, status, authMode, user }), "ステータスを更新しました。");

  const cancelTournament = () => {
    if (!window.confirm("大会を中止します。よろしいですか？")) return;
    changeStatus("cancelled");
  };

  const removeDraft = () => {
    if (!window.confirm("下書きを削除します。よろしいですか？")) return;
    runAction(async () => {
      await deleteTournament(id, { authMode, user });
      navigate("/tournaments", { replace: true });
    }, "下書きを削除しました。");
  };

  const copyUrl = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(detailUrl);
      setMessage("大会URLをコピーしました。");
    } catch (copyError) {
      setError("URLをコピーできませんでした。");
    }
  };

  const generateRound = () => runAction(async () => createNextRound(id, { authMode }), "次ラウンドを生成しました。");

  const reportScore = (matchId, player1Games, player2Games) =>
    runAction(
      async () => reportMatchResult({ matchId, player1Games, player2Games, authMode }),
      "結果を保存しました。"
    );

  const finishRound = (roundId) => runAction(async () => completeRound(roundId, { authMode }), "ラウンドを完了しました。");

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
        }),
      "ペアリングを保存しました。"
    );

  const repairRound = (roundId) => {
    if (!window.confirm("このラウンドを破棄して組み直します。よろしいですか？")) return;
    runAction(async () => {
      await deleteRound(roundId, { authMode });
      await createNextRound(id, { authMode });
    }, "ラウンドを組み直しました。");
  };

  const saveAnnouncement = (announcement) =>
    runAction(
      async () => updateTournament({ id, announcement: announcement.trim() || null, authMode, user }),
      announcement.trim() ? "アナウンスを掲示しました。" : "アナウンスを取り下げました。"
    );

  const approvePendingEntry = (entryId) =>
    runAction(async () => approveEntry({ tournamentId: id, entryId, authMode }), "申請を許可しました。");

  const rejectPendingEntry = (entryId) =>
    runAction(async () => rejectEntry({ tournamentId: id, entryId, authMode }), "申請を却下しました。");

  const createManual = (name, deckText) =>
    runAction(
      async () => createManualEntry({ tournamentId: id, name, deckItems: parseDeckText(deckText), authMode }),
      "参加者を追加しました。"
    );

  const changeEntryStatus = (entryId, status) =>
    runAction(
      async () => updateEntryStatus({ tournamentId: id, entryId, status, authMode }),
      "参加者の状態を更新しました。"
    );

  const deckRegister = (entryId) => {
    const name = window.prompt("カード名を1行ずつ入力してください。空で未提出に戻します。", "");
    if (name == null) return;
    runAction(
      async () => updateEntryStatus({ tournamentId: id, entryId, deckItems: parseDeckText(name), authMode }),
      "デッキを登録しました。"
    );
  };

  const startTimer = (roundId) => runAction(async () => startRoundTimer(roundId, { authMode }), "タイマーを開始しました。");

  if (!isOrganizer) {
    return (
      <main className={compact ? "tournament-page compact" : "tournament-page"}>
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <div className="tournament-alert">主催者または管理者のみ利用できます。</div>
      </main>
    );
  }

  const hasRounds = rounds.length > 0;

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

      {isLoading ? <div className="tournament-muted">読み込み中...</div> : null}
      {message ? <div className="tournament-success">{message}</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}

      {!isNew ? (
        <>
          <div className="next-action-band">
            <strong>次にやること:</strong>{" "}
            {nextActionText(form, rounds, entries.filter((entry) => entry.status !== "dropped" && entry.status !== "pending").length)}
          </div>
          <div className="status-action-row">
            <button type="button" disabled={isSubmitting || form.status !== "draft"} onClick={() => changeStatus("registration")}>
              受付開始
            </button>
            <button
              type="button"
              disabled={isSubmitting || form.status !== "registration"}
              onClick={() => changeStatus("in_progress")}
            >
              進行開始
            </button>
            <button type="button" disabled={isSubmitting || form.status !== "in_progress"} onClick={() => changeStatus("completed")}>
              完了
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={isSubmitting || form.status === "completed" || form.status === "cancelled"}
              onClick={cancelTournament}
            >
              中止
            </button>
            {form.status === "draft" ? (
              <button type="button" className="danger-button" disabled={isSubmitting} onClick={removeDraft}>
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
        <InfoPanel
          form={form}
          hasRounds={hasRounds}
          isNew={isNew}
          isSubmitting={isSubmitting}
          onSave={saveTournament}
          regulationViolations={regulationViolations}
          setField={setField}
          setOnline={setOnline}
          setRegulationField={setRegulationField}
        />
      )}

      {!isNew && activeTab === "rounds" ? (
        <RoundManagePanel
          entries={entries}
          form={form}
          isSubmitting={isSubmitting}
          onFinishRound={finishRound}
          onGenerateRound={generateRound}
          onReportScore={reportScore}
          onRepairRound={repairRound}
          onSaveAnnouncement={saveAnnouncement}
          onSavePairings={savePairings}
          onStartTimer={startTimer}
          rounds={rounds}
          selectedRoundNumber={selectedRoundNumber}
          setSelectedRoundNumber={setSelectedRoundNumber}
        />
      ) : null}

      {!isNew && activeTab === "participants" ? (
        <ParticipantsPanel
          compact={compact}
          entries={entries}
          form={form}
          isSubmitting={isSubmitting}
          onApprove={approvePendingEntry}
          onCreateManual={createManual}
          onDeckRegister={deckRegister}
          onReject={rejectPendingEntry}
          onStatusChange={changeEntryStatus}
          rounds={rounds}
        />
      ) : null}

      {!isNew && activeTab === "standings" ? (
        <StandingsPanel
          entries={entries}
          rounds={rounds}
          selectedRoundNumber={selectedRoundNumber}
          setSelectedRoundNumber={setSelectedRoundNumber}
          standings={standings}
        />
      ) : null}
    </main>
  );
}
