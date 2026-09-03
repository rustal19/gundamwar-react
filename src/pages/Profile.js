import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AsyncState from "../components/AsyncState";
import GoogleSignInPanel from "../components/GoogleSignInPanel";
import { useAuth, validateNickname } from "../context/AuthContext";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchMyTournaments, fetchRounds, fetchStandings } from "../services/tournaments";
import { DECKLIST_STATE_LABELS, ENTRY_STATUS_LABELS } from "../data/statusLabels";
import { computeUserResults, formatRecord } from "../utils/userResults";
import "./Profile.css";

function displayName(user) {
  return user?.nickname || user?.displayNickname || user?.name || "プレイヤー";
}

function initialsFor(user) {
  const source = displayName(user).trim();
  return source ? source.slice(0, 2).toUpperCase() : "GW";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}

function findCurrentTable(rounds, entryId) {
  const activeRound = (rounds || [])
    .slice()
    .sort((left, right) => Number(right.number || 0) - Number(left.number || 0))
    .find((round) => round.status === "in_progress" || round.status === "completed");
  const match = (activeRound?.matches || []).find((item) =>
    [item.player1EntryId, item.player2EntryId].some(
      (matchEntryId) => matchEntryId != null && String(matchEntryId) === String(entryId)
    )
  );
  return match?.tableNo || null;
}

// 主催しているだけの大会は entry が null で返る。参加大会と同じ「参加予定」
// などに混ぜると、参加していない大会に参加しているように見えるので分ける。
function groupMyTournaments(items) {
  const managedOnly = items.filter(({ entry }) => !entry);
  const joined = items.filter(({ entry }) => Boolean(entry));
  return {
    managed: managedOnly,
    upcoming: joined.filter(({ tournament }) => tournament.status === "registration"),
    active: joined.filter(({ tournament }) => tournament.status === "in_progress"),
    past: joined.filter(({ tournament }) => ["completed", "cancelled"].includes(tournament.status)),
  };
}

const PROFILE_DECKLIST_STATE_LABELS = {
  ...DECKLIST_STATE_LABELS,
  none: "未提出・提出してください",
  submitted: "提出済み・差し替え可",
  locked: "ロック中・修正は主催者へ",
  revealed: "公開中・差し替え不可",
};

