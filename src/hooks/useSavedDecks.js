import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  deleteSavedDeck,
  fetchSavedDecks,
  saveSavedDeck,
} from "../services/savedDecks";

export function useSavedDecks() {
  const { authMode, isAuthenticated, user } = useAuth();
  const [savedDecks, setSavedDecks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSavedDecks([]);
      setError("");
      return [];
    }

    setIsLoading(true);
    setError("");
    try {
      const decks = await fetchSavedDecks({ authMode, user });
      setSavedDecks(decks);
      return decks;
    } catch (loadError) {
      setError(loadError.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [authMode, isAuthenticated, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveDeck = useCallback(
    async ({ deckId, title, items }) => {
      if (!user) {
        throw new Error("ログインしてから保存してください。");
      }

      setIsSaving(true);
      setError("");
      try {
        const savedDeck = await saveSavedDeck({
          authMode,
          user,
          deckId,
          title,
          items,
        });

        setSavedDecks((current) => {
          const next = current.filter((deck) => deck.id !== savedDeck.id);
          return [savedDeck, ...next].sort((left, right) =>
            String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
          );
        });

        return savedDeck;
      } catch (saveError) {
        setError(saveError.message);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [authMode, user]
  );

  const removeDeck = useCallback(
    async (deckId) => {
      if (!user) {
        throw new Error("ログインしてから削除してください。");
      }

      setError("");
      try {
        await deleteSavedDeck({ authMode, user, deckId });
        setSavedDecks((current) => current.filter((deck) => deck.id !== String(deckId)));
      } catch (removeError) {
        setError(removeError.message);
        throw removeError;
      }
    },
    [authMode, user]
  );

  return {
    savedDecks,
    isLoading,
    isSaving,
    error,
    refresh,
    saveDeck,
    removeDeck,
  };
}
