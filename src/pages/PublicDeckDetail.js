import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDeck } from "../context/DeckContext";
import CardHoverPreview from "../components/CardHoverPreview";
import { useDeckPreview } from "../hooks/useDeckPreview";
import { getCardCode } from "../utils/cardImages";
import {
  countDeckItems,
  formatDeckCountSummary,
  getDeckItemZone,
} from "../utils/deckCounts";
import {
  DECK_EXPORT_SECTION_LABELS,
  DECK_TYPE_ORDER,
  groupDeckItemsByType,
} from "../utils/deckExport";
import {
  fetchPublicDeck,
  getTournamentParticipantCount,
  getTournamentRank,
  isTournamentDeck,
  setDeckPublication,
} from "../services/publicDecks";
import NotFound from "./NotFound";
import "./PublicDecks.css";

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

function normalizeMetaText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function getOwnerReference(owner) {
  const id = normalizeMetaText(owner?.id);
  const name = normalizeMetaText(owner?.name);
  return id && name ? { id, name } : null;
}

function DeckMeta({ deck, mainCount, sideCount }) {
  const tournamentDeck = isTournamentDeck(deck);
  const linkedOwner = getOwnerReference(deck.owner);
  const ownerName = normalizeMetaText(deck.owner?.name);
  const showOwner = tournamentDeck ? Boolean(ownerName) : Boolean(linkedOwner);
  const format = normalizeMetaText(deck.format);
  const tournament = tournamentDeck ? deck.tournament : null;
  const displayDate = formatDate(
    tournamentDeck
      ? tournament?.startsAt
      : deck.publishedAt || deck.updatedAt
  );
  const finalRank = getTournamentRank(deck);
  const participantCount = getTournamentParticipantCount(deck);

  return (
    <dl className="public-deck-detail-meta" aria-label="デッキ情報">
      {showOwner ? (
        <div>
          <dt>{tournamentDeck ? "提出者" : "投稿者"}</dt>
          <dd>
            {linkedOwner ? (
              <Link to={`/users/${linkedOwner.id}`}>{linkedOwner.name}</Link>
            ) : (
              ownerName
            )}
          </dd>
        </div>
      ) : null}
      {format ? (
        <div>
          <dt>フォーマット</dt>
          <dd>{format}</dd>
        </div>
      ) : null}
      {displayDate ? (
        <div>
          <dt>{tournamentDeck ? "開催日" : "公開日"}</dt>
          <dd>{displayDate}</dd>
        </div>
      ) : null}
      {tournament ? (
        <div>
          <dt>大会名</dt>
          <dd>
            <Link to={`/tournaments/${tournament.id}`}>{tournament.title}</Link>
          </dd>
        </div>
      ) : null}
      {tournament ? (
        <div>
          <dt>順位</dt>
          <dd>{finalRank == null ? "-" : `${finalRank}位`}</dd>
        </div>
      ) : null}
      {tournament ? (
        <div>
          <dt>参加人数</dt>
          <dd>{participantCount == null ? "-" : `${participantCount}人`}</dd>
        </div>
      ) : null}
      <div>
        <dt>枚数</dt>
        <dd>{formatDeckCountSummary(mainCount, sideCount)}</dd>
      </div>
    </dl>
  );
}

function isNotFoundError(error) {
  return error?.code === "not_found" || error?.status === 404 || /not found|見つかりません/i.test(error?.message || "");
}

