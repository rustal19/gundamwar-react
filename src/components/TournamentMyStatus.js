import React, { useEffect, useState } from "react";

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

export function getMyStatusPhase(tournament, myEntry, rounds = [], now = new Date()) {
  if (!tournament || !myEntry) return "not_entered";
  if (Array.isArray(rounds) && rounds.length > 0) return "round";
  if (tournament.status === "registration" && compareLocalDate(now, tournament.startsAt) < 0) {
    return "before_start";
  }
  if (toLocalDateKey(tournament.startsAt) === toLocalDateKey(now)) return "checkin";
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

function deckStatusLabel(entry) {
  if (!entry) return "未提出";
  if (Array.isArray(entry.deckItems) && entry.deckItems.length > 0) {
    return `提出済み (メイン ${countCards(entry.deckItems, "main")} / サイド ${countCards(entry.deckItems, "side")})`;
  }
  return entry.decklistSubmittedAt ? "提出済み" : "未提出";
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

function opponentName(match, entries, myEntryId) {
  if (!match) return "-";
  const isPlayer1 = String(match.player1EntryId) === String(myEntryId);
  const opponentId = isPlayer1 ? match.player2EntryId : match.player1EntryId;
  if (opponentId == null) return "不戦勝";
  return findEntry(entries, opponentId)?.user?.name || "-";
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

function EntryForm({
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
  return (
    <div className="tournament-entry-controls">
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
      <div className="tournament-deck-summary">
        メイン {countCards(submittedItems, "main")} / サイド {countCards(submittedItems, "side")}
      </div>
      {deckViolations.length > 0 ? (
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
  canCancel,
  deckSource,
  onDeckSourceChange,
  selectedDeckId,
  onSelectedDeckChange,
  savedDecks,
  submittedItems,
  deckViolations,
  onSubmitEntry,
  onCancelEntry,
  onCheckIn,
  submitDisabled,
  isSubmitting,
}) {
  const [now, setNow] = useState(() => new Date());
  const phase = getMyStatusPhase(tournament, myEntry, rounds, now);
  const needsDeckWarning = Boolean(tournament?.decklistRequired && myEntry && !myEntry.decklistSubmittedAt);
  const currentRound = latestRound(rounds);
  const myMatch = findMyMatch(currentRound, myEntry?.id);
  const result = myResultInfo(myMatch, myEntry?.id);
  const isRoundRunning = phase === "round" && currentRound?.status === "in_progress";
  const countdown = isRoundRunning
    ? getRoundCountdown(currentRound?.timerStartedAt, tournament?.roundTimeMinutes, now)
    : null;
  const isWaitingNextPairing = phase === "round" && currentRound?.status === "completed";
  const checkedIn = myEntry?.status === "checked_in";
  const bandTone =
    phase === "checkin" && !checkedIn
      ? "accent"
      : needsDeckWarning
        ? "warning"
        : checkedIn
          ? "primary"
          : "default";

  useEffect(() => {
    if (!isRoundRunning || !currentRound?.timerStartedAt || tournament?.roundTimeMinutes == null) return undefined;
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, [currentRound?.timerStartedAt, isRoundRunning, tournament?.roundTimeMinutes]);

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
        />
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
        </div>
        {!checkedIn && tournament?.selfCheckin ? (
          <div className="tournament-entry-actions">
            <button type="button" onClick={onCheckIn} disabled={isSubmitting}>
              チェックインする
            </button>
          </div>
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
              <h2>第{currentRound?.number || "-"}回戦</h2>
              <p>対戦相手: {opponentName(myMatch, entries, myEntry.id)}</p>
              {countdown ? <p className="tournament-round-timer">{countdown.label}</p> : null}
            </>
          )}
        </div>
        <div className="tournament-my-status-result">
          {result ? (
            <span className={`tournament-result-badge ${result.tone}`}>
              結果: {result.label}
            </span>
          ) : (
            <span>結果は主催者が登録します。</span>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={`tournament-my-status-band ${bandTone}`}>
      <div>
        <p className="tournament-eyebrow">マイステータス</p>
        <h2>エントリー済み</h2>
        <p>デッキリスト: {deckStatusLabel(myEntry)}</p>
        {needsDeckWarning ? <p className="tournament-my-warning">デッキリストが未提出です。</p> : null}
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
      />
    </section>
  );
}
