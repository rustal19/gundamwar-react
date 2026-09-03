import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDeck } from "../context/DeckContext";
import { fetchSavedDecks } from "../services/savedDecks";
import AsyncState from "../components/AsyncState";
import Bracket from "../components/Bracket";
import CardHoverPreview from "../components/CardHoverPreview";
import RoundTabs from "../components/RoundTabs";
import TournamentMyStatus from "../components/TournamentMyStatus";
import { MegaphoneIcon } from "../components/icons";
import { getCardCode } from "../utils/cardImages";
import {
  checkInMyEntry,
  createEntry,
  deleteMyEntry,
  fetchRounds,
  fetchStandings,
  fetchTournament,
  getTournamentPermissions,
  updateMyEntry,
} from "../services/tournaments";
import {
  ENTRY_STATUS_LABELS,
  ROUND_STATUS_LABELS,
  TOURNAMENT_STATUS_LABELS as STATUS_LABELS,
} from "../data/statusLabels";
import { FORMAT_PRESETS } from "../data/formats";
import { defaultRegulation, validateDeck } from "../utils/deckValidation";
import { formatDeckCountSummary, getDeckCounts } from "../utils/deckCounts";
import { createTournamentParticipantNameFormatter } from "../utils/tournament/participantDisplayName";
import { getRoundProgressLabel } from "../utils/tournament/roundLabel";
import {
  getSwissEndConditionLabel,
  getSwissRoundSummary,
} from "../utils/tournament/swiss";
import { computeStandings } from "../utils/tournament/standings";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import NotFound from "./NotFound";
import "./Tournaments.css";

const BASE_TABS = [
  { id: "overview", label: "概要" },
  { id: "entries", label: "参加者" },
  { id: "rounds", label: "ペアリング" },
  { id: "results", label: "リザルト" },
  { id: "standings", label: "順位表" },
];


function formatDateTime(value, { monthDayOnly = false } = {}) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (monthDayOnly) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
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

function isBefore(value) {
  if (!value) return true;
  return Date.now() < new Date(value).getTime();
}

export function formatCardCountRange(min, max) {
  return Number(min) === Number(max) ? `${min}枚` : `${min} - ${max}枚`;
}

function formatDeckItemsCount(items) {
  const { mainCount, sideCount } = getDeckCounts(items);
  return formatDeckCountSummary(mainCount, sideCount);
}

function findEntry(entries, entryId) {
  return entries.find((entry) => entry.id === entryId) || null;
}

function UserNameLink({ entry, formatParticipantName, fallback = "-" }) {
  const user = entry?.user;
  const label = formatParticipantName(entry, fallback);
  return user?.id ? <Link to={`/users/${user.id}`}>{label}</Link> : <span>{label}</span>;
}

function buildMatchPlayers(match, entries) {
  const p1 = findEntry(entries, match.player1EntryId);
  const p2 = match.player2EntryId == null ? null : findEntry(entries, match.player2EntryId);
  return {
    p1,
    p2,
  };
}

function sortedMatches(round) {
  return (round?.matches || [])
    .slice()
    .sort((left, right) => Number(left.tableNo || 0) - Number(right.tableNo || 0));
}

function resultLabel(result) {
  if (result === "p1_win") return "P1勝利";
  if (result === "p2_win") return "P2勝利";
  if (result === "draw") return "引き分け";
  if (result === "bye") return "不戦勝";
  return "未報告";
}

function matchScoreLabel(match) {
  if (match.result === "bye") return "不戦勝";
  if (match.result == null) return "未報告";
  if (match.player1Games == null || match.player2Games == null) return resultLabel(match.result);
  return `${match.player1Games} - ${match.player2Games}（${resultLabel(match.result)}）`;
}

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

function localizedActionError(error, fallback = "操作に失敗しました。もう一度お試しください。") {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(message) ? message : fallback;
}