function DeckTypeGroups({ title, items, compact }) {
  const groups = useMemo(() => groupDeckItemsByType(items), [items]);

  return (
    <section className="public-deck-section">
      <div className="public-deck-section-header">
        <h2>{title}</h2>
        <span>{`${countDeckItems(items)}枚`}</span>
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
                  <div key={`${item.cardId}-${getDeckItemZone(item)}`} className="public-deck-row">
                    <span className="public-deck-count">{item.count}</span>
                    <span className="public-deck-code">{code || "-"}</span>
                    <span className="public-deck-name">
                      <CardHoverPreview card={card} compact={compact}>
                        {card.name || item.cardId}
                      </CardHoverPreview>
                    </span>
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

function DeckPreviewSection({ deck, mainItems, sideItems, mainCount, sideCount }) {
  const { previewUrl, isRendering, errorMessage } = useDeckPreview({
    open: Boolean(deck),
    mainItems,
    sideItems,
    mainCount,
    sideCount,
  });

  return (
    <section className="public-deck-section">
      <div className="public-deck-section-header">
        <h2>デッキ画像</h2>
      </div>
      {previewUrl ? (
        <a
          className="public-deck-preview-frame"
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="デッキ画像を原寸表示"
        >
          <img
            className="public-deck-preview-image"
            src={previewUrl}
            alt={`${deck.title} のデッキ画像`}
          />
        </a>
      ) : (
        <div className="results-empty-state">
          {isRendering ? "読み込み中..." : errorMessage || "デッキ画像を表示できませんでした。"}
        </div>
      )}
    </section>
  );
}

export default function PublicDeckDetail({ compact = false }) {
  const { authMode, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { items, replaceDeck } = useDeck();
  const [deck, setDeck] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isActive = true;
    setIsLoaded(false);
    setErrorMessage("");
    setLoadError(null);

    fetchPublicDeck(id, { authMode })
      .then((payload) => {
        if (isActive) setDeck(payload);
      })
      .catch((error) => {
        if (!isActive) return;
        setDeck(null);
        setErrorMessage(error.message);
        setLoadError(error);
      })
      .finally(() => {
        if (isActive) setIsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode, id]);

  const mainItems = useMemo(
    () => (deck?.items || []).filter((item) => getDeckItemZone(item) === "main"),
    [deck]
  );
  const sideItems = useMemo(
    () => (deck?.items || []).filter((item) => getDeckItemZone(item) === "side"),
    [deck]
  );
  const mainCount = useMemo(() => countDeckItems(mainItems), [mainItems]);
  const sideCount = useMemo(() => countDeckItems(sideItems), [sideItems]);

  const handleCopyDeck = () => {
    if (!deck) return;
    if (
      items.length > 0 &&
      !window.confirm("現在のデッキ内容を置き換えます。よろしいですか?")
    ) {
      return;
    }
    replaceDeck(deck.items);
    navigate("/deck");
  };

  const handleAdminUnpublish = async () => {
    if (!deck) return;
    if (!window.confirm("この公開デッキを非公開にしますか？")) return;

    setIsModerating(true);
    setErrorMessage("");
    try {
      await setDeckPublication({
        authMode,
        user,
        deckId: deck.sourceId || deck.id,
        isPublic: false,
        description: deck.description || "",
        format: deck.format,
      });
      navigate("/decks");
    } catch (moderationError) {
      setErrorMessage(moderationError.message);
    } finally {
      setIsModerating(false);
    }
  };

  if (isLoaded && loadError && isNotFoundError(loadError)) {
    return <NotFound />;
  }

  return (
    <main
      id="search-results-container"
      className={compact ? "public-deck-detail compact" : "public-deck-detail"}
    >
      <div className="search-results-toolbar">
        <div>
          <h1>{deck?.title || "公開デッキ"}</h1>
        </div>
        <div className="public-deck-detail-actions">
          {deck ? (
            <button type="button" className="results-link-button primary" onClick={handleCopyDeck}>
              このデッキをコピー
            </button>
          ) : null}
          {deck && isAdmin && !isTournamentDeck(deck) ? (
            <button
              type="button"
              className="results-link-button"
              onClick={handleAdminUnpublish}
              disabled={isModerating}
            >
              非公開にする(admin)
            </button>
          ) : null}
          <Link className="results-link-button" to="/decks">
            一覧へ
          </Link>
        </div>
      </div>

      {!isLoaded ? (
        <div className="results-empty-state">読み込み中...</div>
      ) : errorMessage ? (
        <div className="results-empty-state">{errorMessage}</div>
      ) : deck ? (
        <>
          <DeckMeta deck={deck} mainCount={mainCount} sideCount={sideCount} />
          {deck.description ? <p className="public-deck-description">{deck.description}</p> : null}
          <DeckTypeGroups title="メインデッキ" items={mainItems} compact={compact} />
          <DeckTypeGroups title="サイドボード" items={sideItems} compact={compact} />
          <DeckPreviewSection
            deck={deck}
            mainItems={mainItems}
            sideItems={sideItems}
            mainCount={mainCount}
            sideCount={sideCount}
          />
        </>
      ) : (
        <div className="results-empty-state">公開デッキが見つかりません。</div>
      )}
    </main>
  );
}
