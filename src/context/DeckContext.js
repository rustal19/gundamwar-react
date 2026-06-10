import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "gundamwar.deck.v1";
const DeckContext = createContext(null);

function clampCount(count) {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(99, Math.floor(parsed));
}

function normalizeZone(zone) {
  return zone === "side" ? "side" : "main";
}

function normalizeCard(card) {
  if (!card || card.cardId == null) return null;
  return {
    ...card,
    traits: Array.isArray(card.traits) ? [...card.traits] : [],
    traits2: Array.isArray(card.traits2) ? [...card.traits2] : [],
    sets: Array.isArray(card.sets) ? [...card.sets] : [],
  };
}

function normalizeDeckItem(item, fallbackZone = "main") {
  const card = normalizeCard(item?.card);
  const count = clampCount(item?.count);
  const zone = normalizeZone(item?.zone || fallbackZone);
  if (!card || count === 0) return null;
  return { cardId: card.cardId, count, card, zone };
}

function normalizeDeckState(raw) {
  const nextItems = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : [
          ...(Array.isArray(raw?.mainItems) ? raw.mainItems.map((item) => ({ ...item, zone: "main" })) : []),
          ...(Array.isArray(raw?.sideItems) ? raw.sideItems.map((item) => ({ ...item, zone: "side" })) : []),
        ];

  return nextItems.map((item) => normalizeDeckItem(item)).filter(Boolean);
}

function readDeck() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeDeckState(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to read deck data from localStorage.", error);
    return [];
  }
}

function writeDeck(items) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function DeckProvider({ children }) {
  const [items, setItems] = useState(readDeck);

  useEffect(() => {
    writeDeck(items);
  }, [items]);

  const addCard = useCallback((card, amount = 1, zone = "main") => {
    const normalized = normalizeCard(card);
    const delta = clampCount(amount);
    const normalizedZone = normalizeZone(zone);
    if (!normalized || delta === 0) return;

    setItems((current) => {
      const index = current.findIndex(
        (item) => item.cardId === normalized.cardId && item.zone === normalizedZone
      );

      if (index === -1) {
        return [
          ...current,
          { cardId: normalized.cardId, count: delta, card: normalized, zone: normalizedZone },
        ];
      }

      const next = [...current];
      next[index] = {
        ...next[index],
        count: clampCount(next[index].count + delta),
        card: normalized,
      };
      return next;
    });
  }, []);

  const setCardCount = useCallback((cardId, nextCount, zone = "main") => {
    const normalizedZone = normalizeZone(zone);

    setItems((current) => {
      const normalizedCount = clampCount(nextCount);
      if (normalizedCount === 0) {
        return current.filter((item) => !(item.cardId === cardId && item.zone === normalizedZone));
      }

      return current.map((item) =>
        item.cardId === cardId && item.zone === normalizedZone
          ? { ...item, count: normalizedCount }
          : item
      );
    });
  }, []);

  const removeOne = useCallback(
    (cardId, zone = "main") => {
      const normalizedZone = normalizeZone(zone);
      const currentItem = items.find(
        (item) => item.cardId === cardId && item.zone === normalizedZone
      );
      if (!currentItem) return;
      setCardCount(cardId, currentItem.count - 1, normalizedZone);
    },
    [items, setCardCount]
  );

  const removeCard = useCallback((cardId, zone = "main") => {
    const normalizedZone = normalizeZone(zone);
    setItems((current) =>
      current.filter((item) => !(item.cardId === cardId && item.zone === normalizedZone))
    );
  }, []);

  const moveCard = useCallback((cardId, fromZone, toZone) => {
    const normalizedFromZone = normalizeZone(fromZone);
    const normalizedToZone = normalizeZone(toZone);
    if (normalizedFromZone === normalizedToZone) return;

    setItems((current) => {
      const sourceItem = current.find(
        (item) => item.cardId === cardId && item.zone === normalizedFromZone
      );
      if (!sourceItem) return current;

      const next = current.filter(
        (item) => !(item.cardId === cardId && item.zone === normalizedFromZone)
      );
      const targetIndex = next.findIndex(
        (item) => item.cardId === cardId && item.zone === normalizedToZone
      );

      if (targetIndex === -1) {
        return [...next, { ...sourceItem, zone: normalizedToZone }];
      }

      const merged = [...next];
      merged[targetIndex] = {
        ...merged[targetIndex],
        count: clampCount(merged[targetIndex].count + sourceItem.count),
        card: sourceItem.card,
      };
      return merged;
    });
  }, []);

  const clearDeck = useCallback(() => {
    setItems([]);
  }, []);

  const replaceDeck = useCallback((nextItems) => {
    setItems(normalizeDeckState(nextItems));
  }, []);

  const mainItems = useMemo(
    () => items.filter((item) => item.zone === "main"),
    [items]
  );

  const sideItems = useMemo(
    () => items.filter((item) => item.zone === "side"),
    [items]
  );

  const mainCount = useMemo(
    () => mainItems.reduce((sum, item) => sum + item.count, 0),
    [mainItems]
  );

  const sideCount = useMemo(
    () => sideItems.reduce((sum, item) => sum + item.count, 0),
    [sideItems]
  );

  const totalCount = useMemo(() => mainCount + sideCount, [mainCount, sideCount]);

  const totalCountsByCardId = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      map[item.cardId] = (map[item.cardId] || 0) + item.count;
    });
    return map;
  }, [items]);

  const countsByZoneByCardId = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      if (!map[item.cardId]) {
        map[item.cardId] = { main: 0, side: 0, total: 0 };
      }
      map[item.cardId][item.zone] += item.count;
      map[item.cardId].total += item.count;
    });
    return map;
  }, [items]);

  const uniqueCount = useMemo(
    () => new Set(items.map((item) => item.cardId)).size,
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      mainItems,
      sideItems,
      mainCount,
      sideCount,
      totalCount,
      uniqueCount,
      countsByCardId: totalCountsByCardId,
      countsByZoneByCardId,
      addCard,
      setCardCount,
      removeOne,
      removeCard,
      moveCard,
      clearDeck,
      replaceDeck,
    }),
    [
      items,
      mainItems,
      sideItems,
      mainCount,
      sideCount,
      totalCount,
      uniqueCount,
      totalCountsByCardId,
      countsByZoneByCardId,
      addCard,
      setCardCount,
      removeOne,
      removeCard,
      moveCard,
      clearDeck,
      replaceDeck,
    ]
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck() {
  const value = useContext(DeckContext);
  if (!value) {
    throw new Error("useDeck must be used inside DeckProvider.");
  }
  return value;
}
