import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CompactDeckSearchForm from "../components/CompactDeckSearchForm";
import DeckSearchResults from "../components/DeckSearchResults";
import CardImage from "../components/CardImage";
import BasicGAddDialog from "../components/BasicGAddDialog";
import DeckExportDialog from "../components/DeckExportDialog";
import DeckLoadDialog from "../components/DeckLoadDialog";
import DeckSaveDialog from "../components/DeckSaveDialog";
import { useAuth } from "../context/AuthContext";
import { useDeck } from "../context/DeckContext";
import { useSavedDecks } from "../hooks/useSavedDecks";
import { getCardCode, getCardTypeLabel } from "../utils/cardImages";
import { createBasicGCard } from "../utils/basicG";
import { trackEvent } from "../utils/analytics";
import {
  buildDeckCostLabel,
  buildDeckExport,
  buildDefaultDeckTitle,
  buildTypeSummary,
  compareDeckItems,
  compareDeckItemsForExport,
  DECK_TYPE_ORDER,
  getDeckNameClassName,
  groupDeckItemsByType,
} from "../utils/deckExport";
import "./DeckBuilder.css";

const DeckBuilder = ({ compact = false }) => {
  const deckPageRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    items,
    mainItems,
    sideItems,
    mainCount,
    sideCount,
    addCard,
    setCardCount,
    removeCard,
    moveCard,
    clearDeck,
    replaceDeck,
  } = useDeck();
  const { savedDecks, isLoading, isSaving, error, saveDeck, removeDeck, setPublication } =
    useSavedDecks();

  const [saveMessage, setSaveMessage] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [deletingDeckId, setDeletingDeckId] = useState("");
  const [publishingDeckId, setPublishingDeckId] = useState("");
  const [deckViewMode, setDeckViewMode] = useState("detail");
  const [isBasicGDialogOpen, setIsBasicGDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [mobileActivePane, setMobileActivePane] = useState(() =>
    location.search ? "search" : "deck"
  );

  const typeSummary = useMemo(() => buildTypeSummary(items), [items]);
  const groupedMainItems = useMemo(() => groupDeckItemsByType(mainItems), [mainItems]);
  const orderedMainExportItems = useMemo(
    () => [...mainItems].sort(compareDeckItemsForExport),
    [mainItems]
  );
  const sortedSideItems = useMemo(() => [...sideItems].sort(compareDeckItems), [sideItems]);
  const orderedSideExportItems = useMemo(
    () => [...sideItems].sort(compareDeckItemsForExport),
    [sideItems]
  );
  const exportText = useMemo(
    () => buildDeckExport(groupedMainItems, sortedSideItems),
    [groupedMainItems, sortedSideItems]
  );
  const typeSummaryText = useMemo(
    () => DECK_TYPE_ORDER.map((type) => `${type} ${typeSummary[type] || 0}`).join(" / "),
    [typeSummary]
  );
  const selectedDeck = useMemo(
    () => savedDecks.find((deck) => deck.id === selectedDeckId) || null,
    [savedDecks, selectedDeckId]
  );

  // モバイルでは「デッキ」「検索」ペインをタブで切り替える
  const deckLayoutClassName = compact
    ? `deck-layout deck-layout-mobile-pane-${mobileActivePane}`
    : "deck-layout";

  const handleDeckSearch = useCallback(
    ({ queryString }) => {
      setMobileActivePane("search");
      navigate({
        pathname: location.pathname,
        search: queryString ? `?${queryString}` : "",
      });
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    if (!deckTitle && items.length > 0) {
      setDeckTitle(buildDefaultDeckTitle());
    }
  }, [deckTitle, items.length]);

  useEffect(() => {
    if (selectedDeckId && !selectedDeck) {
      setSelectedDeckId("");
    }
  }, [selectedDeck, selectedDeckId]);

  useEffect(() => {
    const updateViewportOffset = () => {
      if (!deckPageRef.current) return;
      const topOffset = Math.max(deckPageRef.current.getBoundingClientRect().top, 0);
      deckPageRef.current.style.setProperty("--deck-page-top-offset", `${topOffset}px`);
    };

    updateViewportOffset();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateViewportOffset) : null;

    if (resizeObserver) {
      resizeObserver.observe(document.body);
    }

    window.addEventListener("resize", updateViewportOffset);
    return () => {
      window.removeEventListener("resize", updateViewportOffset);
      resizeObserver?.disconnect();
    };
  }, []);

  // デスクトップ表示（幅1101px以上）ではページ全体のスクロールをロックする
  useEffect(() => {
    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousBodyOverflow = bodyStyle.overflow;

    if (compact) {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
      return () => {
        htmlStyle.overflow = previousHtmlOverflow;
        bodyStyle.overflow = previousBodyOverflow;
      };
    }

    const mediaQuery = window.matchMedia("(min-width: 1101px)");

    const syncScrollLock = () => {
      if (mediaQuery.matches) {
        htmlStyle.overflow = "hidden";
        bodyStyle.overflow = "hidden";
      } else {
        htmlStyle.overflow = previousHtmlOverflow;
        bodyStyle.overflow = previousBodyOverflow;
      }
    };

    syncScrollLock();

    const handleChange = () => syncScrollLock();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [compact]);

  const clearSaveMessageSoon = () => {
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  const handleSaveAsDeck = async (nextTitle) => {
    try {
      const savedDeck = await saveDeck({
        deckId: "",
        title: nextTitle,
        items,
      });
      trackEvent("deck_save", {
        save_mode: "new",
        main_count: mainCount,
        side_count: sideCount,
      });
      setSelectedDeckId(savedDeck.id);
      setDeckTitle(savedDeck.title);
      setSaveMessage("デッキを保存しました。");
      setIsSaveDialogOpen(false);
    } catch (saveError) {
      setSaveMessage(saveError.message);
    }
    clearSaveMessageSoon();
  };

  const handleOverwriteDeck = async () => {
    if (!selectedDeck) return;

    try {
      const savedDeck = await saveDeck({
        deckId: selectedDeck.id,
        title: selectedDeck.title,
        items,
      });
      trackEvent("deck_save", {
        save_mode: "overwrite",
        main_count: mainCount,
        side_count: sideCount,
      });
      setSelectedDeckId(savedDeck.id);
      setDeckTitle(savedDeck.title);
      setSaveMessage("デッキを上書き保存しました。");
      setIsSaveDialogOpen(false);
    } catch (saveError) {
      setSaveMessage(saveError.message);
    }
    clearSaveMessageSoon();
  };

  const handleLoadDeck = (deck) => {
    trackEvent("deck_load", {
      main_count: Array.isArray(deck?.items)
        ? deck.items.reduce((sum, item) => (item?.zone === "side" ? sum : sum + Number(item?.count || 0)), 0)
        : 0,
      side_count: Array.isArray(deck?.items)
        ? deck.items.reduce((sum, item) => (item?.zone === "side" ? sum + Number(item?.count || 0) : sum), 0)
        : 0,
    });
    replaceDeck(deck.items);
    setSelectedDeckId(deck.id);
    setDeckTitle(deck.title);
    setSaveMessage(`「${deck.title}」を読み込みました。`);
    setIsLoadDialogOpen(false);
    clearSaveMessageSoon();
  };

  const handleDeleteSavedDeck = async (deckId) => {
    try {
      setDeletingDeckId(String(deckId));
      await removeDeck(deckId);
      trackEvent("deck_delete", {
        delete_from: "saved_decks",
      });
      if (String(deckId) === selectedDeckId) {
        setSelectedDeckId("");
      }
      setSaveMessage("保存済みデッキを削除しました。");
    } catch (removeError) {
      setSaveMessage(removeError.message);
    } finally {
      setDeletingDeckId("");
      clearSaveMessageSoon();
    }
  };

  const handlePublicationChange = async ({ deckId, isPublic, description }) => {
    try {
      setPublishingDeckId(String(deckId));
      await setPublication({ deckId, isPublic, description });
      setSaveMessage(isPublic ? "デッキを公開しました。" : "デッキを非公開にしました。");
    } catch (publicationError) {
      setSaveMessage(publicationError.message);
      throw publicationError;
    } finally {
      setPublishingDeckId("");
      clearSaveMessageSoon();
    }
  };

  const handleAddBasicG = (entries) => {
    trackEvent("deck_add_basic_g", {
      selected_colors: Array.isArray(entries) ? entries.length : 0,
      total_added: Array.isArray(entries)
        ? entries.reduce((sum, entry) => sum + Number(entry?.count || 0), 0)
        : 0,
    });
    entries.forEach((entry) => {
      addCard(createBasicGCard(entry.colorKey, entry.imageIndex), entry.count, "main");
    });
    setIsBasicGDialogOpen(false);
  };

  const renderDeckCard = (item, zone, moveTarget, moveLabel) => {
    const card = item.card;
    const cardCode = getCardCode(card);
    const cardTypeLabel = getCardTypeLabel(card);
    const cardLabel = [cardCode, card.name].filter(Boolean).join(" ");
    const cardCost = buildDeckCostLabel(card);
    const nameClassName = getDeckNameClassName(card.name);

    if (deckViewMode === "image") {
      return (
        <article key={`${zone}-${item.cardId}`} className="deck-card-image" title={cardLabel}>
          <div className="deck-card-image-media">
            <CardImage card={card} compact />
            <span className="deck-card-image-count">{item.count}</span>
          </div>
          <div className="deck-card-image-controls">
            <button
              className="deck-count-button"
              onClick={() => setCardCount(item.cardId, item.count - 1, zone)}
              aria-label={`${card.name} の枚数を減らす`}
            >
              -
            </button>
            <button
              className="deck-count-button"
              onClick={() => setCardCount(item.cardId, item.count + 1, zone)}
              aria-label={`${card.name} の枚数を増やす`}
            >
              +
            </button>
          </div>
          <div className="deck-card-image-actions">
            <button className="deck-secondary-button" onClick={() => moveCard(item.cardId, zone, moveTarget)}>
              {moveLabel}
            </button>
            <button className="deck-remove-button" onClick={() => removeCard(item.cardId, zone)}>
              削除
            </button>
          </div>
        </article>
      );
    }

    return (
      <article key={`${zone}-${item.cardId}`} className="deck-card-compact">
        <div className="deck-card-compact-main">
          <div className="deck-card-compact-media">
            <CardImage card={card} compact />
          </div>
          <div className="deck-card-compact-body">
            <div className="deck-card-compact-meta">
              <span>{cardTypeLabel}</span>
              <span>{cardCode}</span>
            </div>
            <div className="deck-card-compact-cost">{cardCost}</div>
            <div className={nameClassName}>{card.name}</div>
          </div>
        </div>

        <div className="deck-card-compact-controls">
          <button
            className="deck-count-button"
            onClick={() => setCardCount(item.cardId, item.count - 1, zone)}
            aria-label={`${card.name} の枚数を減らす`}
          >
            -
          </button>
          <input
            className="deck-count-input"
            type="number"
            min="0"
            max="99"
            value={item.count}
            onChange={(event) => setCardCount(item.cardId, event.target.value, zone)}
          />
          <button
            className="deck-count-button"
            onClick={() => setCardCount(item.cardId, item.count + 1, zone)}
            aria-label={`${card.name} の枚数を増やす`}
          >
            +
          </button>
        </div>

        <div className="deck-card-compact-footer-actions">
          <button className="deck-secondary-button" onClick={() => moveCard(item.cardId, zone, moveTarget)}>
            {moveLabel}
          </button>
          <button className="deck-remove-button" onClick={() => removeCard(item.cardId, zone)}>
            削除
          </button>
        </div>
      </article>
    );
  };

  const renderDeckZone = (zone, title, count, limit, zoneItems) => {
    const moveTarget = zone === "main" ? "side" : "main";
    const moveLabel = zone === "main" ? "サイドへ" : "メインへ";
    const isOverLimit = count > limit;
    const emptyText =
      zone === "main"
        ? "検索結果からメインデッキに追加すると、ここに表示されます。"
        : "検索結果からサイドボードに追加すると、ここに表示されます。";

    return (
      <section key={zone} className="deck-card-zone">
        <div className="deck-card-zone-header">
          <div className="deck-card-zone-heading">
            <h3>{title}</h3>
            {zone === "main" ? (
              <button
                type="button"
                className="deck-secondary-button deck-basic-g-button"
                onClick={() => setIsBasicGDialogOpen(true)}
              >
                基本G追加
              </button>
            ) : null}
          </div>
          <strong className={isOverLimit ? "deck-zone-count over-limit" : "deck-zone-count"}>
            {`${count} / ${limit}`}
          </strong>
        </div>

        {zoneItems.length === 0 ? (
          <div className="deck-card-zone-empty">{emptyText}</div>
        ) : (
          <div
            className={
              deckViewMode === "image"
                ? "deck-card-list deck-card-list-image"
                : "deck-card-list deck-card-list-detail"
            }
          >
            {zoneItems.map((item) => renderDeckCard(item, zone, moveTarget, moveLabel))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="deck-page" ref={deckPageRef}>
      {compact ? (
        <div className="deck-mobile-tabs" aria-label="モバイル表示切替">
          <button
            type="button"
            className={mobileActivePane === "deck" ? "deck-mobile-tab active" : "deck-mobile-tab"}
            onClick={() => setMobileActivePane("deck")}
          >
            デッキ
          </button>
          <button
            type="button"
            className={mobileActivePane === "search" ? "deck-mobile-tab active" : "deck-mobile-tab"}
            onClick={() => setMobileActivePane("search")}
          >
            検索
          </button>
        </div>
      ) : null}

      <div className="deck-layout-shell">
        <div className={deckLayoutClassName}>
          <aside className="deck-sidebar">
            <section className="deck-sidebar-tools">
              <div className="deck-sidebar-tools-row">
                <div className="deck-save-actions">
                  <button
                    className="deck-primary-button"
                    onClick={() => setIsSaveDialogOpen(true)}
                    disabled={!isAuthenticated || items.length === 0 || isSaving}
                  >
                    保存
                  </button>
                  <button
                    className="deck-secondary-button"
                    onClick={() => {
                      trackEvent("deck_load_dialog_open", {
                        saved_deck_count: savedDecks.length,
                      });
                      setIsLoadDialogOpen(true);
                    }}
                    disabled={!isAuthenticated || isLoading}
                  >
                    読み込み
                  </button>
                </div>

                <div className="deck-summary-actions">
                  <button
                    className="deck-secondary-button"
                    onClick={() => {
                      trackEvent("deck_export_dialog_open", {
                        main_count: mainCount,
                        side_count: sideCount,
                      });
                      setIsExportDialogOpen(true);
                    }}
                    disabled={items.length === 0}
                  >
                    書き出し
                  </button>
                  <button
                    className="deck-danger-button"
                    onClick={clearDeck}
                    disabled={items.length === 0}
                  >
                    クリア
                  </button>
                </div>
              </div>

              {selectedDeck ? <p className="deck-panel-note">{`保存先: ${selectedDeck.title}`}</p> : null}
              {!isAuthenticated ? (
                <p className="deck-panel-note">保存と読み込みはログイン後に利用できます。</p>
              ) : null}
              {saveMessage ? <div className="deck-copy-message">{saveMessage}</div> : null}
              {error ? <div className="deck-panel-error">{error}</div> : null}
            </section>

            <section className="deck-current-panel">
              <div className="deck-current-toolbar">
                <div className="deck-current-toolbar-left">
                  <h2 className="deck-main-heading">メインデッキ</h2>
                  <button
                    type="button"
                    className="deck-secondary-button deck-basic-g-button"
                    onClick={() => setIsBasicGDialogOpen(true)}
                  >
                    基本G追加
                  </button>
                </div>
                <div className="search-results-view-toggle" aria-label="デッキ表示切替">
                  <button
                    type="button"
                    className={deckViewMode === "detail" ? "active" : ""}
                    onClick={() => setDeckViewMode("detail")}
                  >
                    2列
                  </button>
                  <button
                    type="button"
                    className={deckViewMode === "image" ? "active" : ""}
                    onClick={() => setDeckViewMode("image")}
                  >
                    画像のみ
                  </button>
                </div>
              </div>

              <div className="deck-current-summary-row">
                {typeSummaryText ? <p className="deck-panel-note deck-type-summary">{typeSummaryText}</p> : null}
                <strong className={mainCount > 50 ? "deck-zone-count over-limit" : "deck-zone-count"}>
                  {`${mainCount} / 50`}
                </strong>
              </div>

              <div className="deck-cards-panel">
                {renderDeckZone("main", "メインデッキ", mainCount, 50, orderedMainExportItems)}
                {renderDeckZone("side", "サイドボード", sideCount, 10, orderedSideExportItems)}
              </div>
            </section>
          </aside>

          <section className="deck-workbench">
            <section className="deck-search-form-panel">
              <div className="deck-panel-header">
                <h2>カード検索</h2>
              </div>
              <CompactDeckSearchForm onSearch={compact ? handleDeckSearch : undefined} />
            </section>

            <DeckSearchResults compact={compact} />
          </section>
        </div>
      </div>

      <BasicGAddDialog
        open={isBasicGDialogOpen}
        onClose={() => setIsBasicGDialogOpen(false)}
        onAdd={handleAddBasicG}
        mobile={compact}
      />
      <DeckSaveDialog
        open={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onOverwrite={handleOverwriteDeck}
        onSaveAs={handleSaveAsDeck}
        selectedDeck={selectedDeck}
        currentTitle={deckTitle || buildDefaultDeckTitle()}
        isSaving={isSaving}
        errorMessage={error}
      />
      <DeckLoadDialog
        open={isLoadDialogOpen}
        onClose={() => setIsLoadDialogOpen(false)}
        savedDecks={savedDecks}
        initialDeckId={selectedDeckId}
        onLoad={handleLoadDeck}
        onDelete={handleDeleteSavedDeck}
        onPublicationChange={handlePublicationChange}
        isLoading={isLoading}
        isDeleting={Boolean(deletingDeckId)}
        isPublishing={Boolean(publishingDeckId)}
        publishingDeckId={publishingDeckId}
        deletingDeckId={deletingDeckId}
        errorMessage={error}
      />
      <DeckExportDialog
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        mainItems={orderedMainExportItems}
        sideItems={orderedSideExportItems}
        mainCount={mainCount}
        sideCount={sideCount}
        exportText={exportText}
      />
    </div>
  );
};

export default DeckBuilder;
