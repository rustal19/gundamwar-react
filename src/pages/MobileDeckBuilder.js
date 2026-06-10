import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CompactDeckSearchForm from "../components/CompactDeckSearchForm";
import MobileDeckSearchResults from "../components/MobileDeckSearchResults";
import CardImage from "../components/CardImage";
import BasicGAddDialog from "../components/BasicGAddDialog";
import DeckExportDialog from "../components/DeckExportDialog";
import DeckLoadDialog from "../components/DeckLoadDialog";
import DeckSaveDialog from "../components/DeckSaveDialog";
import { useAuth } from "../context/AuthContext";
import { useDeck } from "../context/DeckContext";
import { useSavedDecks } from "../hooks/useSavedDecks";
import { getCardCode, getCardTypeLabel, isBasicGCard } from "../utils/cardImages";
import { createBasicGCard } from "../utils/basicG";
import { trackEvent } from "../utils/analytics";
import "./DeckBuilder.css";

const DECK_TYPE_ORDER = ["ACE", "UNIT", "CHARACTER", "COMMAND", "OPERATION", "G"];
const DECK_TYPE_ORDER_INDEX = DECK_TYPE_ORDER.reduce((map, key, index) => {
  map[key] = index;
  return map;
}, {});
const CARD_TYPE_KEY_MAP = {
  1: "UNIT",
  2: "CHARACTER",
  3: "COMMAND",
  4: "OPERATION",
  10: "G",
  11: "ACE",
};
const DECK_EXPORT_SECTION_LABELS = {
  ACE: "ACE",
  UNIT: "UNIT",
  CHARACTER: "CHARACTER",
  COMMAND: "COMMAND",
  OPERATION: "OPERATION",
  G: "GENERATION",
};

function isDeckExportBasicG(card) {
  return Boolean(card?.basicGColorKey) || String(card?.cardId || "").startsWith("basic-g-");
}

function normalizeDeckExportColor(value) {
  return String(value || "")
    .trim()
    .replace(/[・･]+/g, "")
    .replace(/\s+/g, "");
}

function getDeckExportColorLabel(card, typeKey) {
  if (typeKey === "G") {
    if (isDeckExportBasicG(card)) {
      return normalizeDeckExportColor(card?.sp_power_color1_name || card?.color || "");
    }
    return "特G";
  }

  const directColor = normalizeDeckExportColor(card?.color || "");
  if (directColor) return directColor;

  const primary = normalizeDeckExportColor(card?.sp_power_color1_name || "");
  const secondary = normalizeDeckExportColor(card?.sp_power_color2_name || "");
  return `${primary}${secondary}`.trim();
}

function getDeckExportCode(card, typeKey) {
  if (typeKey === "G" && isDeckExportBasicG(card)) {
    return "G-*";
  }
  return getCardCode(card) || "-";
}

function getDeckExportName(card, typeKey) {
  if (typeKey === "G" && isDeckExportBasicG(card)) {
    return "基本G";
  }
  return card?.name || `Card ${card?.cardId || ""}`.trim();
}

function buildDeckExportEntries(items) {
  const mergedEntries = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const typeKey = getDeckSummaryTypeKey(item?.card);
    if (!typeKey) return;

    const colorLabel = getDeckExportColorLabel(item.card, typeKey);
    const code = getDeckExportCode(item.card, typeKey);
    const name = getDeckExportName(item.card, typeKey);
    const mergeKey = [typeKey, colorLabel, code, name].join("|");
    const currentCount = Number(item?.count || 0);
    if (currentCount <= 0) return;

    if (mergedEntries.has(mergeKey)) {
      mergedEntries.get(mergeKey).count += currentCount;
      return;
    }

    mergedEntries.set(mergeKey, {
      typeKey,
      count: currentCount,
      colorLabel,
      code,
      name,
      sortCode: getCardCode(item.card) || code,
    });
  });

  return Array.from(mergedEntries.values()).sort((left, right) => {
    const leftIndex =
      left.typeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, left.typeKey)
        ? DECK_TYPE_ORDER_INDEX[left.typeKey]
        : Number.MAX_SAFE_INTEGER;
    const rightIndex =
      right.typeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, right.typeKey)
        ? DECK_TYPE_ORDER_INDEX[right.typeKey]
        : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    const codeComparison = String(left.sortCode || "").localeCompare(
      String(right.sortCode || ""),
      "ja",
      { numeric: true }
    );
    if (codeComparison !== 0) return codeComparison;

    return String(left.name || "").localeCompare(String(right.name || ""), "ja", {
      numeric: true,
    });
  });
}

