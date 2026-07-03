import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDeck } from "../context/DeckContext";
import { fetchSavedDecks } from "../services/savedDecks";
import {
  createEntry,
  deleteMyEntry,
  fetchRounds,
  fetchStandings,
  fetchTournament,
  updateMyEntry,
} from "../services/tournaments";
import "./Tournaments.css";

const TABS = [
  { id: "overview", label: "概要" },
  { id: "entries", label: "参加者" },
  { id: "rounds", label: "ペアリング" },
  { id: "standings", label: "順位表" },
];

const STATUS_LABELS = {
  registration: "受付中",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "中止",
  draft: "下書き",
};

const ROUND_STATUS_LABELS = {
  in_progress: "進行中",
  completed: "完了",
};

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

function resultLabel(result) {
  if (result === "p1_win") return "P1勝利";
  if (result === "p2_win") return "P2勝利";
  if (result === "draw") return "引き分け";
  if (result === "bye") return "不戦勝";
  return "未報告";
}

export default function TournamentDetail({ compact = false }) {
  const { id } = useParams();
  const { authMode, isAuthenticated, user } = useAuth();
  const currentDeck = useDeck();
  const [activeTab, setActiveTab] = useState("overview");
  const [tournament, setTournament] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState([]);
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
        fetchRounds(id, { authMode }),
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
  const needsDeck = Boolean(tournament?.decklistRequired);
  const hasDeckForSubmit = submittedItems.length > 0;

  const submitDisabled =
    isSubmitting || !isAuthenticated || (needsDeck && !hasDeckForSubmit) || (!canRegister && !canUpdateDeck);

  const submitEntry = async () => {
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
            <dd>{tournament.regulation?.name || "-"}</dd>
          </div>
          <div>
            <dt>メイン</dt>
            <dd>
              {tournament.regulation?.mainMin} - {tournament.regulation?.mainMax}
            </dd>
          </div>
          <div>
            <dt>サイド</dt>
            <dd>{tournament.regulation?.sideSize}</dd>
          </div>
          <div>
            <dt>同名上限</dt>
            <dd>{tournament.regulation?.maxCopies}</dd>
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
                {entry.deckItems
                  ? `提出済み (${countCards(entry.deckItems, "main")} / ${countCards(entry.deckItems, "side")})`
                  : entry.decklistSubmittedAt
                    ? "提出済み"
                    : "未提出"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRounds = () => (
    <div className="tournament-rounds">
      {rounds.length === 0 ? <div className="tournament-empty">ペアリングはまだありません。</div> : null}
      {rounds.map((round) => (
        <section key={round.id} className="tournament-round">
          <div className="tournament-round-header">
            <h2>
              第{round.number}回戦 / {round.stage === "top_cut" ? "トップカット" : "スイス"}
            </h2>
            <span>{ROUND_STATUS_LABELS[round.status] || round.status}</span>
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
                {(round.matches || []).map((match) => {
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
      ))}
    </div>
  );

  const renderStandings = () => (
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
          {standings.map((standing) => {
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
  );

  const renderActiveTab = () => {
    if (activeTab === "entries") return renderEntries();
    if (activeTab === "rounds") return renderRounds();
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
          <p>{tournament.description || "説明はありません。"}</p>
        </div>
        <div className={`tournament-status ${tournament.status}`}>
          {STATUS_LABELS[tournament.status] || tournament.status}
        </div>
      </div>

      <section className="tournament-entry-panel">
        <div>
          <h2>{myEntry ? "参加中" : "エントリー"}</h2>
          <p>
            {isAuthenticated
              ? tournament.decklistRequired
                ? "保存デッキまたは現在のデッキを選んで提出してください。"
                : "デッキ提出は任意です。"
              : "ログイン後にエントリーできます。"}
          </p>
        </div>
        {isAuthenticated ? (
          <div className="tournament-entry-controls">
            <label>
              提出元
              <select value={deckSource} onChange={(event) => setDeckSource(event.target.value)}>
                <option value="current">現在のデッキ</option>
                <option value="saved">保存デッキ</option>
              </select>
            </label>
            {deckSource === "saved" ? (
              <label>
                保存デッキ
                <select
                  value={selectedDeckId}
                  onChange={(event) => setSelectedDeckId(event.target.value)}
                >
                  <option value="">選択してください</option>
                  {savedDecks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="tournament-deck-summary">
              メイン {countCards(submittedItems, "main")} / サイド {countCards(submittedItems, "side")}
            </div>
            <div className="tournament-entry-actions">
              <button type="button" onClick={submitEntry} disabled={submitDisabled}>
                {myEntry ? "デッキ提出/更新" : "エントリー"}
              </button>
              <button type="button" onClick={cancelEntry} disabled={!canCancel || isSubmitting}>
                取消
              </button>
            </div>
            {!canRegister && !myEntry ? <p className="tournament-muted">現在受付できません。</p> : null}
            {myEntry && !canUpdateDeck ? (
              <p className="tournament-muted">デッキリストの変更受付は終了しています。</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {message ? <div className="tournament-success">{message}</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}

      <div className="tournament-tabs" aria-label="大会詳細">
        {TABS.map((tab) => (
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
