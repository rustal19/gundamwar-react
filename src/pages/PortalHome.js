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
    setIsTournamentsLoaded(false);
    setTournamentsError("");

    Promise.all([
      Promise.resolve(fetchTournaments({ status: "registration", page: 1, authMode })),
      Promise.resolve(fetchTournaments({ status: "in_progress", page: 1, authMode })),
    ])
      .then(([registration, inProgress]) => {
        if (!isActive) return;
        const seen = new Set();
        const nextItems = [...(registration?.items || []), ...(inProgress?.items || [])]
          .filter((tournament) => {
            if (!tournament?.id || seen.has(tournament.id)) return false;
            seen.add(tournament.id);
            return true;
          })
          .sort(compareStartsAt);
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

  const featuredTournaments = useMemo(
    () => tournaments.slice(0, 5),
    [tournaments]
  );

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
      {myTournaments.length > 0 ? (
        <section className="portal-section portal-section-first">
          <div className="portal-section-header">
            <h2>あなたの大会</h2>
          </div>
          <div className="portal-tournament-list">
            {myTournaments.map((tournament) => (
              <div key={`my-${tournament.id}`} className="portal-my-tournament-item">
                {tournament.needsDecklist ? <span className="portal-warning-badge">未提出</span> : null}
                <TournamentCard tournament={tournament} buildPath={buildPath} />
              </div>
            ))}
          </div>
          {myTournamentsError ? <div className="portal-empty">{myTournamentsError}</div> : null}
        </section>
      ) : null}

      <form className="portal-card-search" onSubmit={handleSearchSubmit}>
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
          <div className="portal-empty">受付中・進行中の大会はありません。</div>
        ) : (
          <div className="portal-tournament-list">
            {featuredTournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} buildPath={buildPath} />
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
                <span className="portal-deck-owner">{deck.owner?.name || "-"}</span>
                <span className="portal-deck-date">{formatDate(deck.publishedAt || deck.updatedAt)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
