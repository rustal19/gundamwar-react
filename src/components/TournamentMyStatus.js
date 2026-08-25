import React, { useEffect, useMemo, useState } from "react";
import { DECKLIST_STATE_LABELS } from "../data/statusLabels";
import { createTournamentParticipantNameFormatter } from "../utils/tournament/participantDisplayName";
import {
  getRoundLabel,
  getRoundLabelForNumber,
  getRoundProgressLabel,
} from "../utils/tournament/roundLabel";

function toLocalDateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function compareLocalDate(left, right) {
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return 0;
  const a = new Date(leftDate.getFullYear(), leftDate.getMonth(), leftDate.getDate()).getTime();
  const b = new Date(rightDate.getFullYear(), rightDate.getMonth(), rightDate.getDate()).getTime();
  return a === b ? 0 : a < b ? -1 : 1;
}

function formatMonthDayTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "設定された時刻";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function isSelfCheckinOpen(tournament, now = new Date()) {
  if (!tournament) return false;
  if (tournament.checkinOpensAt) {
    const opensAt = new Date(tournament.checkinOpensAt).getTime();
    const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
    return !Number.isNaN(opensAt) && !Number.isNaN(current) && current >= opensAt;
  }
  return toLocalDateKey(tournament.startsAt) === toLocalDateKey(now);
}

export function getMyStatusPhase(tournament, myEntry, rounds = [], now = new Date()) {
  if (!tournament || !myEntry) return "not_entered";
  if (Array.isArray(rounds) && rounds.length > 0) return "round";
  if (tournament.checkinOpensAt && isSelfCheckinOpen(tournament, now)) return "checkin";
  if (tournament.status === "registration" && compareLocalDate(now, tournament.startsAt) < 0) {
    return "before_start";
  }
  if (!tournament.checkinOpensAt && isSelfCheckinOpen(tournament, now)) return "checkin";
  return "entered";
}

export function getRoundCountdown(timerStartedAt, roundTimeMinutes, now = new Date()) {
  if (!timerStartedAt || roundTimeMinutes == null) return null;
  const startedAt = new Date(timerStartedAt).getTime();
  const minutes = Number(roundTimeMinutes);
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(minutes) || !Number.isFinite(current) || minutes <= 0) {
    return null;
  }
  const remainingMs = startedAt + minutes * 60 * 1000 - current;
  if (remainingMs <= 0) {
    return { remainingMs: 0, label: "時間切れ", expired: true };
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const displayMinutes = Math.floor(totalSeconds / 60);
  const displaySeconds = totalSeconds % 60;
  return {
    remainingMs,
    label: `残り ${displayMinutes}:${String(displaySeconds).padStart(2, "0")}`,
    expired: false,
  };
}

function countCards(items, zone) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => !zone || item.zone === zone)
    .reduce((sum, item) => sum + Number(item.count || 0), 0);
}

function latestRound(rounds) {
  const items = Array.isArray(rounds) ? rounds : [];
  return [...items].sort(
    (left, right) => Number(left.number || 0) - Number(right.number || 0)
  )[items.length - 1];
}

function findEntry(entries, entryId) {
  return (entries || []).find((entry) => String(entry.id) === String(entryId)) || null;
}

function findMyMatch(round, myEntryId) {
  return (round?.matches || []).find(
    (match) =>
      String(match.player1EntryId) === String(myEntryId) ||
      String(match.player2EntryId) === String(myEntryId)
  );
}

function opponentName(match, entries, myEntryId, formatParticipantName) {
  if (!match) return "-";
  const isPlayer1 = String(match.player1EntryId) === String(myEntryId);
  const opponentId = isPlayer1 ? match.player2EntryId : match.player1EntryId;
  if (opponentId == null) return "不戦勝";
  return formatParticipantName(findEntry(entries, opponentId), "-");
}

function hasGameScore(match) {
  return match?.player1Games != null && match?.player2Games != null;
}

