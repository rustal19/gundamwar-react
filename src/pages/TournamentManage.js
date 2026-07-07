import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  completeRound,
  createNextRound,
  createTournament,
  fetchEntries,
  fetchRounds,
  fetchStandings,
  fetchTournament,
  reportMatchResult,
  updateEntryStatus,
  updateTournament,
} from "../services/tournaments";
import { TOURNAMENT_STATUS_LABELS as STATUS_LABELS } from "../data/statusLabels";
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
  decklistRequired: false,
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

const ENTRY_STATUS_LABELS = {
  registered: "登録済み",
  checked_in: "チェックイン",
  dropped: "ドロップ",
};

const RESULT_LABELS = {
  "": "未報告",
  p1_win: "P1勝利",
  p2_win: "P2勝利",
  draw: "引き分け",
  bye: "不戦勝",
};

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
    regulation: {
      ...DEFAULT_FORM.regulation,
      ...(tournament.regulation || {}),
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
    decklistRequired: Boolean(form.decklistRequired),
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

function findEntry(entries, entryId) {
  return entries.find((entry) => entry.id === entryId) || null;
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
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId]
  );

  const loadAll = useCallback(async () => {
    if (isNew || !isOrganizer) return;
    setIsLoading(true);
    setError("");
    try {
      const [tournament, entryPayload, roundPayload, standingPayload] = await Promise.all([
        fetchTournament(id, { authMode, user }),
        fetchEntries(id, { authMode }),
        fetchRounds(id, { authMode }),
        fetchStandings(id, { authMode }),
      ]);
      const nextForm = formFromTournament(tournament);
      nextForm.regulation.bannedCardsText = listToText(nextForm.regulation.bannedCards);
      nextForm.regulation.limitedCardsText = listToText(nextForm.regulation.limitedCards);
      nextForm.regulation.allowedSetsText = listToText(nextForm.regulation.allowedSets);
      setForm(nextForm);
      setEntries(entryPayload.items || []);
      setRounds(roundPayload.rounds || []);
      setStandings(standingPayload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [authMode, id, isNew, isOrganizer, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setRegulationField = (field, value) => {
    setForm((current) => ({
      ...current,
      regulation: { ...current.regulation, [field]: value },
    }));
  };

  const saveTournament = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = payloadFromForm(form);
      if (isNew) {
        const created = await createTournament({ ...payload, authMode, user });
        setMessage("大会を作成しました。");
        navigate(`/tournaments/${created.id}/manage`, { replace: true });
      } else {
        const updated = await updateTournament({ id, ...payload, authMode, user });
        setForm(formFromTournament(updated));
        setMessage("大会を保存しました。");
        await loadAll();
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async (status) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateTournament({ id, status, authMode, user });
      setForm(formFromTournament(updated));
      setMessage("ステータスを更新しました。");
      await loadAll();
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeEntryStatus = async (entryId, status) => {
    setError("");
    setMessage("");
    try {
      await updateEntryStatus({ tournamentId: id, entryId, status, authMode });
      setMessage("参加者ステータスを更新しました。");
      await loadAll();
    } catch (entryError) {
      setError(entryError.message);
    }
  };

  const generateRound = async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await createNextRound(id, { authMode });
      setMessage("次ラウンドを生成しました。");
      await loadAll();
    } catch (roundError) {
      setError(roundError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMatchResult = async (matchId, result) => {
    setError("");
    setMessage("");
    try {
      await reportMatchResult({ matchId, result: result || null, authMode });
      await loadAll();
    } catch (matchError) {
      setError(matchError.message);
    }
  };

  const finishRound = async (roundId) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await completeRound(roundId, { authMode });
      setMessage("ラウンドを完了しました。");
      await loadAll();
    } catch (roundError) {
      setError(roundError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <main className={compact ? "tournament-page compact" : "tournament-page"}>
      <Link to="/tournaments" className="tournament-back-link">
        大会一覧へ
      </Link>
      <div className="tournament-page-header">
        <div>
          <p className="tournament-eyebrow">Organizer Console</p>
          <h1>{isNew ? "大会を作成" : "大会管理"}</h1>
        </div>
        {!isNew ? <span className={`tournament-status ${form.status}`}>{STATUS_LABELS[form.status]}</span> : null}
      </div>

      {isLoading ? <div className="tournament-muted">読み込み中...</div> : null}
      {message ? <div className="tournament-success">{message}</div> : null}
      {error ? <div className="tournament-alert">{error}</div> : null}

      <form className="tournament-manage-form" onSubmit={saveTournament}>
        <section className="tournament-tab-panel">
          <h2>大会情報</h2>
          <div className="tournament-form-grid">
            <label>
              タイトル
              <input value={form.title} onChange={(event) => setField("title", event.target.value)} required />
            </label>
            <label>
              形式
              <select value={form.format} onChange={(event) => setField("format", event.target.value)}>
                <option value="swiss">スイス</option>
                <option value="single_elim">シングルエリミネーション</option>
              </select>
            </label>
            <label>
              スイス回数
              <input
                type="number"
                min="1"
                value={form.swissRounds}
                placeholder="自動"
                onChange={(event) => setField("swissRounds", event.target.value)}
              />
            </label>
            <label>
              トップカット
              <input
                type="number"
                min="2"
                value={form.topCutSize}
                placeholder="なし"
                onChange={(event) => setField("topCutSize", event.target.value)}
              />
            </label>
            <label>
              開始日時
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setField("startsAt", event.target.value)}
              />
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
              定員
              <input
                type="number"
                min="1"
                value={form.capacity}
                placeholder="無制限"
                onChange={(event) => setField("capacity", event.target.value)}
              />
            </label>
            <label>
              ステータス
              <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tournament-checkbox">
              <input
                type="checkbox"
                checked={form.decklistRequired}
                onChange={(event) => setField("decklistRequired", event.target.checked)}
              />
              デッキリスト必須
            </label>
            <label className="tournament-form-wide">
              説明
              <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />
            </label>
          </div>
        </section>

        <section className="tournament-tab-panel">
          <h2>レギュレーション</h2>
          <div className="tournament-form-grid">
            <label>
              名称
              <input
                value={form.regulation.name}
                onChange={(event) => setRegulationField("name", event.target.value)}
              />
            </label>
            <label>
              メイン下限
              <input
                type="number"
                value={form.regulation.mainMin}
                onChange={(event) => setRegulationField("mainMin", event.target.value)}
              />
            </label>
            <label>
              メイン上限
              <input
                type="number"
                value={form.regulation.mainMax}
                onChange={(event) => setRegulationField("mainMax", event.target.value)}
              />
            </label>
            <label>
              サイド枚数
              <input
                type="number"
                value={form.regulation.sideSize}
                onChange={(event) => setRegulationField("sideSize", event.target.value)}
              />
            </label>
            <label>
              同名上限
              <input
                type="number"
                value={form.regulation.maxCopies}
                onChange={(event) => setRegulationField("maxCopies", event.target.value)}
              />
            </label>
            <label>
              使用可能セット
              <textarea
                value={form.regulation.allowedSetsText ?? listToText(form.regulation.allowedSets)}
                onChange={(event) => setRegulationField("allowedSetsText", event.target.value)}
              />
            </label>
            <label>
              禁止カード
              <textarea
                value={form.regulation.bannedCardsText ?? listToText(form.regulation.bannedCards)}
                onChange={(event) => setRegulationField("bannedCardsText", event.target.value)}
              />
            </label>
            <label>
              制限カード
              <textarea
                value={form.regulation.limitedCardsText ?? listToText(form.regulation.limitedCards)}
                onChange={(event) => setRegulationField("limitedCardsText", event.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="tournament-entry-actions tournament-manage-actions">
          <button type="submit" disabled={isSubmitting}>
            {isNew ? "作成" : "保存"}
          </button>
          {!isNew ? (
            <>
              <button type="button" disabled={isSubmitting || form.status !== "draft"} onClick={() => changeStatus("registration")}>
                受付開始
              </button>
              <button type="button" disabled={isSubmitting || form.status !== "registration"} onClick={() => changeStatus("in_progress")}>
                進行開始
              </button>
              <button type="button" disabled={isSubmitting || form.status !== "in_progress"} onClick={() => changeStatus("completed")}>
                完了
              </button>
            </>
          ) : null}
        </div>
      </form>

      {!isNew ? (
        <>
          <section className="tournament-tab-panel">
            <div className="tournament-round-header">
              <h2>参加者</h2>
              <span>{entries.length} 名</span>
            </div>
            <div className="tournament-table-wrap">
              <table className="tournament-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>プレイヤー</th>
                    <th>状態</th>
                    <th>デッキ</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td>{index + 1}</td>
                      <td>{entry.user?.name || "-"}</td>
                      <td>{ENTRY_STATUS_LABELS[entry.status] || entry.status}</td>
                      <td>
                        {entry.deckItems
                          ? `提出済み (${countCards(entry.deckItems, "main")} / ${countCards(entry.deckItems, "side")})`
                          : "未提出"}
                      </td>
                      <td className="tournament-row-actions">
                        <button type="button" onClick={() => setSelectedEntryId(entry.id)}>
                          閲覧
                        </button>
                        <button type="button" onClick={() => changeEntryStatus(entry.id, "checked_in")}>
                          チェックイン
                        </button>
                        <button type="button" onClick={() => changeEntryStatus(entry.id, "dropped")}>
                          ドロップ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedEntry ? (
              <div className="tournament-deck-viewer">
                <div className="tournament-round-header">
                  <h3>{selectedEntry.user?.name || "-"} のデッキリスト</h3>
                  <button type="button" onClick={() => setSelectedEntryId("")}>
                    閉じる
                  </button>
                </div>
                {selectedEntry.deckItems?.length ? (
                  <table className="tournament-table">
                    <tbody>
                      {selectedEntry.deckItems.map((item, index) => (
                        <tr key={`${item.cardId || item.card?.name}-${index}`}>
                          <td>{item.zone || "main"}</td>
                          <td>{item.card?.name || item.cardId}</td>
                          <td>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="tournament-muted">デッキリストは提出されていません。</div>
                )}
              </div>
            ) : null}
          </section>

          <section className="tournament-tab-panel">
            <div className="tournament-round-header">
              <h2>ラウンド管理</h2>
              <button type="button" onClick={generateRound} disabled={isSubmitting}>
                次ラウンド生成
              </button>
            </div>
            <div className="tournament-rounds">
              {rounds.map((round) => (
                <section key={round.id} className="tournament-round">
                  <div className="tournament-round-header">
                    <h3>
                      Round {round.number} / {round.stage === "top_cut" ? "トップカット" : "スイス"}
                    </h3>
                    <button
                      type="button"
                      disabled={round.status === "completed" || isSubmitting}
                      onClick={() => finishRound(round.id)}
                    >
                      ラウンド完了
                    </button>
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
                          const p1 = findEntry(entries, match.player1EntryId);
                          const p2 = findEntry(entries, match.player2EntryId);
                          return (
                            <tr key={match.id}>
                              <td>{match.tableNo}</td>
                              <td>{p1?.user?.name || match.player1EntryId}</td>
                              <td>{p2?.user?.name || "不戦勝"}</td>
                              <td>
                                <select
                                  value={match.result || ""}
                                  onChange={(event) => changeMatchResult(match.id, event.target.value)}
                                  disabled={round.status === "completed"}
                                >
                                  {Object.entries(RESULT_LABELS).map(([value, label]) => (
                                    <option key={value || "none"} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="tournament-tab-panel">
            <h2>順位表</h2>
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
          </section>
        </>
      ) : null}
    </main>
  );
}