function formatDeckExportLine(entry) {
  return [entry.count, entry.colorLabel, entry.code, entry.name].filter(Boolean).join(" ");
}

function inferDeckTypeKeyFromCardNumber(card) {
  const cardNumber1 = card?.cardNumber1 ? String(card.cardNumber1).trim().toUpperCase() : "";
  if (!cardNumber1) return "";

  if (cardNumber1 === "ACE") return "ACE";
  if (cardNumber1 === "G" || cardNumber1.startsWith("SG") || cardNumber1.startsWith("SPG")) {
    return "G";
  }
  if (
    cardNumber1 === "U" ||
    cardNumber1.startsWith("VU") ||
    cardNumber1.startsWith("SU") ||
    cardNumber1.startsWith("UU")
  ) {
    return "UNIT";
  }
  if (cardNumber1 === "CH" || cardNumber1.startsWith("VCH")) {
    return "CHARACTER";
  }
  if (
    cardNumber1 === "C" ||
    cardNumber1.startsWith("VC") ||
    cardNumber1.startsWith("SPC") ||
    cardNumber1.startsWith("SC")
  ) {
    return "COMMAND";
  }
  if (cardNumber1 === "O" || cardNumber1.startsWith("VO") || cardNumber1.startsWith("SO")) {
    return "OPERATION";
  }

  return "";
}

function getDeckSummaryTypeKey(card) {
  const typeName = card?.card_type_name ? String(card.card_type_name).trim().toUpperCase() : "";
  const rawCardType = card?.cardType ?? card?.card_type ?? "";
  const numericCardType = Number(rawCardType);

  if (typeName === "GENERATION" || isBasicGCard(card)) {
    return "G";
  }

  if (DECK_TYPE_ORDER.includes(typeName)) {
    return typeName;
  }

  if (Number.isFinite(numericCardType) && CARD_TYPE_KEY_MAP[numericCardType]) {
    return CARD_TYPE_KEY_MAP[numericCardType];
  }

  return inferDeckTypeKeyFromCardNumber(card);
}

function buildTypeSummary(items) {
  const summary = DECK_TYPE_ORDER.reduce((map, key) => {
    map[key] = 0;
    return map;
  }, {});

  items.forEach((item) => {
    const key = getDeckSummaryTypeKey(item.card);
    if (!key) return;
    summary[key] += item.count;
  });

  return summary;
}

function compareDeckItems(leftItem, rightItem) {
  const leftCode = getCardCode(leftItem?.card);
  const rightCode = getCardCode(rightItem?.card);
  const codeComparison = leftCode.localeCompare(rightCode, "ja", { numeric: true });
  if (codeComparison !== 0) return codeComparison;

  const leftName = String(leftItem?.card?.name || "");
  const rightName = String(rightItem?.card?.name || "");
  const nameComparison = leftName.localeCompare(rightName, "ja", { numeric: true });
  if (nameComparison !== 0) return nameComparison;

  return String(leftItem?.cardId || "").localeCompare(String(rightItem?.cardId || ""), "ja", {
    numeric: true,
  });
}

function compareDeckItemsForExport(leftItem, rightItem) {
  const leftTypeKey = getDeckSummaryTypeKey(leftItem?.card);
  const rightTypeKey = getDeckSummaryTypeKey(rightItem?.card);
  const leftIndex =
    leftTypeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, leftTypeKey)
      ? DECK_TYPE_ORDER_INDEX[leftTypeKey]
      : Number.MAX_SAFE_INTEGER;
  const rightIndex =
    rightTypeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, rightTypeKey)
      ? DECK_TYPE_ORDER_INDEX[rightTypeKey]
      : Number.MAX_SAFE_INTEGER;

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return compareDeckItems(leftItem, rightItem);
}

