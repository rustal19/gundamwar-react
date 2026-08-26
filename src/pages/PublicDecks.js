import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import RegulationCardInput, {
  createRegulationCardState,
  getRegulationCardIds,
} from "../components/RegulationCardInput";
import { useAuth } from "../context/AuthContext";
import {
  FORMAT_GROUP_KEYS,
  PUBLIC_DECK_FORMAT_GROUPS,
  deriveFormatGroup,
  getDefaultFormatName,
  getTensakuRoundLabel,
} from "../data/formatGroups";
import {
  fetchPublicDecks,
  getTournamentParticipantCount,
  getTournamentRank,
  isTournamentDeck,
} from "../services/publicDecks";
import { formatDeckCountSummary, getDeckCounts } from "../utils/deckCounts";
import { getDeckColors } from "../utils/deckColors";
import "./PublicDecks.css";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDeckItemsCount(items) {
  const { mainCount, sideCount } = getDeckCounts(items);
  return formatDeckCountSummary(mainCount, sideCount);
}

function createCardFilterState(cardId, cardName = "", knownCards = []) {
  const normalizedCardId = String(cardId || "").trim();
  const normalizedCardName = String(cardName || "").trim();
  const matchingKnownCards = (Array.isArray(knownCards) ? knownCards : []).filter(
    (card) => String(card?.cardId || "").trim() === normalizedCardId
  );
  return createRegulationCardState(normalizedCardId ? [normalizedCardId] : [], {
    trustExistingIds: true,
    knownCards: normalizedCardName
      ? [{ cardId: normalizedCardId, name: normalizedCardName }]
      : matchingKnownCards,
  });
}

function OwnerLink({ owner }) {
  const label = owner?.name || "-";
  return owner?.id ? <Link to={`/users/${owner.id}`}>{label}</Link> : <span>{label}</span>;
}

function DeckColorDots({ items }) {
  const colors = getDeckColors(items);
  const displayColors = colors.length > 0 ? colors : [{ name: "不明", value: "#d8d8d8" }];

  return (
    <span
      className="public-deck-colors"
      aria-label={`デッキ色: ${displayColors.map((color) => color.name).join("、")}`}
    >
      {displayColors.map((color) => (
        <span
          key={color.name}
          className="public-deck-color-dot"
          style={{ backgroundColor: color.value }}
          title={color.name}
        />
      ))}
    </span>
  );
}

