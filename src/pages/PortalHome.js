import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TournamentCard from "../components/TournamentCard";
import { SearchIcon } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchMyTournaments, fetchTournaments } from "../services/tournaments";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import { getDeckColors } from "../utils/deckColors";
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
      .then((payload) => {
        if (!isActive) return;
        setMyTournamentItems(
          (payload?.items || []).filter(({ tournament, entry }) =>
            ["registration", "in_progress"].includes(tournament?.status) &&
            entry?.status !== "dropped"
          )
        );
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
        .map(({ tournament, entry, needsDecklist }) => ({
          ...tournament,
          myEntry: entry,
          needsDecklist,
        }))
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
        <section className="portal-section">
          <div className="portal-section-header">
            <h2>あなたの大会</h2>
          </div>
          <div className="portal-tournament-list">
            {myTournaments.map((tournament) => (
              <div key={`my-${tournament.id}`} className="portal-my-tournament-item">
                {tournament.needsDecklist ? <span className="portal-warning-badge">未提出</span> : null}
                <TournamentCard
                  tournament={tournament}
                  buildPath={buildPath}
                  actionTone="secondary"
                />
              </div>
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
          <div className="portal-tournament-list">
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
          <div className="portal-deck-list">
            {decks.map((deck) => (
              <article key={deck.id} className="portal-deck-row">
                <DeckColorDots items={deck.items} />
                <Link className="portal-deck-title" to={buildPath(`/decks/${deck.id}`)}>
                  {deck.title}
                </Link>
                <OwnerLink owner={deck.owner} buildPath={buildPath} />
                <span className="portal-deck-format">{deck.format || ""}</span>
                <span className="portal-deck-date">{formatDate(deck.publishedAt || deck.updatedAt)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