function myResultInfo(match, myEntryId) {
  if (!match?.result) return null;
  const isPlayer1 = String(match.player1EntryId) === String(myEntryId);
  const p1Games = match.player1Games;
  const p2Games = match.player2Games;
  const myGames = isPlayer1 ? p1Games : p2Games;
  const opponentGames = isPlayer1 ? p2Games : p1Games;
  const score = hasGameScore(match) ? ` ${myGames}-${opponentGames}` : "";

  if (match.result === "draw") return { label: `引き分け${score}`, tone: "draw" };
  if (match.result === "bye") return { label: "不戦勝", tone: "win" };

  const won =
    (match.result === "p1_win" && isPlayer1) || (match.result === "p2_win" && !isPlayer1);
  return { label: `${won ? "勝利" : "敗北"}${score}`, tone: won ? "win" : "loss" };
}

function DeckCountPreview({ items }) {
  return (
    <span className="tournament-deck-summary">
      メイン {countCards(items, "main")} / サイド {countCards(items, "side")}
    </span>
  );
}

function DecklistStatusNotice({ entry, canUpdateDeck }) {
  if (!entry?.decklistState) return null;

  const state = entry.decklistState;
  const isUnsubmittedAndLocked = state === "none" && Boolean(entry.deckLockedAt);
  let message = "デッキリストの状態を確認してください。";

  if (state === "none") {
    message = isUnsubmittedAndLocked
      ? "チェックイン済みのためデッキリストは変更できません(修正が必要な場合は主催者へ)"
      : canUpdateDeck
        ? "デッキリストが未提出です。デッキを選んで提出してください。"
        : "デッキリストは未提出です。現在は提出できません。";
  } else if (state === "submitted") {
    message = canUpdateDeck
      ? "デッキリストは提出済みです。差し替えできます。"
      : "デッキリストは提出済みです。現在は差し替えできません。";
  } else if (state === "locked") {
    message = "チェックイン済みのためデッキリストは変更できません(修正が必要な場合は主催者へ)";
  } else if (state === "revealed") {
    message = "デッキリストは公開中のため差し替えできません。";
  }

  return (
    <div className={`tournament-decklist-status ${state}`}>
      <span className={`decklist-state-badge ${state}`}>
        {DECKLIST_STATE_LABELS[state] || state}
        {isUnsubmittedAndLocked ? "・ロック中" : ""}
      </span>
      <p>{message}</p>
      {state !== "none" && Array.isArray(entry.deckItems) && entry.deckItems.length > 0 ? (
        <DeckCountPreview items={entry.deckItems} />
      ) : null}
    </div>
  );
}