export default function PublicDecks({ compact = false }) {
  const { authMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const page = Number(params.get("page") || 1);
  const query = params.get("query") || "";
  const format = params.get("format") || "";
  const cardId = params.get("cardId") || "";
  const cardName = params.get("cardName") || "";
  const playerName = params.get("playerName") || "";
  const tournamentName = params.get("tournamentName") || "";
  const [searchText, setSearchText] = useState(query);
  const [playerText, setPlayerText] = useState(playerName);
  const [tournamentText, setTournamentText] = useState(tournamentName);
  const [cardInput, setCardInput] = useState(() =>
    createCardFilterState(cardId, cardName)
  );
  const [result, setResult] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSearchText(query);
    setPlayerText(playerName);
    setTournamentText(tournamentName);
    setCardInput((current) => {
      const currentCardId = getRegulationCardIds(current)[0] || "";
      const currentCard = current.selectedCards.find(
        (card) => String(card?.cardId || "") === cardId
      );
      if (
        currentCardId === cardId &&
        (!cardName || String(currentCard?.name || "") === cardName)
      ) {
        return current;
      }
      return createCardFilterState(cardId, cardName, current.selectedCards);
    });
  }, [cardId, cardName, format, playerName, query, tournamentName]);

  useEffect(() => {
    let isActive = true;
    setIsLoaded(false);
    setErrorMessage("");

    fetchPublicDecks({
      page,
      query,
      format,
      cardId,
      playerName,
      tournamentName,
      authMode,
    })
      .then((payload) => {
        if (!isActive) return;
        setResult(payload);
      })
      .catch((error) => {
        if (!isActive) return;
        setErrorMessage(error.message);
        setResult({ items: [], total: 0, page, pageSize: 20 });
      })
      .finally(() => {
        if (isActive) setIsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode, cardId, format, page, playerName, query, tournamentName]);

  const updateCardInput = useCallback((updater) => {
    setCardInput((current) =>
      typeof updater === "function" ? updater(current) : updater
    );
  }, []);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize || 1));
  const activeFormatGroup = format
    ? deriveFormatGroup(format)
    : FORMAT_GROUP_KEYS.ALL;
  const activeFormatConfig = PUBLIC_DECK_FORMAT_GROUPS.find(
    ({ key }) => key === activeFormatGroup
  );
  const formatDetailOptions = activeFormatConfig?.formatNames.includes(format)
    ? activeFormatConfig.formatNames
    : [format, ...(activeFormatConfig?.formatNames || [])].filter(Boolean);

  const navigateToPage = useCallback(
    (nextPage) => {
      const nextParams = new URLSearchParams(location.search);
      nextParams.set("page", String(nextPage));
      if (!nextParams.get("query")) nextParams.delete("query");
      navigate(`/decks?${nextParams.toString()}`);
      window.scrollTo(0, 0);
    },
    [location.search, navigate]
  );

  const navigateToFormat = useCallback(
    (nextFormat) => {
      const nextParams = new URLSearchParams(location.search);
      if (nextFormat) nextParams.set("format", nextFormat);
      else nextParams.delete("format");
      nextParams.set("page", "1");
      if (!nextParams.get("query")) nextParams.delete("query");
      navigate(`/decks?${nextParams.toString()}`);
    },
    [location.search, navigate]
  );

  const handleFormatTabChange = (groupKey) => {
    const nextFormat =
      groupKey === FORMAT_GROUP_KEYS.ALL
        ? ""
        : groupKey === activeFormatGroup && format
          ? format
          : getDefaultFormatName(groupKey, PUBLIC_DECK_FORMAT_GROUPS);
    navigateToFormat(nextFormat);
  };

  const handleFormatTabKeyDown = (event, currentIndex) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % PUBLIC_DECK_FORMAT_GROUPS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + PUBLIC_DECK_FORMAT_GROUPS.length) %
        PUBLIC_DECK_FORMAT_GROUPS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PUBLIC_DECK_FORMAT_GROUPS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex];
    nextTab?.focus();
    handleFormatTabChange(PUBLIC_DECK_FORMAT_GROUPS[nextIndex].key);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const nextParams = new URLSearchParams(location.search);
    const selectedCard = cardInput.selectedCards[0];
    const selectedCardId = getRegulationCardIds(cardInput)[0] || "";
    if (searchText.trim()) nextParams.set("query", searchText.trim());
    else nextParams.delete("query");
    if (selectedCardId) {
      nextParams.set("cardId", selectedCardId);
      if (selectedCard?.name) nextParams.set("cardName", selectedCard.name);
      else nextParams.delete("cardName");
    } else {
      nextParams.delete("cardId");
      nextParams.delete("cardName");
    }
    if (playerText.trim()) nextParams.set("playerName", playerText.trim());
    else nextParams.delete("playerName");
    if (tournamentText.trim()) nextParams.set("tournamentName", tournamentText.trim());
    else nextParams.delete("tournamentName");
    nextParams.set("page", "1");
    navigate(`/decks?${nextParams.toString()}`);
  };

  const hasSearchConditions = [
    query,
    format,
    cardId,
    playerName,
    tournamentName,
  ].some(
    (value) => String(value || "").trim()
  );

  const pagination = totalPages > 1 && (
    <div className="pagination">
      <button type="button" onClick={() => navigateToPage(page - 1)} disabled={page <= 1}>
        前へ
      </button>
      <span>{`${page} / ${totalPages}`}</span>
      <button type="button" onClick={() => navigateToPage(page + 1)} disabled={page >= totalPages}>
        次へ
      </button>
    </div>
  );

  return (
    <main id="search-results-container" className={compact ? "public-decks compact" : "public-decks"}>
      <div className="search-results-toolbar">
        <div className={compact ? "search-results-heading-row" : undefined}>
          <h1>公開デッキ</h1>
          <div className="search-results-summary">{`${result.total}件 / 新着順`}</div>
        </div>
        <Link className="results-link-button primary" to="/deck">
          デッキ作成
        </Link>
      </div>

      <section className="public-decks-format-filter" aria-label="フォーマット絞り込み">
        <div className="public-decks-format-tabs" role="tablist" aria-label="フォーマット">
          {PUBLIC_DECK_FORMAT_GROUPS.map(({ key, label }, index) => {
            const isActive = activeFormatGroup === key;
            return (
              <button
                key={key}
                id={`public-decks-format-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="public-decks-results"
                tabIndex={isActive ? 0 : -1}
                className={isActive ? "public-decks-format-tab active" : "public-decks-format-tab"}
                onClick={() => handleFormatTabChange(key)}
                onKeyDown={(event) => handleFormatTabKeyDown(event, index)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {activeFormatGroup === FORMAT_GROUP_KEYS.TENSAKU ? (
          <label className="public-decks-format-detail">
            <span>開催回</span>
            <select
              value={format}
              onChange={(event) => navigateToFormat(event.target.value)}
              aria-label="添削杯の開催回"
            >
              {formatDetailOptions.map((formatName) => (
                <option key={formatName} value={formatName}>
                  {getTensakuRoundLabel(formatName)}
                </option>
              ))}
            </select>
          </label>
        ) : activeFormatGroup === FORMAT_GROUP_KEYS.OTHER ? (
          <label className="public-decks-format-detail">
            <span>フォーマット</span>
            <select
              value={format}
              onChange={(event) => navigateToFormat(event.target.value)}
              aria-label="その他のフォーマット"
            >
              {formatDetailOptions.map((formatName) => (
                <option key={formatName} value={formatName}>
                  {formatName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <form
        className="public-decks-search"
        onSubmit={handleSearch}
        aria-label="公開デッキ検索"
      >
        <div className="public-decks-search-fields">
          <label>
            <span>キーワード</span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="デッキ名・説明などを検索"
            />
          </label>
          <label>
            <span>プレイヤー名</span>
            <input
              value={playerText}
              onChange={(event) => setPlayerText(event.target.value)}
              placeholder="プレイヤー名を入力"
            />
          </label>
          <label>
            <span>大会名</span>
            <input
              value={tournamentText}
              onChange={(event) => setTournamentText(event.target.value)}
              placeholder="大会名を入力"
              aria-describedby="public-decks-tournament-filter-help"
            />
          </label>
        </div>

        <p id="public-decks-tournament-filter-help" className="public-decks-filter-help">
          大会名は大会デッキのみを対象に検索します。保存デッキは大会情報を持たないため対象外です。
        </p>

        <div className="public-decks-card-filter">
          <RegulationCardInput
            idPrefix="public-decks-card"
            label="採用カード"
            value={cardInput}
            onChange={updateCardInput}
            allowBulk={false}
            maxSelectedCards={1}
          />
          <p className="public-decks-filter-help">
            カード名で検索し、候補から1枚選択してください。
          </p>
        </div>

        <div className="public-decks-search-actions">
          <button type="submit" className="deck-action-button primary">
            検索
          </button>
        </div>
      </form>

      <div
        id="public-decks-results"
        role="tabpanel"
        aria-labelledby={`public-decks-format-tab-${activeFormatGroup}`}
      >
        {pagination}

        {!isLoaded ? (
          <div className="results-empty-state">読み込み中...</div>
        ) : errorMessage ? (
          <div className="results-empty-state">{errorMessage}</div>
        ) : result.items.length === 0 ? (
          <div className="results-empty-state">
            {hasSearchConditions ? "検索結果がありません。" : "公開デッキはありません。"}
          </div>
        ) : (
          <div className="results-list">
            {result.items.map((deck) => (
              <article key={deck.id} className="public-deck-card">
                <div>
                  <h2>
                    <DeckColorDots items={deck.items} />
                    <Link to={`/decks/${deck.id}`}>{deck.title}</Link>
                    <span
                      className={
                        isTournamentDeck(deck)
                          ? "public-deck-source-badge tournament"
                          : "public-deck-source-badge saved"
                      }
                    >
                      {isTournamentDeck(deck) ? "大会デッキ" : "保存デッキ"}
                    </span>
                    {deck.format ? (
                      <span className="public-deck-format-badge">{deck.format}</span>
                    ) : null}
                  </h2>
                  <p>{deck.description || "説明はありません。"}</p>
                  {isTournamentDeck(deck) && deck.tournament ? (
                    <div className="public-deck-tournament-summary">
                      <Link to={`/tournaments/${deck.tournament.id}`}>
                        {deck.tournament.title}
                      </Link>
                      {getTournamentRank(deck) != null ? (
                        <span>{`${getTournamentRank(deck)}位`}</span>
                      ) : null}
                      {getTournamentParticipantCount(deck) != null ? (
                        <span>{`参加${getTournamentParticipantCount(deck)}人`}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="public-deck-meta">
                  <OwnerLink owner={deck.owner} />
                  <span>{formatDeckItemsCount(deck.items)}</span>
                  <span>{formatDate(deck.publishedAt || deck.updatedAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {pagination}
      </div>
    </main>
  );
}
