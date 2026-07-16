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

function DeckCountPreview({ items }) {
  return (
    <span className="tournament-deck-summary">
      メイン {countCards(items, "main")} / サイド {countCards(items, "side")}
    </span>
  );
}

function MatchHistory({ rounds, entries, myEntry }) {
  const [open, setOpen] = useState(false);
  if (!myEntry || !Array.isArray(rounds) || rounds.length === 0) return null;

  const rows = (rounds || [])
    .map((round) => {
      const match = findMyMatch(round, myEntry.id);
      if (!match) return null;
      return {
        round,
        match,
        opponent: opponentName(match, entries, myEntry.id),
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
                    <td>第{round.number}回戦</td>
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
      <p className="tournament-muted">締切までは何度でも差し替えできます。</p>
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
          <p>承認されると第{myEntry.joinedAtRound || 1}回戦まで不戦敗として追加されます。</p>
          <MatchHistory rounds={rounds} entries={entries} myEntry={myEntry} />
        </div>
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
        <MatchHistory rounds={rounds} entries={entries} myEntry={myEntry} />
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
      {myEntry ? <MatchHistory rounds={rounds} entries={entries} myEntry={myEntry} /> : null}
    </section>
  );
}