function CheckInConfirmDialog({ decklistState, isSubmitting, onCancel, onConfirm }) {
  return (
    <div className="tournament-dialog-backdrop" role="presentation">
      <div
        className="tournament-deck-dialog tournament-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-confirm-dialog-title"
        aria-describedby={
          decklistState === "none"
            ? "checkin-confirm-dialog-deck-warning checkin-confirm-dialog-description"
            : "checkin-confirm-dialog-description"
        }
      >
        <div className="tournament-dialog-header">
          <h3 id="checkin-confirm-dialog-title">チェックインの確認</h3>
        </div>
        {decklistState === "none" ? (
          <div
            id="checkin-confirm-dialog-deck-warning"
            className="tournament-validation-alert"
          >
            <strong>
              デッキリストが未提出です。このままチェックインすると自分では提出できなくなります。
            </strong>
          </div>
        ) : null}
        <p id="checkin-confirm-dialog-description">
          チェックインするとデッキリストがロックされ、以降は自分で変更できなくなります。修正が必要になった場合は主催者に連絡してください。チェックインしますか?
        </p>
        <div className="tournament-entry-actions tournament-confirm-actions">
          <button type="button" onClick={onConfirm} disabled={isSubmitting}>
            チェックインする
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

function MatchHistory({ rounds, entries, myEntry, formatParticipantName }) {
  const [open, setOpen] = useState(false);
  if (!myEntry || !Array.isArray(rounds) || rounds.length === 0) return null;

  const rows = (rounds || [])
    .map((round) => {
      const match = findMyMatch(round, myEntry.id);
      if (!match) return null;
      return {
        round,
        match,
        opponent: opponentName(match, entries, myEntry.id, formatParticipantName),
        result: myResultInfo(match, myEntry.id),
      };
    })
    .filter(Boolean);

  return (
    <div className="tournament-match-history">
      <button type="button" className="tournament-secondary-button" onClick={() => setOpen((value) => !value)}>
        {open ? "対戦履歴を閉じる" : "対戦履歴"}
      </button>
      {open ? (
        rows.length > 0 ? (
          <div className="tournament-table-wrap">
            <table className="tournament-table tournament-history-table">
              <thead>
                <tr>
                  <th>ラウンド</th>
                  <th>卓番号</th>
                  <th>対戦相手</th>
                  <th>スコア</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ round, match, opponent, result }) => (
                  <tr key={`${round.id}-${match.id}`}>
                    <td>{getRoundLabel(round, rounds)}</td>
                    <td>{match.tableNo || "-"}</td>
                    <td>{opponent}</td>
                    <td>{result?.label || "未報告"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tournament-muted">対戦履歴はまだありません。</p>
        )
      ) : null}
    </div>
  );
}

function EntryForm({
  tournament,
  deckSource,
  onDeckSourceChange,
  selectedDeckId,
  onSelectedDeckChange,
  savedDecks,
  submittedItems,
  deckViolations,
  onSubmitEntry,
  onCancelEntry,
  submitDisabled,
  canCancel,
  canRegister,
  canUpdateDeck,
  isSubmitting,
  myEntry,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const selectedSavedDeck = (savedDecks || []).find((deck) => deck.id === selectedDeckId);
  const hasSubmittedItems = Array.isArray(submittedItems) && submittedItems.length > 0;
  const canEnterWithoutDeck = !myEntry && !tournament?.decklistRequired && !hasSubmittedItems;

  return (
    <div className="tournament-entry-controls">
      <div className="tournament-selected-deck">
        <span>
          提出デッキ: {deckSource === "saved" ? selectedSavedDeck?.title || "保存デッキ未選択" : "現在のデッキビルダー"}
        </span>
        <DeckCountPreview items={submittedItems} />
        <button type="button" className="tournament-secondary-button" onClick={() => setIsDialogOpen(true)}>
          デッキを選ぶ
        </button>
      </div>
      <p className="tournament-muted">
        {myEntry?.deckUnlockedAt && !myEntry.deckLockedAt
          ? "主催者がロックを解除しています。再提出するとデッキリストは再びロックされます。"
          : "締切までは何度でも差し替えできます。"}
      </p>
      {isDialogOpen ? (
        <div className="tournament-dialog-backdrop" role="presentation">
          <div className="tournament-deck-dialog" role="dialog" aria-modal="true" aria-labelledby="deck-submit-dialog-title">
            <div className="tournament-dialog-header">
              <h3 id="deck-submit-dialog-title">デッキ提出</h3>
              <button type="button" className="tournament-secondary-button" onClick={() => setIsDialogOpen(false)}>
                閉じる
              </button>
            </div>
            <section className="tournament-submit-choice">
              <h4>保存デッキから選択</h4>
              {savedDecks.length === 0 ? <p className="tournament-muted">保存デッキはありません。</p> : null}
              <div className="tournament-saved-deck-list">
                {savedDecks.map((deck) => (
                  <label key={deck.id} className="tournament-saved-deck-option">
                    <input
                      type="radio"
                      name="submitted-deck"
                      checked={deckSource === "saved" && selectedDeckId === deck.id}
                      onChange={() => {
                        onDeckSourceChange("saved");
                        onSelectedDeckChange(deck.id);
                      }}
                    />
                    <span>{deck.title}</span>
                    <DeckCountPreview items={deck.items} />
                  </label>
                ))}
              </div>
            </section>
            <section className="tournament-submit-choice">
              <h4>現在のデッキビルダーの内容</h4>
              <button
                type="button"
                className={deckSource === "current" ? "tournament-choice-button active" : "tournament-choice-button"}
                onClick={() => onDeckSourceChange("current")}
              >
                現在のデッキを使う <DeckCountPreview items={submittedItems} />
              </button>
            </section>
            <section className="tournament-submit-choice">
              <h4>デッキ構築へ</h4>
              <a className="tournament-choice-link" href="/deck">
                デッキ構築へ
              </a>
            </section>
          </div>
        </div>
      ) : null}
      <label>
        提出元
        <select value={deckSource} onChange={(event) => onDeckSourceChange(event.target.value)}>
          <option value="current">現在のデッキ</option>
          <option value="saved">保存デッキ</option>
        </select>
      </label>
      {deckSource === "saved" ? (
        <label>
          保存デッキ
          <select value={selectedDeckId} onChange={(event) => onSelectedDeckChange(event.target.value)}>
            <option value="">選択してください</option>
            {savedDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!hasSubmittedItems && myEntry ? (
        <div className="tournament-validation-alert">
          <strong>提出するデッキがありません。完成したデッキを選択してください。</strong>
        </div>
      ) : null}
      {!hasSubmittedItems && !myEntry && tournament?.decklistRequired ? (
        <div className="tournament-validation-alert">
          <strong>エントリーには完成したデッキが必要です。</strong>
        </div>
      ) : null}
      {canEnterWithoutDeck ? (
        <p className="tournament-muted">デッキリストを添付せずにエントリーします。</p>
      ) : null}
      {deckViolations.length > 0 && !canEnterWithoutDeck ? (
        <div className="tournament-validation-alert">
          <strong>デッキリストを提出できません。</strong>
          <ul>
            {deckViolations.map((violation, index) => (
              <li key={`${violation.code}-${violation.cardName || index}`}>{violation.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="tournament-entry-actions">
        <button type="button" onClick={onSubmitEntry} disabled={submitDisabled}>
          {myEntry ? "提出を更新" : "エントリー"}
        </button>
        {myEntry ? (
          <button type="button" onClick={onCancelEntry} disabled={!canCancel || isSubmitting}>
            取り消し
          </button>
        ) : null}
      </div>
      {!canRegister && !myEntry ? <p className="tournament-muted">現在受付できません。</p> : null}
      {myEntry && !canUpdateDeck ? (
        <p className="tournament-muted">デッキリストの変更受付は終了しています。</p>
      ) : null}
    </div>
  );
}

export default function TournamentMyStatus({
  tournament,
  myEntry,
  entries,
  rounds,
  isAuthenticated,
  canRegister,
  canUpdateDeck,
  canLateEntry,
  canCancel,
  deckSource,
  onDeckSourceChange,
  selectedDeckId,
  onSelectedDeckChange,
  savedDecks,
  submittedItems,
  deckViolations,
  onSubmitEntry,
  onRequestLateEntry,
  onCancelEntry,
  onCheckIn,
  submitDisabled,
  isSubmitting,
  formatParticipantName: providedParticipantNameFormatter,
}) {
  const [now, setNow] = useState(() => new Date());
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const defaultParticipantNameFormatter = useMemo(
    () => createTournamentParticipantNameFormatter(entries),
    [entries]
  );
  const formatParticipantName =
    providedParticipantNameFormatter || defaultParticipantNameFormatter;
  const phase = getMyStatusPhase(tournament, myEntry, rounds, now);
  const needsDeckWarning = Boolean(
    tournament?.decklistRequired && myEntry?.decklistState === "none"
  );
  const currentRound = latestRound(rounds);
  const myMatch = findMyMatch(currentRound, myEntry?.id);
  const result = myResultInfo(myMatch, myEntry?.id);
  const isRoundRunning = phase === "round" && currentRound?.status === "in_progress";
  const countdown = isRoundRunning
    ? getRoundCountdown(currentRound?.timerStartedAt, tournament?.roundTimeMinutes, now)
    : null;
  const isWaitingNextPairing = phase === "round" && currentRound?.status === "completed";
  const checkedIn = myEntry?.status === "checked_in";
  const selfCheckinOpen = isSelfCheckinOpen(tournament, now);
  const selfCheckinUnavailableReason = selfCheckinOpen
    ? ""
    : tournament?.checkinOpensAt
      ? `セルフチェックインは${formatMonthDayTime(tournament.checkinOpensAt)}から利用できます。`
      : "セルフチェックインは開催日当日のみ利用できます。";
  const canEditDecklist = Boolean(
    canUpdateDeck &&
      ["none", "submitted"].includes(myEntry?.decklistState) &&
      !myEntry?.deckLockedAt
  );
  const bandTone =
    phase === "checkin" && !checkedIn
      ? "accent"
      : needsDeckWarning
        ? "warning"
        : checkedIn
          ? "primary"
          : "default";
  const decklistEntryForm = canEditDecklist ? (
    <EntryForm
      tournament={tournament}
      deckSource={deckSource}
      onDeckSourceChange={onDeckSourceChange}
      selectedDeckId={selectedDeckId}
      onSelectedDeckChange={onSelectedDeckChange}
      savedDecks={savedDecks}
      submittedItems={submittedItems}
      deckViolations={deckViolations}
      onSubmitEntry={onSubmitEntry}
      onCancelEntry={onCancelEntry}
      submitDisabled={submitDisabled}
      canCancel={canCancel}
      canRegister={canRegister}
      canUpdateDeck={canUpdateDeck}
      isSubmitting={isSubmitting}
      myEntry={myEntry}
    />
  ) : null;
  const confirmCheckIn = () => {
    if (isSubmitting) return;
    setIsCheckInDialogOpen(false);
    onCheckIn();
  };

  useEffect(() => {
    if (!isRoundRunning || !currentRound?.timerStartedAt || tournament?.roundTimeMinutes == null) return undefined;
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, [currentRound?.timerStartedAt, isRoundRunning, tournament?.roundTimeMinutes]);

  useEffect(() => {
    if (
      checkedIn ||
      selfCheckinOpen ||
      !tournament?.selfCheckin ||
      !tournament?.checkinOpensAt
    ) {
      return undefined;
    }
    const opensAt = new Date(tournament.checkinOpensAt).getTime();
    if (Number.isNaN(opensAt)) return undefined;
    const remaining = opensAt - now.getTime();
    const timeoutId = window.setTimeout(
      () => setNow(new Date()),
      Math.min(Math.max(remaining + 50, 50), 2147483647)
    );
    return () => window.clearTimeout(timeoutId);
  }, [checkedIn, now, selfCheckinOpen, tournament?.checkinOpensAt, tournament?.selfCheckin]);

  if (!isAuthenticated) {
    return (
      <section className="tournament-my-status-band default">
        <div>
          <p className="tournament-eyebrow">マイステータス</p>
          <h2>ログイン後にエントリーできます</h2>
        </div>
      </section>
    );
  }

  if (!myEntry) {
    if (canLateEntry) {
      return (
        <section className="tournament-my-status-band default">
          <div>
            <p className="tournament-eyebrow">マイステータス</p>
            <h2>途中参加申請</h2>
            <p>進行中の大会です。承認されると次のラウンドから参加できます。</p>
          </div>
          <div className="tournament-entry-actions">
            <button type="button" onClick={onRequestLateEntry} disabled={isSubmitting}>
              参加申請
            </button>
          </div>
        </section>
      );
    }

    if (!canRegister) {
      return (
        <section className="tournament-my-status-band default">
          <div>
            <p className="tournament-eyebrow">マイステータス</p>
            <h2>受付が終了しました。</h2>
          </div>
        </section>
      );
    }

    return (
      <section className="tournament-my-status-band default">
        <div>
          <p className="tournament-eyebrow">マイステータス</p>
          <h2>エントリー</h2>
          <p>{tournament?.decklistRequired ? "保存デッキまたは現在のデッキを選んで提出してください。" : "デッキ提出は任意です。"}</p>
        </div>
        <EntryForm
          deckSource={deckSource}
          onDeckSourceChange={onDeckSourceChange}
          selectedDeckId={selectedDeckId}
          onSelectedDeckChange={onSelectedDeckChange}
          savedDecks={savedDecks}
          submittedItems={submittedItems}
          deckViolations={deckViolations}
          onSubmitEntry={onSubmitEntry}
          onCancelEntry={onCancelEntry}
          submitDisabled={submitDisabled}
          canCancel={canCancel}
          canRegister={canRegister}
          canUpdateDeck={canUpdateDeck}
          isSubmitting={isSubmitting}
          myEntry={myEntry}
          tournament={tournament}
        />
      </section>
    );
  }

  if (myEntry.status === "pending") {
    return (
      <section className="tournament-my-status-band warning">
        <div>
          <p className="tournament-eyebrow">マイステータス</p>
          <h2>申請中(主催者の承認待ち)</h2>
          <p>
            承認されると
            {getRoundLabelForNumber(myEntry.joinedAtRound || 1, rounds, tournament)}まで不戦敗として追加されます。
          </p>
          <DecklistStatusNotice entry={myEntry} canUpdateDeck={canEditDecklist} />
          <MatchHistory
            rounds={rounds}
            entries={entries}
            myEntry={myEntry}
            formatParticipantName={formatParticipantName}
          />
        </div>
        {decklistEntryForm}
      </section>
    );
  }

  if (phase === "checkin") {
    return (
      <section className={`tournament-my-status-band ${bandTone}`}>
        <div>
          <p className="tournament-eyebrow">マイステータス</p>
          <h2>{checkedIn ? "チェックイン済み" : "チェックイン待ち"}</h2>
          <p>{checkedIn ? "ペアリング発表までお待ちください。" : "会場受付でチェックインしてください。"}</p>
          <DecklistStatusNotice entry={myEntry} canUpdateDeck={canEditDecklist} />
        </div>
        {decklistEntryForm}
        {!checkedIn && tournament?.selfCheckin ? (
          <div className="tournament-entry-actions">
            <button
              type="button"
              onClick={() => setIsCheckInDialogOpen(true)}
              disabled={isSubmitting || !selfCheckinOpen}
              title={selfCheckinUnavailableReason || undefined}
            >
              チェックインする
            </button>
            {selfCheckinUnavailableReason ? (
              <p className="tournament-my-warning">{selfCheckinUnavailableReason}</p>
            ) : null}
          </div>
        ) : null}
        {isCheckInDialogOpen ? (
          <CheckInConfirmDialog
            decklistState={myEntry.decklistState}
            isSubmitting={isSubmitting}
            onCancel={() => setIsCheckInDialogOpen(false)}
            onConfirm={confirmCheckIn}
          />
        ) : null}
      </section>
    );
  }

  if (phase === "round") {
    return (
      <section className="tournament-my-status-band primary">
        <div>
          <p className="tournament-eyebrow">マイステータス</p>
          {isWaitingNextPairing ? (
            <>
              <h2>次のペアリング待ち</h2>
              <p>ラウンド完了後、次のペアリング発表までお待ちください。</p>
            </>
          ) : (
            <>
              <div className="tournament-my-table">{myMatch?.tableNo ? `卓 ${myMatch.tableNo}` : "卓未定"}</div>
              <h2>{getRoundProgressLabel(currentRound, rounds, tournament)}</h2>
              <p>
                対戦相手: {opponentName(myMatch, entries, myEntry.id, formatParticipantName)}
              </p>
              {countdown ? <p className="tournament-round-timer">{countdown.label}</p> : null}
            </>
          )}
          <DecklistStatusNotice entry={myEntry} canUpdateDeck={canEditDecklist} />
        </div>
        {decklistEntryForm}
        <div className="tournament-my-status-result">
          {result ? (
            <span className={`tournament-result-badge ${result.tone}`}>
              結果: {result.label}
            </span>
          ) : (
            <span>結果は主催者が登録します。</span>
          )}
        </div>
        <MatchHistory
          rounds={rounds}
          entries={entries}
          myEntry={myEntry}
          formatParticipantName={formatParticipantName}
        />
      </section>
    );
  }

  return (
    <section className={`tournament-my-status-band ${bandTone}`}>
      <div>
        <p className="tournament-eyebrow">マイステータス</p>
        <h2>エントリー済み</h2>
        <DecklistStatusNotice entry={myEntry} canUpdateDeck={canEditDecklist} />
        {needsDeckWarning ? <p className="tournament-my-warning">提出状況を確認してください。</p> : null}
        {!checkedIn && tournament?.selfCheckin ? (
          <>
            <div className="tournament-entry-actions">
              <button
                type="button"
                onClick={() => setIsCheckInDialogOpen(true)}
                disabled={isSubmitting || !selfCheckinOpen}
                title={selfCheckinUnavailableReason || undefined}
              >
                チェックインする
              </button>
            </div>
            {selfCheckinUnavailableReason ? (
              <p className="tournament-my-warning">{selfCheckinUnavailableReason}</p>
            ) : null}
          </>
        ) : null}
      </div>
      {decklistEntryForm || (canCancel ? (
        <div className="tournament-entry-actions">
          <button type="button" onClick={onCancelEntry} disabled={isSubmitting}>
            取り消し
          </button>
        </div>
      ) : null)}
      {myEntry ? (
        <MatchHistory
          rounds={rounds}
          entries={entries}
          myEntry={myEntry}
          formatParticipantName={formatParticipantName}
        />
      ) : null}
    </section>
  );
}
