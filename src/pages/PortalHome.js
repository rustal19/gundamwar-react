import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TournamentCard from "../components/TournamentCard";
import { SearchIcon } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import {
  fetchMyTournaments,
  fetchRounds,
  fetchTournament,
  fetchTournaments,
} from "../services/tournaments";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import { getDeckColors } from "../utils/deckColors";
import { getRoundProgressLabel } from "../utils/tournament/roundLabel";
import "./PortalHome.css";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function compareStartsAt(left, right) {
  return String(left.startsAt || "").localeCompare(String(right.startsAt || ""));
}

const HOME_TOURNAMENT_STATUS_PRIORITY = {
  registration: 0,
  in_progress: 0,
  completed: 1,
};

function compareHomeTournaments(left, right) {
  const leftPriority = HOME_TOURNAMENT_STATUS_PRIORITY[left.status] ?? 2;
  const rightPriority = HOME_TOURNAMENT_STATUS_PRIORITY[right.status] ?? 2;
  return leftPriority - rightPriority || compareStartsAt(left, right);
}

function parseTournamentDate(value) {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]) - 1;
      const day = Number(dateOnly[3]);
      const date = new Date(year, month, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shouldShowTournamentOnHome(tournament, now = new Date(Date.now())) {
  if (tournament?.status !== "completed") return true;

  const referenceDate = [tournament.endedAt, tournament.startsAt]
    .map(parseTournamentDate)
    .find(Boolean);
  if (!referenceDate) return true;

  const hideAt = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + 2
  );
  return now < hideAt;
}

