import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCardCode } from "../utils/cardImages";
import {
  DECK_EXPORT_SECTION_LABELS,
  DECK_TYPE_ORDER,
  groupDeckItemsByType,
} from "../utils/deckExport";
import { fetchPublicDeck } from "../services/publicDecks";
import "./SearchResults.css";

function normalizeZone(item) {
  return item?.zone === "side" ? "side" : "main";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countItems(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Number(item?.count || 0),
    0
  );
}

function DeckTypeGroups({ title, items }) {
  const groups = useMemo(() => groupDeckItemsByType(items), [items]);

  return (
    <section className="public-deck-section">
      <div className="public-deck-section-header">
        <h2>{title}</h2>
        <span>{`${countItems(items)}枚`}</span>
      </div>
      {DECK_TYPE_ORDER.map((type) => {
        const groupItems = groups[type] || [];
        if (groupItems.length === 0) return null;
        return (
          <div key={type} className="public-deck-type-group">
            <h3>{DECK_EXPORT_SECTION_LABELS[type] || type}</h3>
            <div className="public-deck-card-list">
              {groupItems.map((item) => {
                const card = item.card || {};
                const code = getCardCode(card);
                return (
                  <div key={`${item.cardId}-${normalizeZone(item)}`} className="public-deck-row">
                    <span className="public-deck-count">{item.count}</span>
                    <span className="public-deck-code">{code || "-"}</span>
                    <span className="public-deck-name">{card.name || item.cardId}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default function PublicDeckDetail({ compact = false }) {
  const { authMode } = useAuth();
  const { id } = useParams();
  const [deck, setDeck] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    setIsLoaded(false);
    setErrorMessage("");

    fetchPublicDeck(id, { authMode })
      .then((payload) => {
        if (isActive) setDeck(payload);
      })
      .catch((error) => {
        if (!isActive) return;
        setDeck(null);
        setErrorMessage(error.message);
      })
      .finally(() => {
        if (isActive) setIsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode, id]);

  const mainItems = useMemo(
    () => (deck?.items || []).filter((item) => normalizeZone(item) === "main"),
    [deck]
  );
  const sideItems = useMemo(
    () => (deck?.items || []).filter((item) => normalizeZone(item) === "side"),
    [deck]
  );

  return (
    <main
      id="search-results-container"
      className={compact ? "public-deck-detail compact" : "public-deck-detail"}
    >
      <div className="search-results-toolbar">
        <div>
          <h1>{deck?.title || "公開デッキ"}</h1>
          {deck ? (
            <div className="search-results-summary">
              {[
                deck.owner?.name,
                formatDate(deck.publishedAt || deck.updatedAt),
              ]
                .filter(Boolean)
                .join(" / ")}
            </div>
          ) : null}
        </div>
        <Link className="results-link-button" to="/decks">
          一覧へ
        </Link>
      </div>

      {!isLoaded ? (
        <div className="results-empty-state">Loading...</div>
      ) : errorMessage ? (
        <div className="results-empty-state">{errorMessage}</div>
      ) : deck ? (
        <>
          {deck.description ? <p className="public-deck-description">{deck.description}</p> : null}
          <DeckTypeGroups title="メインデッキ" items={mainItems} />
          <DeckTypeGroups title="サイドボード" items={sideItems} />
        </>
      ) : (
        <div className="results-empty-state">公開デッキが見つかりません。</div>
      )}
    </main>
  );
}