function TournamentGroup({ title, items, emptyText }) {
  return (
    <section className="profile-list-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="profile-empty">{emptyText}</p>
      ) : (
        <div className="profile-tournament-list">
          {items.map(({ tournament, entry, rounds }) => {
            const tableNo = tournament.status === "in_progress" && entry
              ? findCurrentTable(rounds, entry.id)
              : null;
            const decklistState = entry?.decklistState;
            return (
              <Link key={tournament.id} to={`/tournaments/${tournament.id}`} className="profile-tournament-row">
                <div>
                  <strong>{tournament.title}</strong>
                  <span>
                    {formatDate(tournament.startsAt)}
                    {entry ? ` / ${ENTRY_STATUS_LABELS[entry.status] || entry.status}` : ""}
                  </span>
                </div>
                <div className="profile-row-meta">
                  {decklistState ? (
                    <span className={`profile-badge deck-${decklistState}`}>
                      {decklistState === "none" && entry?.deckLockedAt
                        ? DECKLIST_STATE_LABELS.none
                        : PROFILE_DECKLIST_STATE_LABELS[decklistState] || decklistState}
                    </span>
                  ) : null}
                  {decklistState === "none" && entry?.deckLockedAt ? (
                    <span className="profile-badge deck-locked">ロック中・修正は主催者へ</span>
                  ) : null}
                  {tableNo ? <span className="profile-badge soft">卓 {tableNo}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Profile({ compact = false }) {
  const { authMode, isAuthenticated, isReady, updateProfile, user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const tournamentRequestIdRef = useRef(0);
  const publicDeckRequestIdRef = useRef(0);
  const {
    status: tournamentStatus,
    data: myTournaments,
    error: tournamentError,
    start: startTournamentLoad,
    succeed: succeedTournamentLoad,
    fail: failTournamentLoad,
    reset: resetTournamentLoad,
  } = useAsyncResource([]);
  const {
    status: publicDeckStatus,
    data: publicDecks,
    error: publicDeckError,
    start: startPublicDeckLoad,
    succeed: succeedPublicDeckLoad,
    fail: failPublicDeckLoad,
    reset: resetPublicDeckLoad,
  } = useAsyncResource([]);

  useEffect(() => {
    setNickname(user?.nickname || "");
    setMessage("");
    setErrorMessage("");
  }, [user?.nickname]);

  const loadTournaments = useCallback(async () => {
    const requestId = tournamentRequestIdRef.current + 1;
    tournamentRequestIdRef.current = requestId;
    if (isReady === false || !isAuthenticated || !user?.id) {
      resetTournamentLoad();
      return;
    }

    startTournamentLoad();
    try {
      const tournamentPayload = await fetchMyTournaments({ authMode, user });
      const entries = Array.isArray(tournamentPayload.items) ? tournamentPayload.items : [];
      const enriched = await Promise.all(
        entries.map(async (item) => {
          const [roundResult, standingResult] = await Promise.allSettled([
            item.entry
              ? fetchRounds(item.tournament.id, { authMode, user })
              : Promise.resolve(null),
            item.entry && item.tournament.status === "completed"
              ? fetchStandings(item.tournament.id, { authMode })
              : Promise.resolve(null),
          ]);
          const rounds = roundResult.status === "fulfilled" && Array.isArray(roundResult.value?.rounds)
            ? roundResult.value.rounds
            : [];
          const standingsPayload = standingResult.status === "fulfilled"
            ? standingResult.value
            : null;
          const standings = Array.isArray(standingsPayload?.items)
            ? standingsPayload.items
            : Array.isArray(standingsPayload?.standings)
              ? standingsPayload.standings
              : [];

          return {
            ...item,
            entries: item.entry ? [item.entry] : [],
            rounds,
            standings,
            roundsStatus:
              !item.entry
                ? ASYNC_STATUS.IDLE
                : roundResult.status === "rejected"
                  ? ASYNC_STATUS.ERROR
                  : rounds.length === 0
                    ? ASYNC_STATUS.EMPTY
                    : ASYNC_STATUS.SUCCESS,
            standingsStatus:
              !item.entry || item.tournament.status !== "completed"
                ? ASYNC_STATUS.IDLE
                : standingResult.status === "rejected"
                  ? ASYNC_STATUS.ERROR
                  : standings.length === 0
                    ? ASYNC_STATUS.EMPTY
                    : ASYNC_STATUS.SUCCESS,
          };
        })
      );
      if (tournamentRequestIdRef.current === requestId) {
        succeedTournamentLoad(enriched);
      }
    } catch {
      if (tournamentRequestIdRef.current === requestId) {
        failTournamentLoad("大会情報を取得できませんでした。時間をおいて再試行してください。");
      }
    }
  }, [
    authMode,
    failTournamentLoad,
    isAuthenticated,
    isReady,
    resetTournamentLoad,
    startTournamentLoad,
    succeedTournamentLoad,
    user,
  ]);

  const loadPublicDecks = useCallback(async () => {
    const requestId = publicDeckRequestIdRef.current + 1;
    publicDeckRequestIdRef.current = requestId;
    if (isReady === false || !isAuthenticated || !user?.id) {
      resetPublicDeckLoad();
      return;
    }

    startPublicDeckLoad();
    try {
      // ownerId で絞らないと、公開デッキ全件を総ページ分取得してから
      // 本人ぶんを抜き出すことになり、件数もページ数も本人と無関係に増える。
      const ownerId = String(user.id);
      const firstPage = await fetchPublicDecks({ authMode, page: 1, ownerId });
      const firstItems = Array.isArray(firstPage.items) ? firstPage.items : [];
      const pageSize = Math.max(1, Number(firstPage.pageSize) || 20);
      const total = Math.max(firstItems.length, Number(firstPage.total) || 0);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          fetchPublicDecks({ authMode, page: index + 2, ownerId })
        )
      );
      const publicDecksForUser = [firstPage, ...remainingPages]
        .flatMap((payload) => (Array.isArray(payload.items) ? payload.items : []))
        .filter((deck) => String(deck.owner?.id || "") === ownerId);
      if (publicDeckRequestIdRef.current === requestId) {
        succeedPublicDeckLoad(publicDecksForUser);
      }
    } catch {
      if (publicDeckRequestIdRef.current === requestId) {
        failPublicDeckLoad("公開デッキ情報を取得できませんでした。時間をおいて再試行してください。");
      }
    }
  }, [
    authMode,
    failPublicDeckLoad,
    isAuthenticated,
    isReady,
    resetPublicDeckLoad,
    startPublicDeckLoad,
    succeedPublicDeckLoad,
    user?.id,
  ]);

  useEffect(() => {
    loadTournaments();
    return () => {
      tournamentRequestIdRef.current += 1;
    };
  }, [loadTournaments]);

  useEffect(() => {
    loadPublicDecks();
    return () => {
      publicDeckRequestIdRef.current += 1;
    };
  }, [loadPublicDecks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateNickname(nickname);
    if (validationError) {
      setErrorMessage(validationError);
      setMessage("");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      await updateProfile({ nickname });
      setMessage("プロフィールを更新しました。");
    } catch {
      setErrorMessage("プロフィールを更新できませんでした。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  };

  const grouped = useMemo(() => groupMyTournaments(myTournaments), [myTournaments]);
  const hasRoundErrors = useMemo(
    () => myTournaments.some((item) => item.roundsStatus === ASYNC_STATUS.ERROR),
    [myTournaments]
  );
  const hasStandingErrors = useMemo(
    () =>
      myTournaments.some(
        (item) =>
          item.tournament.status === "completed" &&
          item.standingsStatus === ASYNC_STATUS.ERROR
      ),
    [myTournaments]
  );
  const tournamentsWithReliableStandings = useMemo(
    () =>
      myTournaments.filter(
        (item) =>
          item.tournament.status !== "completed" ||
          item.standingsStatus !== ASYNC_STATUS.ERROR
      ),
    [myTournaments]
  );
  const allResults = useMemo(
    () => computeUserResults(user?.id, myTournaments, publicDecks),
    [myTournaments, publicDecks, user?.id]
  );
  const results = useMemo(
    () => computeUserResults(user?.id, tournamentsWithReliableStandings, publicDecks),
    [publicDecks, tournamentsWithReliableStandings, user?.id]
  );
  const tournamentDataIsAvailable = [ASYNC_STATUS.EMPTY, ASYNC_STATUS.SUCCESS].includes(
    tournamentStatus
  );
  const publicDeckDataIsAvailable = [ASYNC_STATUS.EMPTY, ASYNC_STATUS.SUCCESS].includes(
    publicDeckStatus
  );

  if (!isReady) {
    return (
      <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
        <div className="profile-panel">読み込み中...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
        <section className="profile-panel">
          <h1>マイページ</h1>
          <p className="profile-note">ログインすると参加大会と戦績を確認できます。</p>
          <GoogleSignInPanel />
        </section>
      </main>
    );
  }

  return (
    <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
      <section className="profile-panel profile-identity">
        <div className="profile-avatar" aria-hidden="true">{initialsFor(user)}</div>
        <div className="profile-identity-main">
          <h1>{displayName(user)}</h1>
          <p className="profile-google-name">{user?.name || "-"}</p>
          <Link to={`/users/${user.id}`} className="profile-public-link">公開ページを見る</Link>
        </div>
        <form className="profile-form profile-nickname-form" onSubmit={handleSubmit}>
          <label className="profile-field" htmlFor="profile-nickname">
            <span>ニックネーム変更</span>
            <input
              id="profile-nickname"
              type="text"
              value={nickname}
              minLength={2}
              maxLength={20}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="2〜20文字"
            />
          </label>
          <button type="submit" className="deck-primary-button" disabled={isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </button>
        </form>
      </section>

      {errorMessage ? <p className="profile-error">{errorMessage}</p> : null}
      {message ? <p className="profile-message">{message}</p> : null}

      <section className="profile-metrics" aria-label="戦績サマリー">
        <div>
          <span>参加大会数</span>
          <strong aria-label="参加大会数の値">
            {tournamentDataIsAvailable ? allResults.metrics.tournamentCount : "—"}
          </strong>
        </div>
        <div>
          <span>優勝数</span>
          <strong aria-label="優勝数の値">
            {tournamentDataIsAvailable && !hasStandingErrors
              ? results.metrics.championshipCount
              : "—"}
          </strong>
        </div>
        <div>
          <span>通算</span>
          <strong aria-label="通算成績の値">
            {tournamentDataIsAvailable && !hasStandingErrors
              ? formatRecord(results.metrics.record)
              : "—"}
          </strong>
        </div>
        <div>
          <span>公開デッキ数</span>
          <strong aria-label="公開デッキ数の値">
            {publicDeckDataIsAvailable ? allResults.metrics.publicDeckCount : "—"}
          </strong>
        </div>
      </section>

      <AsyncState
        status={publicDeckStatus}
        error={publicDeckError}
        idleMessage="公開デッキ情報はまだ取得されていません。"
        loadingMessage="公開デッキ情報を読み込み中..."
        emptyMessage="公開しているデッキはありません。"
        onRetry={loadPublicDecks}
        className={publicDeckStatus === ASYNC_STATUS.ERROR ? "profile-error" : "profile-empty"}
      >
        {null}
      </AsyncState>

      <section className="profile-panel">
        <h2>あなたの大会</h2>
        <AsyncState
          status={tournamentStatus}
          error={tournamentError}
          idleMessage="大会情報はまだ取得されていません。"
          loadingMessage="大会情報を読み込み中..."
          emptyMessage="参加・運営している大会はありません。"
          onRetry={loadTournaments}
          className={tournamentStatus === ASYNC_STATUS.ERROR ? "profile-error" : "profile-empty"}
        >
          {hasRoundErrors ? (
            <AsyncState
              status={ASYNC_STATUS.ERROR}
              error="一部の大会の対戦情報を取得できませんでした。"
              onRetry={loadTournaments}
              className="profile-error"
            />
          ) : null}
          {grouped.managed.length > 0 ? (
            <TournamentGroup
              title="主催している大会"
              items={grouped.managed}
              emptyText="主催している大会はありません。"
            />
          ) : null}
          <TournamentGroup title="参加予定" items={grouped.upcoming} emptyText="参加予定の大会はありません。" />
          <TournamentGroup title="進行中" items={grouped.active} emptyText="進行中の大会はありません。" />
          <TournamentGroup title="過去" items={grouped.past} emptyText="過去の大会はありません。" />
        </AsyncState>
      </section>

      {tournamentStatus === ASYNC_STATUS.SUCCESS ? (
        <section className="profile-panel">
          <h2>過去の戦績</h2>
          {hasStandingErrors ? (
            <AsyncState
              status={ASYNC_STATUS.ERROR}
              error="一部の大会の順位・戦績を取得できませんでした。"
              onRetry={loadTournaments}
              className="profile-error"
            />
          ) : null}
          {results.results.length === 0 && !hasStandingErrors ? (
            <p className="profile-empty">完了した大会の戦績はまだありません。</p>
          ) : null}
          {results.results.length > 0 ? (
            <div className="profile-results-list">
              {results.results.map((result) => (
                <Link key={result.tournament.id} to={`/tournaments/${result.tournament.id}`} className="profile-result-row">
                  <div>
                    <strong>{result.tournament.title}</strong>
                    <span>
                      {formatRecord({
                        wins: result.wins,
                        losses: result.losses,
                        draws: result.draws,
                      })}
                    </span>
                  </div>
                  <span className={result.rank === 1 ? "profile-badge soft" : "profile-badge"}>
                    {result.rank === 1 ? "優勝" : `${result.rank}位`}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