const HOME_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatTournamentSchedule(value) {
  if (!value) return "日時未定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時未定";
  return `${date.getMonth() + 1}月${date.getDate()}日(${HOME_WEEKDAYS[date.getDay()]}) ${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function latestHomeRound(rounds) {
  const sorted = [...(Array.isArray(rounds) ? rounds : [])].sort(
    (left, right) => Number(right.number || 0) - Number(left.number || 0)
  );
  return sorted.find((round) => round.status === "in_progress") || sorted[0] || null;
}

function findMyMatch(round, entryId) {
  if (entryId == null) return null;
  return (round?.matches || []).find((match) =>
    [match.player1EntryId, match.player2EntryId].some(
      (matchEntryId) => matchEntryId != null && String(matchEntryId) === String(entryId)
    )
  ) || null;
}

function participantName(entry) {
  return (
    entry?.user?.nickname ||
    entry?.user?.displayNickname ||
    entry?.user?.name ||
    entry?.nickname ||
    entry?.name ||
    "確認中"
  );
}

function opponentName(match, entries, entryId) {
  if (!match) return "発表待ち";
  const isPlayer1 = String(match.player1EntryId) === String(entryId);
  const opponentId = isPlayer1 ? match.player2EntryId : match.player1EntryId;
  if (opponentId == null) return "不戦勝";

  const opponent = (entries || []).find(
    (entry) => entry?.id != null && String(entry.id) === String(opponentId)
  );
  const inlineName = isPlayer1
    ? match.player2Name || match.player2?.name
    : match.player1Name || match.player1?.name;
  return opponent ? participantName(opponent) : inlineName || "確認中";
}

function myTournamentPriority(tournament, needsDecklist = tournament.needsDecklist) {
  if (needsDecklist) return 0;
  if (tournament.status === "in_progress") return 1;
  return 2;
}

function MyTournamentCard({ tournament, buildPath }) {
  const detailPath = buildPath(`/tournaments/${tournament.id}`);

  if (tournament.needsDecklist) {
    return (
      <article
        className="portal-my-tournament-item portal-my-tournament-item--warning"
        data-home-state="needs-action"
      >
        <div className="portal-my-tournament-main">
          <p className="portal-my-tournament-kicker">対応が必要</p>
          <h3>
            <Link to={detailPath}>{tournament.title}</Link>
          </h3>
          <p className="portal-my-tournament-instruction">
            デッキリストが未提出です。
          </p>
        </div>
        <Link
          className="tournament-card-action portal-my-tournament-action warning"
          to={detailPath}
        >
          デッキを提出
        </Link>
      </article>
    );
  }

  if (tournament.status === "in_progress") {
    const currentRound = latestHomeRound(tournament.rounds);
    const myMatch = findMyMatch(currentRound, tournament.myEntry?.id);
    const isPending = tournament.myEntry?.status === "pending";
    const isWaitingForPairing = !currentRound || currentRound.status === "completed";
    const isBye = Boolean(
      myMatch &&
      (myMatch.player1EntryId == null || myMatch.player2EntryId == null)
    );
    const nextAction = isPending
      ? "主催者の承認を待つ"
      : isWaitingForPairing || myMatch?.result || isBye
        ? "次のペアリング発表を待つ"
        : myMatch
          ? "卓へ移動して対戦する"
          : "運営からの案内を確認する";
    const roundLabel = currentRound
      ? getRoundProgressLabel(currentRound, tournament.rounds, tournament)
      : "ペアリング発表待ち";

    return (
      <article
        className="portal-my-tournament-item portal-my-tournament-item--active"
        data-home-state="in-progress"
      >
        <div className="portal-my-tournament-main">
          <div className="portal-my-tournament-heading">
            <h3>
              <Link to={detailPath}>{tournament.title}</Link>
            </h3>
            <span className="tournament-status in_progress">進行中</span>
          </div>
          <p className="portal-my-tournament-round">{roundLabel}</p>
          <div className="portal-my-tournament-focus" aria-label="現在の対戦">
            <span>
              <small>卓番号</small>
              <strong>{myMatch?.tableNo ? `${myMatch.tableNo}卓` : "未定"}</strong>
            </span>
            <span>
              <small>対戦相手</small>
              <strong>{opponentName(myMatch, tournament.entries, tournament.myEntry?.id)}</strong>
            </span>
          </div>
          <p className="portal-my-tournament-next-action">
            <span>次の操作</span>
            <strong>{nextAction}</strong>
          </p>
        </div>
        <Link
          className="tournament-card-action portal-my-tournament-action primary"
          to={buildPath(`/tournaments/${tournament.id}?tab=rounds`)}
        >
          ペアリングを確認
        </Link>
      </article>
    );
  }

  return (
    <article
      className="portal-my-tournament-item portal-my-tournament-item--upcoming"
      data-home-state="upcoming"
    >
      <time dateTime={tournament.startsAt || undefined}>
        {formatTournamentSchedule(tournament.startsAt)}
      </time>
      <div className="portal-my-tournament-heading">
        <h3>
          <Link to={detailPath}>{tournament.title}</Link>
        </h3>
        <span className="portal-my-tournament-status">参加予定</span>
      </div>
      <Link
        className="tournament-card-action portal-my-tournament-action secondary"
        to={detailPath}
      >
        詳細
      </Link>
    </article>
  );
}

function OwnerLink({ owner, buildPath }) {
  const label = owner?.name || "-";
  return owner?.id ? (
    <Link className="portal-deck-owner" to={buildPath(`/users/${owner.id}`)}>
      {label}
    </Link>
  ) : (
    <span className="portal-deck-owner">{label}</span>
  );
}

function DeckColorDots({ items }) {
  const colors = getDeckColors(items);
  const displayColors = colors.length > 0 ? colors : [{ name: "不明", value: "#d8d8d8" }];

  return (
    <span className="portal-deck-colors" aria-label={`デッキ色: ${displayColors.map((color) => color.name).join("、")}`}>
      {displayColors.map((color) => (
        <span
          key={color.name}
          className="portal-deck-color-dot"
          style={{ backgroundColor: color.value }}
          title={color.name}
        />
      ))}
    </span>
  );
}

export default function PortalHome({ compact = false }) {
  const { authMode, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [tournaments, setTournaments] = useState([]);
  const [myTournamentItems, setMyTournamentItems] = useState([]);
  const [decks, setDecks] = useState([]);
  const [isTournamentsLoaded, setIsTournamentsLoaded] = useState(false);
  const [isDecksLoaded, setIsDecksLoaded] = useState(false);
  const [tournamentsError, setTournamentsError] = useState("");
  const [myTournamentsError, setMyTournamentsError] = useState("");
  const [decksError, setDecksError] = useState("");

  const paths = useMemo(
    () => ({
      decks: buildPathWithForcedMobileLayout("/decks", location.search),
      tournaments: buildPathWithForcedMobileLayout("/tournaments", location.search),
    }),
    [location.search]
  );

  const buildPath = (path) => buildPathWithForcedMobileLayout(path, location.search);

  useEffect(() => {
    let isActive = true;
    const loadedAt = new Date(Date.now());
    setIsTournamentsLoaded(false);
    setTournamentsError("");

    Promise.all([
      Promise.resolve(fetchTournaments({ status: "registration", page: 1, authMode })),
      Promise.resolve(fetchTournaments({ status: "in_progress", page: 1, authMode })),
      Promise.resolve(fetchTournaments({ status: "completed", page: 1, authMode })),
    ])
      .then(([registration, inProgress, completed]) => {
        if (!isActive) return;
        const seen = new Set();
        const nextItems = [
          ...(registration?.items || []),
          ...(inProgress?.items || []),
          ...(completed?.items || []),
        ]
          .filter((tournament) => {
            if (!tournament?.id || seen.has(tournament.id)) return false;
            seen.add(tournament.id);
            return true;
          })
          .filter((tournament) => shouldShowTournamentOnHome(tournament, loadedAt))
          .sort(compareHomeTournaments);
        setTournaments(nextItems);
      })
      .catch((error) => {
        if (!isActive) return;
        setTournamentsError(error.message);
        setTournaments([]);
      })
      .finally(() => {
        if (isActive) setIsTournamentsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode]);

  useEffect(() => {
    let isActive = true;
    setMyTournamentsError("");

    if (!isAuthenticated || !user?.id || typeof fetchMyTournaments !== "function") {
      setMyTournamentItems([]);
      return () => {
        isActive = false;
      };
    }

    Promise.resolve(fetchMyTournaments({ authMode, user }))
      .then(async (payload) => {
        const activeItems = (payload?.items || []).filter(
          ({ tournament, entry }) =>
            Boolean(entry) &&
            ["registration", "in_progress"].includes(tournament?.status) &&
            entry.status !== "dropped"
        );
        const visibleItems = activeItems
          .sort(
            (left, right) =>
              myTournamentPriority(left.tournament, left.needsDecklist) -
                myTournamentPriority(right.tournament, right.needsDecklist) ||
              compareStartsAt(left.tournament, right.tournament)
          )
          .slice(0, 5);
        const enrichedItems = await Promise.all(
          visibleItems.map(async (item) => {
            if (item.needsDecklist || item.tournament.status !== "in_progress") return item;

            const knownEntries = Array.isArray(item.entries)
              ? item.entries
              : Array.isArray(item.tournament.entries)
                ? item.tournament.entries
                : null;
            const [roundPayload, detailPayload] = await Promise.all([
              Array.isArray(item.rounds)
                ? Promise.resolve({ rounds: item.rounds })
                : Promise.resolve(
                    fetchRounds(item.tournament.id, { authMode, user })
                  ).catch(() => ({ rounds: [] })),
              knownEntries
                ? Promise.resolve({ entries: knownEntries })
                : Promise.resolve(
                    fetchTournament(item.tournament.id, { authMode, user })
                  ).catch(() => ({ entries: [] })),
            ]);
            return {
              ...item,
              rounds: roundPayload?.rounds || [],
              entries: detailPayload?.entries || knownEntries || [],
            };
          })
        );
        if (!isActive) return;
        setMyTournamentItems(enrichedItems);
      })
      .catch((error) => {
        if (!isActive) return;
        setMyTournamentsError(error.message);
        setMyTournamentItems([]);
      });

    return () => {
      isActive = false;
    };
  }, [authMode, isAuthenticated, user]);

  useEffect(() => {
    let isActive = true;
    setIsDecksLoaded(false);
    setDecksError("");

    Promise.resolve(fetchPublicDecks({ page: 1, authMode }))
      .then((payload) => {
        if (!isActive) return;
        setDecks((payload?.items || []).slice(0, 5));
      })
      .catch((error) => {
        if (!isActive) return;
        setDecksError(error.message);
        setDecks([]);
      })
      .finally(() => {
        if (isActive) setIsDecksLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode]);

  const myTournaments = useMemo(
    () =>
      myTournamentItems
        .map(({ tournament, entry, needsDecklist, rounds, entries }) => ({
          ...tournament,
          myEntry: entry,
          needsDecklist,
          rounds: rounds || [],
          entries: entries || [],
        }))
        .sort(
          (left, right) =>
            myTournamentPriority(left) - myTournamentPriority(right) ||
            compareStartsAt(left, right)
        )
        .slice(0, 5),
    [myTournamentItems]
  );

  const featuredTournaments = useMemo(() => {
    const displayedMyTournamentIds = new Set(
      myTournaments
        .map((tournament) => tournament?.id)
        .filter((id) => id != null)
        .map(String)
    );

    return tournaments
      .filter(
        (tournament) =>
          tournament?.id == null || !displayedMyTournamentIds.has(String(tournament.id))
      )
      .slice(0, 5);
  }, [myTournaments, tournaments]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const name = searchText.trim();
    if (name) params.set("name", name);
    const mobileLayout = new URLSearchParams(location.search).get("mobileLayout");
    if (mobileLayout) params.set("mobileLayout", mobileLayout);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <main className={compact ? "portal-home compact" : "portal-home"}>
      <form
        className="portal-card-search"
        role="search"
        aria-label="カード名検索"
        onSubmit={handleSearchSubmit}
      >
        <SearchIcon size={22} />
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="カード名で検索"
          aria-label="カード名で検索"
        />
        <button type="submit">検索</button>
      </form>

      {myTournaments.length > 0 ? (
        <section className="portal-section" aria-labelledby="portal-my-tournaments-heading">
          <div className="portal-section-header">
            <h2 id="portal-my-tournaments-heading">あなたの大会</h2>
          </div>
          <div className="portal-my-tournament-list">
            {myTournaments.map((tournament) => (
              <MyTournamentCard
                key={`my-${tournament.id}`}
                tournament={tournament}
                buildPath={buildPath}
              />
            ))}
          </div>
          {myTournamentsError ? <div className="portal-empty">{myTournamentsError}</div> : null}
        </section>
      ) : null}

      <section className="portal-section">
        <div className="portal-section-header">
          <h2>大会</h2>
          <Link className="portal-more-link" to={paths.tournaments}>
            一覧へ
          </Link>
        </div>

        {!isTournamentsLoaded ? (
          <div className="portal-empty">読み込み中...</div>
        ) : tournamentsError ? (
          <div className="portal-empty">{tournamentsError}</div>
        ) : featuredTournaments.length === 0 ? (
          // 自分の大会として上に出したぶんを除外した結果ここが空になることがある。
          // その場合に「大会はありません」と出すと、上に表示されている大会と矛盾する。
          <div className="portal-empty">
            {myTournaments.length > 0
              ? "ほかに受付中・進行中の大会はありません。"
              : "受付中・進行中の大会はありません。"}
          </div>
        ) : (
          <div className="portal-tournament-list portal-featured-tournament-list">
            {featuredTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                buildPath={buildPath}
                actionTone="secondary"
              />
            ))}
          </div>
        )}
      </section>

      <section className="portal-section">
        <div className="portal-section-header">
          <h2>新着公開デッキ</h2>
          <Link className="portal-more-link" to={paths.decks}>
            一覧へ
          </Link>
        </div>

        {!isDecksLoaded ? (
          <div className="portal-empty">読み込み中...</div>
        ) : decksError ? (
          <div className="portal-empty">{decksError}</div>
        ) : decks.length === 0 ? (
          <div className="portal-empty">公開デッキはありません。</div>
        ) : (
          <div className="portal-deck-list" role="table" aria-label="新着公開デッキ一覧">
            <div className="portal-deck-header" role="row">
              <span role="columnheader">デッキ名</span>
              <span role="columnheader">フォーマット</span>
              <span role="columnheader">プレイヤー</span>
              <span role="columnheader">公開日</span>
            </div>
            <div className="portal-deck-rows" role="rowgroup">
              {decks.map((deck) => (
                <article key={deck.id} className="portal-deck-row" role="row">
                  <div className="portal-deck-name" role="cell">
                    <DeckColorDots items={deck.items} />
                    <Link className="portal-deck-title" to={buildPath(`/decks/${deck.id}`)}>
                      {deck.title}
                    </Link>
                  </div>
                  <div className="portal-deck-row-meta" role="presentation">
                    <span className="portal-deck-format" role="cell">
                      <span className="portal-deck-cell-label">フォーマット:</span>
                      {deck.format || "未設定"}
                    </span>
                    <span className="portal-deck-player" role="cell">
                      <span className="portal-deck-cell-label">プレイヤー:</span>
                      <OwnerLink owner={deck.owner} buildPath={buildPath} />
                    </span>
                    <time
                      className="portal-deck-date"
                      role="cell"
                      dateTime={deck.publishedAt || deck.updatedAt || undefined}
                    >
                      <span className="portal-deck-cell-label">公開日:</span>
                      {formatDate(deck.publishedAt || deck.updatedAt)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