function groupDeckItemsByType(items) {
  const groups = DECK_TYPE_ORDER.reduce((map, type) => {
    map[type] = [];
    return map;
  }, {});

  items.forEach((item) => {
    const typeKey = getDeckSummaryTypeKey(item.card);
    if (!typeKey || !groups[typeKey]) return;
    groups[typeKey].push(item);
  });

  DECK_TYPE_ORDER.forEach((type) => {
    groups[type].sort(compareDeckItems);
  });

  return groups;
}

function buildDeckExport(mainGroups, sideItems) {
  const orderedMainItems = DECK_TYPE_ORDER.flatMap((type) => mainGroups[type] || []);
  const mainEntries = buildDeckExportEntries(orderedMainItems);
  const sideEntries = buildDeckExportEntries(sideItems);
  const lines = [];

  DECK_TYPE_ORDER.forEach((type) => {
    const sectionEntries = mainEntries.filter((entry) => entry.typeKey === type);
    if (sectionEntries.length === 0) return;

    if (lines.length > 0) {
      lines.push("");
    }

    lines.push(DECK_EXPORT_SECTION_LABELS[type] || type);
    sectionEntries.forEach((entry) => {
      lines.push(formatDeckExportLine(entry));
    });
  });

  if (sideEntries.length > 0) {
    lines.push("");
    lines.push("サイドボード");
    sideEntries.forEach((entry) => {
      lines.push(formatDeckExportLine(entry));
    });
  }

  return lines.join("\n").trim();
}

function buildDefaultDeckTitle() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} のデッキ`;
}

function buildDeckCostLabel(card) {
  if (isBasicGCard(card)) {
    return "Generation";
  }

  const primary = [card?.sp_power_color1_name, card?.spPowerCost1].filter(Boolean).join(" ").trim();
  const secondary = card?.sp_power_color2_name
    ? [card.sp_power_color2_name, card?.spPowerCost2].filter(Boolean).join(" ").trim()
    : "";
  const total = card?.totalCost || "-";
  const resource = card?.resourceCost || "-";

  return `${primary || "-"}${secondary ? ` / ${secondary}` : ""} - ${total} - ${resource}`;
}

function getDeckNameClassName(name) {
  const length = String(name || "").length;
  if (length >= 34) return "deck-card-compact-name deck-card-compact-name-tightest";
  if (length >= 26) return "deck-card-compact-name deck-card-compact-name-tight";
  return "deck-card-compact-name";
}

const DeckBuilder = () => {
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
  const { savedDecks, isLoading, isSaving, error, saveDeck, removeDeck } = useSavedDecks();

  const [saveMessage, setSaveMessage] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [deletingDeckId, setDeletingDeckId] = useState("");
  const [deckViewMode, setDeckViewMode] = useState("detail");
  const [mobileActivePane, setMobileActivePane] = useState(() =>
    location.search ? "search" : "deck"
  );
  const [isBasicGDialogOpen, setIsBasicGDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);

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
  const deckLayoutClassName = useMemo(
    () =>
      ["deck-layout", `deck-layout-mobile-pane-${mobileActivePane}`]
        .filter(Boolean)
        .join(" "),
    [mobileActivePane]
  );

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

  useEffect(() => {
    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousBodyOverflow = bodyStyle.overflow;

    htmlStyle.overflow = previousHtmlOverflow;
    bodyStyle.overflow = previousBodyOverflow;

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
    };
  }, []);

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
              <CompactDeckSearchForm onSearch={handleDeckSearch} />
            </section>

            <MobileDeckSearchResults />
          </section>
        </div>
      </div>

      <BasicGAddDialog
        open={isBasicGDialogOpen}
        onClose={() => setIsBasicGDialogOpen(false)}
        onAdd={handleAddBasicG}
        mobile
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
        isLoading={isLoading}
        isDeleting={Boolean(deletingDeckId)}
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
