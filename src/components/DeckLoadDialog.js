import React, { useEffect, useMemo, useState } from "react";
import { useDeckPreview } from "../hooks/useDeckPreview";
import "./DeckLoadDialog.css";

function normalizeZone(item) {
  return item?.zone === "side" ? "side" : "main";
}

function countDeckCards(items, zone) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (zone && normalizeZone(item) !== zone) return sum;
    return sum + Number(item.count || 0);
  }, 0);
}

function splitDeckItems(items) {
  const allItems = Array.isArray(items) ? items : [];
  const mainItems = allItems.filter((item) => normalizeZone(item) === "main");
  const sideItems = allItems.filter((item) => normalizeZone(item) === "side");

  return {
    mainItems,
    sideItems,
    mainCount: countDeckCards(mainItems),
    sideCount: countDeckCards(sideItems),
  };
}

function formatUpdatedAt(value) {
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

export default function DeckLoadDialog({
  open,
  onClose,
  savedDecks,
  initialDeckId,
  onLoad,
  onDelete,
  isLoading,
  isDeleting,
  deletingDeckId,
  errorMessage,
}) {
  const [activeDeckId, setActiveDeckId] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const nextDeckId = savedDecks.some((deck) => deck.id === initialDeckId)
      ? initialDeckId
      : savedDecks[0]?.id || "";
    setActiveDeckId(nextDeckId);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [initialDeckId, onClose, open, savedDecks]);

  useEffect(() => {
    if (!open) return;
    if (!activeDeckId) return;
    if (savedDecks.some((deck) => deck.id === activeDeckId)) return;
    setActiveDeckId(savedDecks[0]?.id || "");
  }, [activeDeckId, open, savedDecks]);

  const activeDeck = useMemo(
    () => savedDecks.find((deck) => deck.id === activeDeckId) || null,
    [activeDeckId, savedDecks]
  );
  const activePreview = useMemo(
    () => splitDeckItems(activeDeck?.items || []),
    [activeDeck]
  );
  const { previewUrl, isRendering, errorMessage: previewErrorMessage } = useDeckPreview({
    open: open && Boolean(activeDeck),
    mainItems: activePreview.mainItems,
    sideItems: activePreview.sideItems,
    mainCount: activePreview.mainCount,
    sideCount: activePreview.sideCount,
  });

  const handleDelete = async () => {
    if (!activeDeck) return;
    const shouldDelete = window.confirm(`「${activeDeck.title}」を削除しますか？`);
    if (!shouldDelete) return;
    await onDelete(activeDeck.id);
  };

  if (!open) return null;

  return (
    <div className="deck-load-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="deck-load-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="保存済みデッキを読み込み"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="deck-load-dialog-header">
          <h3>読み込み</h3>
          <p className="deck-load-dialog-note">
            左の一覧から保存済みデッキを選ぶと、右側に内容を表示します。
          </p>
        </div>

        <div className="deck-load-dialog-body">
          <div className="deck-load-dialog-list-panel">
            <div className="deck-load-dialog-list-header">保存済みデッキ</div>
            {savedDecks.length === 0 ? (
              <div className="deck-load-dialog-list-empty">保存済みデッキがありません。</div>
            ) : (
              <div className="deck-load-dialog-list">
                {savedDecks.map((deck) => {
                  const deckPreview = splitDeckItems(deck.items);
                  const isActive = deck.id === activeDeckId;
                  const updatedAt = formatUpdatedAt(deck.updatedAt);
                  const metaParts = [`${deckPreview.mainCount} / 50`, `${deckPreview.sideCount} / 10`];
                  if (updatedAt) {
                    metaParts.push(`更新 ${updatedAt}`);
                  }
                  return (
                    <button
                      key={deck.id}
                      type="button"
                      className={
                        isActive
                          ? "deck-load-dialog-list-item active"
                          : "deck-load-dialog-list-item"
                      }
                      onClick={() => setActiveDeckId(deck.id)}
                    >
                      <span className="deck-load-dialog-list-title">{deck.title}</span>
                      <span className="deck-load-dialog-list-meta">{metaParts.join(" ・ ")}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="deck-load-dialog-preview-panel">
            {activeDeck ? (
              <>
                <div className="deck-load-dialog-preview-header">
                  <div>
                    <h4>{activeDeck.title}</h4>
                    <p>{`メイン ${activePreview.mainCount} / 50 ・ サイド ${activePreview.sideCount} / 10`}</p>
                  </div>
                </div>

                <div className="deck-load-dialog-preview-frame">
                  {previewUrl ? (
                    <img
                      className="deck-load-dialog-preview-image"
                      src={previewUrl}
                      alt={`${activeDeck.title} のプレビュー`}
                    />
                  ) : (
                    <div className="deck-load-dialog-preview-empty">
                      {isRendering
                        ? "プレビューを生成しています..."
                        : "プレビューを表示できませんでした。"}
                    </div>
                  )}
                </div>

                <div className="deck-load-dialog-actions">
                  <button
                    type="button"
                    className="deck-danger-button"
                    onClick={handleDelete}
                    disabled={isDeleting || isLoading}
                  >
                    {deletingDeckId === activeDeck.id ? "削除中..." : "削除"}
                  </button>
                  <button
                    type="button"
                    className="deck-primary-button"
                    onClick={() => onLoad(activeDeck)}
                    disabled={isLoading || isDeleting}
                  >
                    読み込む
                  </button>
                  <button type="button" className="deck-secondary-button" onClick={onClose}>
                    閉じる
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="deck-load-dialog-preview-empty">
                  {savedDecks.length === 0
                    ? "保存済みデッキがありません。"
                    : "保存済みデッキを選択してください。"}
                </div>
                <div className="deck-load-dialog-actions">
                  <button type="button" className="deck-secondary-button" onClick={onClose}>
                    閉じる
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {errorMessage || previewErrorMessage ? (
          <p className="deck-load-dialog-error">{errorMessage || previewErrorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
