import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDeck } from "../context/DeckContext";
import { fetchSavedDecks } from "../services/savedDecks";
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
  updateMyEntry,
} from "../services/tournaments";
import {
  ROUND_STATUS_LABELS,
  TOURNAMENT_STATUS_LABELS as STATUS_LABELS,
} from "../data/statusLabels";
import { defaultRegulation, validateDeck } from "../utils/deckValidation";
import { computeStandings } from "../utils/tournament/standings";
import "./Tournaments.css";

const BASE_TABS = [
  { id: "overview", label: "概要" },
  { id: "entries", label: "参加者" },
  { id: "rounds", label: "ペアリング" },
  { id: "results", label: "リザルト" },
  { id: "standings", label: "順位表" },
];


function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
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

function countCards(items, zone) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => !zone || item.zone === zone)
    .reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function findEntry(entries, entryId) {
  return entries.find((entry) => entry.id === entryId) || null;
}

function buildMatchLabel(match, entries) {
  const p1 = findEntry(entries, match.player1EntryId);
  const p2 = match.player2EntryId == null ? null : findEntry(entries, match.player2EntryId);
  return {
    p1Name: p1?.user?.name || "-",
    p2Name: p2?.user?.name || "不戦勝",
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

function TournamentDeckRows({ items, compact }) {
  return (
    <table className="tournament-table tournament-decklist-table">
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
              <td>{item.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function TournamentDetail({ compact = false }) {
  const { id } = useParams();
  const { authMode, isAuthenticated, user } = useAuth();
  const currentDeck = useDeck();
  const [activeTab, setActiveTab] = useState("overview");
  const [tournament, setTournament] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState([]);
  const [pairingRoundNumber, setPairingRoundNumber] = useState(null);
  const [resultRoundNumber, setResultRoundNumber] = useState(null);
  const [standingRoundNumber, setStandingRoundNumber] = useState(null);
  const [savedDecks, setSavedDecks] = useState([]);
  const [deckSource, setDeckSource] = useState("current");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTournament = useCallback(async () => {
    const nextTournament = await fetchTournament(id, { authMode, user });
    setTournament(nextTournament);
    return nextTournament;
  }, [authMode, id, user]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextTournament, nextRounds, nextStandings] = await Promise.all([
        fetchTournament(id, { authMode, user }),
        fetchRounds(id, { authMode, user }),
        fetchStandings(id, { authMode }),
      ]);
      setTournament(nextTournament);
      setRounds(nextRounds.rounds || []);
      setStandings(nextStandings.items || nextStandings.standings || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [authMode, id, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSavedDecks([]);
      return;
    }
    let cancelled = false;
    fetchSavedDecks({ authMode, user })
      .then((decks) => {
        if (!cancelled) setSavedDecks(decks);
      })
      .catch(() => {
        if (!cancelled) setSavedDecks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authMode, isAuthenticated, user]);

  const entries = tournament?.entries || [];
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
    if (tournament?.myEntry) return tournament.myEntry;
    if (!user?.id) return null;
    return entries.find((entry) => entry.user?.id === String(user.id)) || null;
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
  const deckViolations = useMemo(() => {
    if (!submittedItems.length) return [];
    return validateDeck(submittedItems, regulation);
  }, [regulation, submittedItems]);

  const canRegister = Boolean(
    tournament &&
      tournament.status === "registration" &&
      isBefore(tournament.registrationClosesAt) &&
      (tournament.capacity == null || entries.length < tournament.capacity)
  );
  const canUpdateDeck = Boolean(
    tournament &&
      ["registration", "in_progress"].includes(tournament.status) &&
      isBefore(tournament.registrationClosesAt) &&
      myEntry
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
  const pointInTimeStandings = useMemo(() => {
    if (!selectedStandingRound) return standings;
    const matches = rounds
      .filter((round) => Number(round.number) <= Number(selectedStandingRound.number))
      .flatMap((round) => round.matches || []);
    return computeStandings(entries, matches).map((standing) => ({
      ...standing,
      entry: findEntry(entries, standing.entryId),
    }));
  }, [entries, rounds, selectedStandingRound, standings]);

  const submitDisabled =
    isSubmitting ||
    !isAuthenticated ||
    deckViolations.length > 0 ||
    (!canRegister && !canUpdateDeck);

  const submitEntry = async () => {
    if (deckViolations.length > 0) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (myEntry) {
        await updateMyEntry({ tournamentId: id, deckItems: submittedItems, authMode, user });
        setMessage("デッキリストを提出しました。");
      } else {
        await createEntry({ tournamentId: id, deckItems: submittedItems, authMode, user });
        setMessage("エントリーしました。");
      }
      await loadTournament();
      const nextStandings = await fetchStandings(id, { authMode });
      setStandings(nextStandings.items || nextStandings.standings || []);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEntry = async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await deleteMyEntry(id, { authMode, user });
      setMessage("エントリーを取り消しました。");
      await loadTournament();
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkInEntry = async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await checkInMyEntry({ tournamentId: id, authMode, user });
      setMessage("チェックインしました。");
      await loadTournament();
    } catch (checkInError) {
      setError(checkInError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !tournament) {
    return <main className="tournament-page">読み込み中...</main>;
  }

  if (!tournament) {
    return (
      <main className="tournament-page">
        <Link to="/tournaments" className="tournament-back-link">
          大会一覧へ
        </Link>
        <div className="tournament-alert">{error || "大会が見つかりません。"}</div>
      </main>
    );
  }

  const renderOverview = () => (
    <div className="tournament-section-grid">
      <section>
        <h2>大会情報</h2>
        <dl className="tournament-definition-list">
          <div>
            <dt>形式</dt>
            <dd>{tournament.format === "single_elim" ? "シングルエリミネーション" : "スイス"}</dd>
          </div>
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
            <dt>定員</dt>
            <dd>{tournament.capacity == null ? "なし" : `${entries.length} / ${tournament.capacity}`}</dd>
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
            <dd>
              {regulation.mainMin} - {regulation.mainMax}
            </dd>
          </div>
          <div>
            <dt>サイド</dt>
            <dd>{regulation.sideSize}</dd>
          </div>
          <div>
            <dt>同名上限</dt>
            <dd>{regulation.maxCopies}</dd>
          </div>
        </dl>
      </section>
    </div>
  );

  const renderEntries = () => (
    <div className="tournament-table-wrap">
      <table className="tournament-table">
        <thead>
          <tr>
            <th>#</th>
            <th>プレイヤー</th>
            <th>ステータス</th>
            <th>デッキ</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={entry.id}>
              <td>{index + 1}</td>
              <td>{entry.user?.name || "-"}</td>
              <td>{entry.status}</td>
              <td>
                {entry.deckItems ? (
                  <>
                    提出済み ({countCards(entry.deckItems, "main")} / {countCards(entry.deckItems, "side")})
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
                <h3>{entry.user?.name || "-"} のデッキリスト</h3>
                <div className="tournament-deck-summary">
                  メイン {countCards(entry.deckItems, "main")} / サイド {countCards(entry.deckItems, "side")}
                </div>
                <TournamentDeckRows items={entry.deckItems} compact={compact} />
              </section>
            ))}
        </div>
      ) : null}
    </div>
  );

  const renderRounds = () => (
    <div className="tournament-rounds">
      {rounds.length === 0 ? <div className="tournament-empty">ペアリングはまだありません。</div> : null}
      <RoundTabs rounds={rounds} selectedRoundNumber={pairingRoundNumber} onChange={setPairingRoundNumber} />
      {selectedPairingRound ? (
        <section className="tournament-round">
          <div className="tournament-round-header">
            <h2>
              第{selectedPairingRound.number}回戦 / {selectedPairingRound.stage === "top_cut" ? "トップカット" : "スイス"}
            </h2>
            <span>{ROUND_STATUS_LABELS[selectedPairingRound.status] || selectedPairingRound.status}</span>
          </div>
          {selectedPairingRound.stage === "top_cut" ? (
            <Bracket rounds={rounds} entries={entries} showResults={tournament.status === "completed"} />
          ) : null}
          <div className="tournament-table-wrap">
            <table className="tournament-table">
              <thead>
                <tr>
                  <th>卓</th>
                  <th>プレイヤー1</th>
                  <th>プレイヤー2</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches(selectedPairingRound).map((match) => {
                  const labels = buildMatchLabel(match, entries);
                  const isMyMatch =
                    myEntry &&
                    [match.player1EntryId, match.player2EntryId].some(
                      (entryId) => entryId != null && String(entryId) === String(myEntry.id)
                    );
                  return (
                    <tr key={match.id} className={isMyMatch ? "my-match" : ""}>
                      <td>{match.tableNo || "-"}</td>
                      <td>{labels.p1Name}{match.player1EntryId === myEntry?.id ? "（あなた）" : ""}</td>
                      <td>{labels.p2Name}{match.player2EntryId === myEntry?.id ? "（あなた）" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );

  const renderResults = () => (
    <div className="tournament-rounds">
      <RoundTabs rounds={rounds} selectedRoundNumber={resultRoundNumber} onChange={setResultRoundNumber} />
      {selectedResultRound ? (
        <section className="tournament-round">
          <div className="tournament-round-header">
            <h2>
              第{selectedResultRound.number}回戦 / {selectedResultRound.stage === "top_cut" ? "トップカット" : "スイス"}
            </h2>
          </div>
          <div className="tournament-table-wrap">
            <table className="tournament-table">
              <thead>
                <tr>
                  <th>卓</th>
                  <th>プレイヤー1</th>
                  <th>プレイヤー2</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches(selectedResultRound).map((match) => {
                  const labels = buildMatchLabel(match, entries);
                  return (
                    <tr key={match.id}>
                      <td>{match.tableNo || "-"}</td>
                      <td>{labels.p1Name}</td>
                      <td>{labels.p2Name}</td>
                      <td>{resultLabel(match.result)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="tournament-empty">リザルトはまだありません。</div>
      )}
    </div>
  );

  const renderStandings = () => (
    <div>
      <RoundTabs rounds={rounds} selectedRoundNumber={standingRoundNumber} onChange={setStandingRoundNumber} />
      <div className="tournament-table-wrap">
        <table className="tournament-table">
          <thead>
            <tr>
              <th>順位</th>
              <th>プレイヤー</th>
              <th>勝</th>
              <th>敗</th>
              <th>分</th>
              <th>勝点</th>
              <th>OMW%</th>
            </tr>
          </thead>
          <tbody>
            {pointInTimeStandings.map((standing) => {
              const entry = standing.entry || findEntry(entries, standing.entryId);
              return (
                <tr key={standing.entryId}>
                  <td>{standing.rank}</td>
                  <td>{entry?.user?.name || standing.entryId}</td>
                  <td>{standing.wins}</td>
                  <td>{standing.losses}</td>
                  <td>{standing.draws}</td>
                  <td>{standing.points}</td>
                  <td>{Math.round(Number(standing.omwPercent || 0) * 1000) / 10}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    if (activeTab === "entries") return renderEntries();
    if (activeTab === "rounds") return renderRounds();
    if (activeTab === "results") return renderResults();
    if (activeTab === "standings") return renderStandings();
    return renderOverview();
  };

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
        <div className={`tournament-status ${tournament.status}`}>
          {STATUS_LABELS[tournament.status] || tournament.status}
        </div>
      </div>

      {tournament.announcement ? (
        <section className="tournament-announcement-band">
          <MegaphoneIcon title="アナウンス" />
          <div>
            <p className="tournament-eyebrow">アナウンス</p>
            <p>{tournament.announcement}</p>
          </div>
        </section>
      ) : null}

      <TournamentMyStatus
        tournament={tournament}
        myEntry={myEntry}
        entries={entries}
        rounds={rounds}
        isAuthenticated={isAuthenticated}
        canRegister={canRegister}
        canUpdateDeck={canUpdateDeck}
        canCancel={canCancel}
        deckSource={deckSource}
        onDeckSourceChange={setDeckSource}
        selectedDeckId={selectedDeckId}
        onSelectedDeckChange={setSelectedDeckId}
        savedDecks={savedDecks}
        submittedItems={submittedItems}
        deckViolations={deckViolations}
        onSubmitEntry={submitEntry}
        onCancelEntry={cancelEntry}
        onCheckIn={checkInEntry}
        submitDisabled={submitDisabled}
        isSubmitting={isSubmitting}
      />

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