function TournamentDeckRows({ items, compact }) {
  return (
    <table className="tournament-table tournament-decklist-table tournament-public-decklist-table">
      <thead>
        <tr>
          <th scope="col">区分</th>
          <th scope="col">カード番号</th>
          <th scope="col">カード名</th>
          <th scope="col" className="num">枚数</th>
        </tr>
      </thead>
      <tbody>
        {(items || []).map((item, index) => {
          const card = item.card || {};
          return (
            <tr key={`${item.cardId || card.name}-${item.zone || "main"}-${index}`}>
              <td className="tournament-public-deck-zone">
                <span className="tournament-deck-cell-label">区分:</span>
                <span>{item.zone === "side" ? "サイド" : "メイン"}</span>
              </td>
              <td className="tournament-public-deck-code">
                <span className="tournament-deck-cell-label">カード番号:</span>
                <span>{getCardCode(card) || "-"}</span>
              </td>
              <td className="tournament-public-deck-name">
                <CardHoverPreview card={card} compact={compact}>
                  {card.name || item.cardId}
                </CardHoverPreview>
              </td>
              <td className="num tournament-public-deck-count">
                <span className="tournament-deck-cell-label">枚数:</span>
                <span>{item.count}枚</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function TournamentDetail({ compact = false }) {
  const { id } = useParams();
  const { authMode, isAuthenticated, isReady, user } = useAuth();
  const requestContextKey = [
    id || "",
    authMode || "",
    user?.id || "",
    user?.role || "",
    isAuthenticated ? "authenticated" : "anonymous",
    isReady === false ? "pending" : "ready",
  ].join("::");
  const currentRequestContextRef = useRef(requestContextKey);
  currentRequestContextRef.current = requestContextKey;
  const isCurrentRequestContext = useCallback(
    (contextKey) => currentRequestContextRef.current === contextKey,
    []
  );
  const currentDeck = useDeck();
  const [activeTab, setActiveTab] = useState("overview");
  const [pairingRoundNumber, setPairingRoundNumber] = useState(null);
  const [resultRoundNumber, setResultRoundNumber] = useState(null);
  const [standingRoundNumber, setStandingRoundNumber] = useState(null);
  const [deckSource, setDeckSource] = useState("current");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isTournamentNotFound, setIsTournamentNotFound] = useState(false);
  const [tournamentContextKey, setTournamentContextKey] = useState("");
  const [pendingMutationRefresh, setPendingMutationRefresh] = useState(null);
  const requestIdRef = useRef({ tournament: 0, rounds: 0, standings: 0, savedDecks: 0 });
  const {
    status: tournamentStatus,
    data: tournament,
    error: tournamentError,
    start: startTournament,
    succeed: succeedTournament,
    fail: failTournament,
  } = useAsyncResource(null);
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
  const {
    status: savedDecksStatus,
    data: savedDecks,
    error: savedDecksError,
    start: startSavedDecks,
    succeed: succeedSavedDecks,
    fail: failSavedDecks,
    reset: resetSavedDecks,
  } = useAsyncResource([]);
  const {
    status: mutationRefreshStatus,
    error: mutationRefreshError,
    start: startMutationRefresh,
    succeed: succeedMutationRefresh,
    fail: failMutationRefresh,
    reset: resetMutationRefresh,
  } = useAsyncResource(null, () => false);

  const loadTournament = useCallback(async ({ background = false, rethrow = false } = {}) => {
    const contextKey = requestContextKey;
    if (!isCurrentRequestContext(contextKey)) return null;
    const requestId = requestIdRef.current.tournament + 1;
    requestIdRef.current.tournament = requestId;
    setTournamentContextKey(contextKey);
    if (!background) startTournament();
    setIsTournamentNotFound(false);
    try {
      const nextTournament = await fetchTournament(id, { authMode, user });
      if (
        requestIdRef.current.tournament !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      succeedTournament(nextTournament);
      return nextTournament;
    } catch (loadError) {
      if (
        requestIdRef.current.tournament !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const notFound = loadError?.code === "not_found" || loadError?.status === 404;
      if (!background) {
        setIsTournamentNotFound(notFound);
        failTournament(notFound ? "大会が見つかりません。" : "大会情報を読み込めませんでした。");
      }
      if (rethrow) throw loadError;
      return null;
    }
  }, [
    authMode,
    failTournament,
    id,
    isCurrentRequestContext,
    requestContextKey,
    startTournament,
    succeedTournament,
    user,
  ]);

  const loadRounds = useCallback(async ({ background = false, rethrow = false } = {}) => {
    const contextKey = requestContextKey;
    if (!isCurrentRequestContext(contextKey)) return null;
    const requestId = requestIdRef.current.rounds + 1;
    requestIdRef.current.rounds = requestId;
    if (!background) startRounds();
    try {
      const payload = await fetchRounds(id, { authMode, user });
      if (
        requestIdRef.current.rounds !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const nextRounds = payload.rounds || [];
      succeedRounds(nextRounds);
      return nextRounds;
    } catch (loadError) {
      if (
        requestIdRef.current.rounds !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      if (!background) failRounds("ペアリングを読み込めませんでした。");
      if (rethrow) throw loadError;
      return null;
    }
  }, [
    authMode,
    failRounds,
    id,
    isCurrentRequestContext,
    requestContextKey,
    startRounds,
    succeedRounds,
    user,
  ]);

  const loadStandings = useCallback(async ({ background = false, rethrow = false } = {}) => {
    const contextKey = requestContextKey;
    if (!isCurrentRequestContext(contextKey)) return null;
    const requestId = requestIdRef.current.standings + 1;
    requestIdRef.current.standings = requestId;
    if (!background) startStandings();
    try {
      const payload = await fetchStandings(id, { authMode });
      if (
        requestIdRef.current.standings !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      const nextStandings = payload.items || payload.standings || [];
      succeedStandings(nextStandings);
      return nextStandings;
    } catch (loadError) {
      if (
        requestIdRef.current.standings !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return null;
      if (!background) failStandings("順位表を読み込めませんでした。");
      if (rethrow) throw loadError;
      return null;
    }
  }, [
    authMode,
    failStandings,
    id,
    isCurrentRequestContext,
    requestContextKey,
    startStandings,
    succeedStandings,
  ]);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (isReady === false || !isCurrentRequestContext(requestContextKey)) return null;
    return Promise.all([
      loadTournament({ background: silent }),
      loadRounds({ background: silent }),
      loadStandings({ background: silent }),
    ]);
  }, [
    isCurrentRequestContext,
    isReady,
    loadRounds,
    loadStandings,
    loadTournament,
    requestContextKey,
  ]);

  const loadSavedDecks = useCallback(async () => {
    const contextKey = requestContextKey;
    if (!isCurrentRequestContext(contextKey)) return;
    const requestId = requestIdRef.current.savedDecks + 1;
    requestIdRef.current.savedDecks = requestId;
    startSavedDecks();
    try {
      const decks = await fetchSavedDecks({ authMode, user });
      if (
        requestIdRef.current.savedDecks !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return;
      succeedSavedDecks(decks || []);
    } catch (_loadError) {
      if (
        requestIdRef.current.savedDecks !== requestId ||
        !isCurrentRequestContext(contextKey)
      ) return;
      failSavedDecks("保存済みデッキを読み込めませんでした。");
    }
  }, [
    authMode,
    failSavedDecks,
    isCurrentRequestContext,
    requestContextKey,
    startSavedDecks,
    succeedSavedDecks,
    user,
  ]);

  useEffect(() => {
    setActiveTab("overview");
    setPairingRoundNumber(null);
    setResultRoundNumber(null);
    setStandingRoundNumber(null);
    setDeckSource("current");
    setSelectedDeckId("");
    setIsSubmitting(false);
    setMessage("");
    setError("");
    setIsTournamentNotFound(false);
    setTournamentContextKey("");
    setPendingMutationRefresh(null);
    resetMutationRefresh();
  }, [requestContextKey, resetMutationRefresh]);

  useEffect(() => {
    if (isReady !== false) loadAll();
    return () => {
      requestIdRef.current.tournament += 1;
      requestIdRef.current.rounds += 1;
      requestIdRef.current.standings += 1;
    };
  }, [isReady, loadAll]);

  useEffect(() => {
    if (
      tournamentContextKey !== requestContextKey ||
      tournament?.status !== "in_progress"
    ) return undefined;

    let intervalId = null;
    const refresh = () => {
      if (document.hidden) return;
      loadAll({ silent: true });
    };
    const start = () => {
      if (intervalId == null && !document.hidden) {
        intervalId = window.setInterval(refresh, 30000);
      }
    };
    const stop = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadAll, requestContextKey, tournament?.status, tournamentContextKey]);

  useEffect(() => {
    if (isReady === false || !isAuthenticated || !user) {
      requestIdRef.current.savedDecks += 1;
      resetSavedDecks();
      return;
    }
    loadSavedDecks();
    return () => {
      requestIdRef.current.savedDecks += 1;
    };
  }, [isAuthenticated, isReady, loadSavedDecks, resetSavedDecks, user]);

  const entries = useMemo(() => tournament?.entries || [], [tournament?.entries]);
  const permissions = useMemo(
    () => getTournamentPermissions(tournament, user),
    [tournament, user]
  );
  const activeEntryCount = useMemo(
    () =>
      entries.filter(
        (entry) => entry.status !== "dropped" && !entry.isWaitlisted
      ).length,
    [entries]
  );
  const waitlistedEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.isWaitlisted && entry.status !== "dropped")
        .slice()
        .sort((left, right) => {
          const createdAtComparison = String(left.createdAt || "").localeCompare(
            String(right.createdAt || "")
          );
          if (createdAtComparison !== 0) return createdAtComparison;
          return String(left.id).localeCompare(String(right.id), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }),
    [entries]
  );
  const waitlistPositions = useMemo(
    () => new Map(waitlistedEntries.map((entry, index) => [entry.id, index + 1])),
    [waitlistedEntries]
  );
  const formatParticipantName = useMemo(
    () => createTournamentParticipantNameFormatter(entries),
    [entries]
  );
  const visibleTabs = useMemo(
    () => BASE_TABS.filter((tab) => tab.id !== "results" || tournament?.status === "completed"),
    [tournament?.status]
  );
  useEffect(() => {
    if (activeTab === "results" && tournament?.status !== "completed") {
      setActiveTab("rounds");
    }
  }, [activeTab, tournament?.status]);

  const myEntry = useMemo(() => {
    if (tournament?.myEntry && tournament.myEntry.status !== "dropped") {
      return tournament.myEntry;
    }
    if (!user?.id) return null;
    return (
      entries.find(
        (entry) =>
          entry.user?.id === String(user.id) && entry.status !== "dropped"
      ) || null
    );
  }, [entries, tournament, user]);

  const selectedSavedDeck = useMemo(
    () => savedDecks.find((deck) => deck.id === selectedDeckId) || null,
    [savedDecks, selectedDeckId]
  );

  const submittedItems = useMemo(() => {
    if (deckSource === "saved") return selectedSavedDeck?.items || [];
    return currentDeck.items || [];
  }, [currentDeck.items, deckSource, selectedSavedDeck]);
  const regulation = useMemo(
    () => defaultRegulation(tournament?.regulation),
    [tournament?.regulation]
  );
  const regulationNote = useMemo(
    () => FORMAT_PRESETS.find((preset) => preset.regulation?.name === regulation.name)?.note || "",
    [regulation]
  );
  const deckViolations = useMemo(() => {
    return validateDeck(submittedItems, regulation);
  }, [regulation, submittedItems]);
  const canEnterWithoutDeck = Boolean(
    !myEntry && !tournament?.decklistRequired && submittedItems.length === 0
  );

  const canRegister = Boolean(
    tournament &&
      tournament.status === "registration" &&
      isBefore(tournament.registrationClosesAt)
  );
  const canUpdateDeck = Boolean(
    tournament &&
      ["registration", "in_progress"].includes(tournament.status) &&
      isBefore(tournament.registrationClosesAt) &&
      myEntry &&
      ["none", "submitted"].includes(myEntry.decklistState) &&
      !myEntry.deckLockedAt
  );
  const canLateEntry = Boolean(
    tournament &&
      tournament.status === "in_progress" &&
      tournament.lateEntry &&
      !myEntry
  );
  const canCancel = Boolean(
    tournament && tournament.status === "registration" && isBefore(tournament.startsAt) && myEntry
  );
  const decklistsVisible = tournament?.status === "completed" && tournament.decklistsPublic;
  const selectedPairingRound = useMemo(
    () => rounds.find((round) => Number(round.number) === Number(pairingRoundNumber)) || null,
    [pairingRoundNumber, rounds]
  );
  const selectedResultRound = useMemo(
    () => rounds.find((round) => Number(round.number) === Number(resultRoundNumber)) || null,
    [resultRoundNumber, rounds]
  );
  const selectedStandingRound = useMemo(
    () => rounds.find((round) => Number(round.number) === Number(standingRoundNumber)) || null,
    [rounds, standingRoundNumber]
  );
  const swissRounds = useMemo(
    () => rounds.filter((round) => round.stage !== "top_cut"),
    [rounds]
  );
  const topCutRounds = useMemo(
    () => rounds.filter((round) => round.stage === "top_cut"),
    [rounds]
  );
  const pointInTimeStandings = useMemo(() => {
    if (!rounds.length) return standings;
    const matches = swissRounds
      .filter(
        (round) =>
          !selectedStandingRound || Number(round.number) <= Number(selectedStandingRound.number)
      )
      .flatMap((round) => round.matches || []);
    return computeStandings(entries, matches).map((standing) => ({
      ...standing,
      entry: findEntry(entries, standing.entryId),
    }));
  }, [entries, rounds.length, selectedStandingRound, standings, swissRounds]);
  const standingsDisplayStatus =
    standingsStatus === ASYNC_STATUS.EMPTY && pointInTimeStandings.length
      ? ASYNC_STATUS.SUCCESS
      : standingsStatus;
  const entryMutationStateUnconfirmed = [
    ASYNC_STATUS.LOADING,
    ASYNC_STATUS.ERROR,
  ].includes(mutationRefreshStatus);

  const submitDisabled =
    isSubmitting ||
    entryMutationStateUnconfirmed ||
    !isAuthenticated ||
    (deckViolations.length > 0 && !canEnterWithoutDeck) ||
    (!canRegister && !canUpdateDeck);

  const refreshAfterMutation = async ({
    contextKey,
    includeStandings = false,
    successMessage,
  }) => {
    if (!isCurrentRequestContext(contextKey)) return false;
    const pendingRefresh = { contextKey, includeStandings, successMessage };
    setPendingMutationRefresh(pendingRefresh);
    startMutationRefresh();
    setMessage("");
    setError("");
    try {
      const refreshedTournament = await loadTournament({ background: true, rethrow: true });
      if (refreshedTournament == null) throw new Error("stale tournament refresh");
      if (includeStandings) {
        const refreshedStandings = await loadStandings({ background: true, rethrow: true });
        if (refreshedStandings == null) throw new Error("stale standings refresh");
      }
      if (!isCurrentRequestContext(contextKey)) return false;
      succeedMutationRefresh({ contextKey, refreshed: true });
      setPendingMutationRefresh(null);
      setMessage(successMessage);
      return true;
    } catch (_refreshError) {
      if (isCurrentRequestContext(contextKey)) {
        setMessage("");
        setError("");
        failMutationRefresh(
          "操作は完了しましたが、最新の参加状態を確認できませんでした。"
        );
      }
      return false;
    }
  };

  const retryMutationRefresh = () => {
    if (
      !pendingMutationRefresh ||
      !isCurrentRequestContext(pendingMutationRefresh.contextKey)
    ) return;
    return refreshAfterMutation(pendingMutationRefresh);
  };

  const submitEntry = async () => {
    if (deckViolations.length > 0 && !canEnterWithoutDeck) return;
    if (myEntry && !canUpdateDeck) return;
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    setPendingMutationRefresh(null);
    resetMutationRefresh();
    try {
      let successMessage = "";
      if (myEntry) {
        await updateMyEntry({ tournamentId: id, deckItems: submittedItems, authMode, user });
        successMessage = "デッキリストを提出しました。";
      } else {
        const deckItems = submittedItems.length > 0 ? submittedItems : null;
        const createdEntry = await createEntry({ tournamentId: id, deckItems, authMode, user });
        successMessage =
          createdEntry?.isWaitlisted
            ? "キャンセル待ちとしてエントリーしました。繰り上げには当日のチェックインが必要です。"
            : deckItems
              ? "エントリーし、デッキリストを提出しました。"
              : "エントリーしました。";
      }
      if (!isCurrentRequestContext(actionContextKey)) return;
      await refreshAfterMutation({
        contextKey: actionContextKey,
        includeStandings: true,
        successMessage,
      });
    } catch (submitError) {
      if (isCurrentRequestContext(actionContextKey)) {
        setError(
          localizedActionError(
            submitError,
            "エントリー情報を更新できませんでした。もう一度お試しください。"
          )
        );
      }
    } finally {
      if (isCurrentRequestContext(actionContextKey)) setIsSubmitting(false);
    }
  };

  const requestLateEntry = async () => {
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    setPendingMutationRefresh(null);
    resetMutationRefresh();
    try {
      await createEntry({ tournamentId: id, deckItems: null, authMode, user });
      if (!isCurrentRequestContext(actionContextKey)) return;
      await refreshAfterMutation({
        contextKey: actionContextKey,
        includeStandings: true,
        successMessage: "参加申請を送信しました。",
      });
    } catch (submitError) {
      if (isCurrentRequestContext(actionContextKey)) {
        setError(
          localizedActionError(
            submitError,
            "参加申請を送信できませんでした。もう一度お試しください。"
          )
        );
      }
    } finally {
      if (isCurrentRequestContext(actionContextKey)) setIsSubmitting(false);
    }
  };

  const cancelEntry = async () => {
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    setPendingMutationRefresh(null);
    resetMutationRefresh();
    try {
      await deleteMyEntry(id, { authMode, user });
      if (!isCurrentRequestContext(actionContextKey)) return;
      await refreshAfterMutation({
        contextKey: actionContextKey,
        successMessage: "エントリーを取り消しました。",
      });
    } catch (cancelError) {
      if (isCurrentRequestContext(actionContextKey)) {
        setError(
          localizedActionError(
            cancelError,
            "エントリーを取り消せませんでした。もう一度お試しください。"
          )
        );
      }
    } finally {
      if (isCurrentRequestContext(actionContextKey)) setIsSubmitting(false);
    }
  };

  const checkInEntry = async () => {
    const actionContextKey = requestContextKey;
    if (!isCurrentRequestContext(actionContextKey)) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    setPendingMutationRefresh(null);
    resetMutationRefresh();
    try {
      await checkInMyEntry({ tournamentId: id, authMode, user });
      if (!isCurrentRequestContext(actionContextKey)) return;
      await refreshAfterMutation({
        contextKey: actionContextKey,
        successMessage: myEntry?.isWaitlisted
          ? "チェックインしました。主催者によるキャンセル待ちの繰り上げをお待ちください。"
          : "チェックインしました。",
      });
    } catch (checkInError) {
      if (isCurrentRequestContext(actionContextKey)) {
        setError(
          localizedActionError(
            checkInError,
            "チェックインできませんでした。もう一度お試しください。"
          )
        );
      }
    } finally {
      if (isCurrentRequestContext(actionContextKey)) setIsSubmitting(false);
    }
  };

  const tournamentContextMatches = tournamentContextKey === requestContextKey;
  const displayedTournamentStatus =
    isReady === false || !tournamentContextMatches
      ? ASYNC_STATUS.LOADING
      : tournamentStatus;

  if (
    displayedTournamentStatus === ASYNC_STATUS.ERROR &&
    isTournamentNotFound
  ) {
    return <NotFound />;
  }

  if (displayedTournamentStatus !== ASYNC_STATUS.SUCCESS) {
    return (
      <main className={compact ? "tournament-page compact" : "tournament-page"}>
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <AsyncState
          status={displayedTournamentStatus}
          error={tournamentError}
          idleMessage="大会情報はまだ読み込まれていません。"
          loadingMessage={isReady === false ? "認証情報を確認中..." : "大会情報を読み込み中..."}
          emptyMessage="大会情報が見つかりません。"
          errorMessage="大会情報を読み込めませんでした。"
          onRetry={loadTournament}
          className={
            displayedTournamentStatus === ASYNC_STATUS.ERROR
              ? "tournament-alert"
              : "tournament-empty"
          }
          retryButtonClassName="tournament-secondary-button"
        />
      </main>
    );
  }

  const renderOverview = () => (
    <div className="tournament-section-grid">
      <section>
        <h2>大会情報</h2>
        <dl className="tournament-definition-list">
          <div>
            <dt>主催者</dt>
            <dd>
              {tournament.createdBy?.id ? (
                <Link to={`/users/${tournament.createdBy.id}`}>
                  {tournament.createdBy.name || tournament.createdBy.id}
                </Link>
              ) : (
                tournament.createdBy?.name || "-"
              )}
            </dd>
          </div>
          <div>
            <dt>共同運営者</dt>
            <dd>
              {Array.isArray(tournament.coOrganizers) && tournament.coOrganizers.length
                ? tournament.coOrganizers.map((operator, index) => (
                    <React.Fragment key={operator.id || `${operator.name}-${index}`}>
                      {index > 0 ? "、" : ""}
                      {operator.id ? (
                        <Link to={`/users/${operator.id}`}>{operator.name || operator.id}</Link>
                      ) : (
                        operator.name || "共同運営者"
                      )}
                    </React.Fragment>
                  ))
                : "なし"}
            </dd>
          </div>
          <div>
            <dt>形式</dt>
            <dd>{tournament.format === "single_elim" ? "シングルエリミネーション" : "スイス"}</dd>
          </div>
          {tournament.format !== "single_elim" ? (
            <>
              <div>
                <dt>スイス回戦数</dt>
                <dd>{getSwissRoundSummary(tournament)}</dd>
              </div>
              <div>
                <dt>終了条件</dt>
                <dd>{getSwissEndConditionLabel(tournament)}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>開催地</dt>
            <dd>{formatVenue(tournament)}</dd>
          </div>
          <div>
            <dt>開始</dt>
            <dd>{formatDateTime(tournament.startsAt)}</dd>
          </div>
          <div>
            <dt>受付締切</dt>
            <dd>{formatDateTime(tournament.registrationClosesAt)}</dd>
          </div>
          <div>
            <dt>チェックイン開始</dt>
            <dd>
              {tournament.checkinOpensAt
                ? formatDateTime(tournament.checkinOpensAt, { monthDayOnly: true })
                : "開催日当日"}
            </dd>
          </div>
          <div>
            <dt>定員</dt>
            <dd>
              {tournament.capacity == null
                ? "なし"
                : `${activeEntryCount} / ${tournament.capacity}${waitlistedEntries.length ? `（キャンセル待ち ${waitlistedEntries.length}人）` : ""}`}
            </dd>
          </div>
          <div>
            <dt>デッキリスト</dt>
            <dd>{tournament.decklistRequired ? "必須" : "任意"}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>レギュレーション</h2>
        <dl className="tournament-definition-list">
          <div>
            <dt>名称</dt>
            <dd>{regulation.name || "-"}</dd>
          </div>
          <div>
            <dt>メイン</dt>
            <dd>{formatCardCountRange(regulation.mainMin, regulation.mainMax)}</dd>
          </div>
          <div>
            <dt>サイド</dt>
            <dd>{regulation.sideSize}枚</dd>
          </div>
          {regulationNote ? (
            <div>
              <dt>補足</dt>
              <dd>{regulationNote}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );

  const renderEntries = () => {
    if (entries.length === 0) {
      return <div className="tournament-empty">参加者はまだ登録されていません。</div>;
    }

    return (
      <div className="tournament-table-wrap">
      <table className="tournament-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>プレイヤー</th>
            <th>ステータス</th>
            <th>デッキ</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={entry.id}>
              <td className="num">{index + 1}</td>
              <td><UserNameLink entry={entry} formatParticipantName={formatParticipantName} /></td>
              <td>
                {entry.isWaitlisted && entry.status !== "dropped"
                  ? `キャンセル待ち（${waitlistPositions.get(entry.id)}番目） / ${ENTRY_STATUS_LABELS[entry.status] || entry.status}`
                  : ENTRY_STATUS_LABELS[entry.status] || entry.status}
              </td>
              <td>
                {entry.deckItems ? (
                  <>
                    提出済み（{formatDeckItemsCount(entry.deckItems)}）
                    {decklistsVisible ? (
                      <>
                        {" "}
                        <a href={`#decklist-${entry.id}`}>デッキリスト</a>
                      </>
                    ) : null}
                  </>
                ) : entry.decklistSubmittedAt ? (
                  "提出済み"
                ) : (
                  "未提出"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {decklistsVisible ? (
        <div className="tournament-decklists">
          {entries
            .filter((entry) => Array.isArray(entry.deckItems) && entry.deckItems.length > 0)
            .map((entry) => (
              <section key={entry.id} id={`decklist-${entry.id}`} className="tournament-decklist">
                <h3>
                  <UserNameLink entry={entry} formatParticipantName={formatParticipantName} /> のデッキリスト
                </h3>
                <div className="tournament-deck-summary">
                  {formatDeckItemsCount(entry.deckItems)}
                </div>
                <TournamentDeckRows items={entry.deckItems} compact={compact} />
              </section>
            ))}
        </div>
      ) : null}
      </div>
    );
  };

  const renderRounds = () => (
    <TournamentAsyncState
      status={roundsStatus}
      error={roundsError}
      idleMessage="ペアリングはまだ読み込まれていません。"
      loadingMessage="ペアリングを読み込み中..."
      emptyMessage="ペアリングはまだ作成されていません。"
      errorMessage="ペアリングを読み込めませんでした。"
      onRetry={loadRounds}
    >
      <div className="tournament-rounds">
        <RoundTabs rounds={rounds} selectedRoundNumber={pairingRoundNumber} onChange={setPairingRoundNumber} />
        {selectedPairingRound ? (
          <section className="tournament-round">
          <div className="tournament-round-header">
            <h2>
              {getRoundProgressLabel(selectedPairingRound, rounds, tournament)} / {selectedPairingRound.stage === "top_cut" ? "トップカット" : "スイス"}
            </h2>
            <span>{ROUND_STATUS_LABELS[selectedPairingRound.status] || selectedPairingRound.status}</span>
          </div>
          {selectedPairingRound.stage === "top_cut" ? (
            <Bracket rounds={rounds} entries={entries} showResults={tournament.status === "completed"} />
          ) : null}
            {(selectedPairingRound.matches || []).length > 0 ? (
              <div className="tournament-table-wrap">
                <table className="tournament-table">
              <thead>
                <tr>
                  <th className="num">卓</th>
                  <th>プレイヤー1</th>
                  <th>プレイヤー2</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches(selectedPairingRound).map((match) => {
                  const players = buildMatchPlayers(match, entries);
                  const isMyMatch =
                    myEntry &&
                    [match.player1EntryId, match.player2EntryId].some(
                      (entryId) => entryId != null && String(entryId) === String(myEntry.id)
                    );
                  return (
                    <tr key={match.id} className={isMyMatch ? "my-match" : ""}>
                      <td className="num">{match.tableNo || "-"}</td>
                      <td>
                        <UserNameLink entry={players.p1} formatParticipantName={formatParticipantName} />
                        {match.player1EntryId === myEntry?.id ? "（あなた）" : ""}
                      </td>
                      <td>
                        <UserNameLink
                          entry={players.p2}
                          formatParticipantName={formatParticipantName}
                          fallback="不戦勝"
                        />
                        {match.player2EntryId === myEntry?.id ? "（あなた）" : ""}
                      </td>
                      <td>{matchScoreLabel(match)}</td>
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            ) : (
              <div className="tournament-empty">このラウンドには対戦がありません。</div>
            )}
          </section>
        ) : null}
      </div>
    </TournamentAsyncState>
  );

  const renderResults = () => (
    <TournamentAsyncState
      status={roundsStatus}
      error={roundsError}
      idleMessage="リザルトはまだ読み込まれていません。"
      loadingMessage="リザルトを読み込み中..."
      emptyMessage="表示できるリザルトはまだありません。"
      errorMessage="リザルトを読み込めませんでした。"
      onRetry={loadRounds}
    >
      <div className="tournament-rounds">
        <RoundTabs rounds={rounds} selectedRoundNumber={resultRoundNumber} onChange={setResultRoundNumber} />
        {selectedResultRound ? (
          <section className="tournament-round">
          <div className="tournament-round-header">
            <h2>
              {getRoundProgressLabel(selectedResultRound, rounds, tournament)} / {selectedResultRound.stage === "top_cut" ? "トップカット" : "スイス"}
            </h2>
          </div>
            {(selectedResultRound.matches || []).length > 0 ? (
              <div className="tournament-table-wrap">
                <table className="tournament-table">
              <thead>
                <tr>
                  <th className="num">卓</th>
                  <th>プレイヤー1</th>
                  <th>プレイヤー2</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches(selectedResultRound).map((match) => {
                  const players = buildMatchPlayers(match, entries);
                  return (
                    <tr key={match.id}>
                      <td className="num">{match.tableNo || "-"}</td>
                      <td>
                        <UserNameLink entry={players.p1} formatParticipantName={formatParticipantName} />
                      </td>
                      <td>
                        <UserNameLink
                          entry={players.p2}
                          formatParticipantName={formatParticipantName}
                          fallback="不戦勝"
                        />
                      </td>
                      <td>{resultLabel(match.result)}</td>
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            ) : (
              <div className="tournament-empty">このラウンドには対戦結果がありません。</div>
            )}
          </section>
        ) : (
          <div className="tournament-empty">表示するラウンドを選択してください。</div>
        )}
      </div>
    </TournamentAsyncState>
  );

  const renderStandings = () => (
    <div className="tournament-rounds">
      {[ASYNC_STATUS.IDLE, ASYNC_STATUS.LOADING, ASYNC_STATUS.ERROR].includes(roundsStatus) ? (
        <TournamentAsyncState
          status={roundsStatus}
          error={roundsError}
          idleMessage="ラウンド情報はまだ読み込まれていません。"
          loadingMessage="ラウンド情報を読み込み中..."
          errorMessage="ラウンド情報を読み込めませんでした。"
          onRetry={loadRounds}
        />
      ) : null}
      {roundsStatus === ASYNC_STATUS.SUCCESS && topCutRounds.length ? (
        <section>
          <h2>トップカット</h2>
          <Bracket
            rounds={rounds}
            entries={entries}
            showResults={tournament.status === "completed"}
          />
        </section>
      ) : null}
      {roundsStatus !== ASYNC_STATUS.SUCCESS || swissRounds.length > 0 || topCutRounds.length === 0 ? (
        <section>
          {topCutRounds.length ? <h2>スイス順位表</h2> : null}
          {roundsStatus === ASYNC_STATUS.SUCCESS ? (
            <RoundTabs
              rounds={swissRounds}
              selectedRoundNumber={standingRoundNumber}
              onChange={setStandingRoundNumber}
            />
          ) : null}
          <TournamentAsyncState
            status={standingsDisplayStatus}
            error={standingsError}
            idleMessage="順位表はまだ読み込まれていません。"
            loadingMessage="順位表を読み込み中..."
            emptyMessage="順位データはまだありません。"
            errorMessage="順位表を読み込めませんでした。"
            onRetry={loadStandings}
          >
            {pointInTimeStandings.length > 0 ? (
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
                {pointInTimeStandings.map((standing) => {
                  const entry = standing.entry || findEntry(entries, standing.entryId);
                  return (
                    <tr key={standing.entryId}>
                      <td className="num">{standing.rank}</td>
                      <td>
                        <UserNameLink
                          entry={entry}
                          formatParticipantName={formatParticipantName}
                          fallback={standing.entryId}
                        />
                      </td>
                      <td className="num">{standing.wins}</td>
                      <td className="num">{standing.losses}</td>
                      <td className="num">{standing.draws}</td>
                      <td className="num">{standing.points}</td>
                      <td className="num">
                        {Math.round(Number(standing.omwPercent || 0) * 1000) / 10}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            ) : (
              <div className="tournament-empty">順位データはまだありません。</div>
            )}
          </TournamentAsyncState>
        </section>
      ) : null}
    </div>
  );

  const renderActiveTab = () => {
    if (activeTab === "entries") return renderEntries();
    if (activeTab === "rounds") return renderRounds();
    if (activeTab === "results") return renderResults();
    if (activeTab === "standings") return renderStandings();
    return renderOverview();
  };
  const myStatusNeedsRounds = ["in_progress", "completed"].includes(tournament.status);
  const canRenderMyStatus =
    !myStatusNeedsRounds ||
    roundsStatus === ASYNC_STATUS.EMPTY ||
    roundsStatus === ASYNC_STATUS.SUCCESS;

  return (
    <main className={compact ? "tournament-page compact" : "tournament-page"}>
      <Link to="/tournaments" className="tournament-back-link">
        大会一覧へ
      </Link>
      <div className="tournament-detail-header">
        <div>
          <p className="tournament-eyebrow">{STATUS_LABELS[tournament.status] || tournament.status}</p>
          <h1>{tournament.title}</h1>
          <p>開催地 {formatVenue(tournament)} / 開始 {formatDateTime(tournament.startsAt)}</p>
          <p>{tournament.description || "説明はありません。"}</p>
        </div>
        <div className="tournament-detail-badges">
          <div className="tournament-header-actions">
            <div className={`tournament-status ${tournament.status}`}>
              {STATUS_LABELS[tournament.status] || tournament.status}
            </div>
            {permissions.canManage ? (
              <Link className="tournament-create-link" to={`/tournaments/${id}/manage`}>
                大会管理
              </Link>
            ) : null}
          </div>
          {tournament.isListed === false ? (
            <div className="tournament-status unlisted">ローカル大会（非掲載）</div>
          ) : null}
        </div>
      </div>

      {tournament.isListed === false ? (
        <div className="tournament-unlisted-notice" role="status">
          この大会は一覧に表示されません。大会URLを共有された人が通常どおり参加できます。
        </div>
      ) : null}

      {tournament.announcement ? (
        <section className="tournament-announcement-band">
          <MegaphoneIcon title="アナウンス" />
          <div>
            <p className="tournament-eyebrow">アナウンス</p>
            <p>{tournament.announcement}</p>
          </div>
        </section>
      ) : null}

      {[ASYNC_STATUS.LOADING, ASYNC_STATUS.ERROR].includes(mutationRefreshStatus) ? (
        <TournamentAsyncState
          status={mutationRefreshStatus}
          error={mutationRefreshError}
          loadingMessage="最新の参加状態を確認中..."
          errorMessage="操作は完了しましたが、最新の参加状態を確認できませんでした。"
          onRetry={retryMutationRefresh}
        />
      ) : null}

      {canRenderMyStatus ? (
        <TournamentMyStatus
          tournament={tournament}
          myEntry={myEntry}
          entries={entries}
          rounds={rounds}
          isAuthenticated={isAuthenticated}
          canRegister={canRegister}
          canUpdateDeck={canUpdateDeck}
          canLateEntry={canLateEntry}
          canCancel={canCancel}
          deckSource={deckSource}
          onDeckSourceChange={setDeckSource}
          selectedDeckId={selectedDeckId}
          onSelectedDeckChange={setSelectedDeckId}
          savedDecks={savedDecks}
          savedDecksStatus={savedDecksStatus}
          savedDecksError={savedDecksError}
          onRetrySavedDecks={loadSavedDecks}
          submittedItems={submittedItems}
          deckViolations={deckViolations}
          onSubmitEntry={submitEntry}
          onRequestLateEntry={requestLateEntry}
          onCancelEntry={cancelEntry}
          onCheckIn={checkInEntry}
          submitDisabled={submitDisabled}
          isSubmitting={isSubmitting || entryMutationStateUnconfirmed}
          formatParticipantName={formatParticipantName}
        />
      ) : (
        <TournamentAsyncState
          status={roundsStatus}
          error={roundsError}
          idleMessage="マイステータスはラウンド情報の読み込み後に表示します。"
          loadingMessage="マイステータスを読み込み中..."
          errorMessage="マイステータスに必要なラウンド情報を読み込めませんでした。"
          onRetry={loadRounds}
        />
      )}

      {message ? <div className="tournament-success">{message}</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}

      <div className="tournament-tabs" aria-label="大会詳細">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section className="tournament-tab-panel">{renderActiveTab()}</section>
    </main>
  );
}
