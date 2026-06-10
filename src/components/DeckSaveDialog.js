import React, { useEffect, useMemo, useState } from "react";
import "./DeckSaveDialog.css";

function normalizeTitle(value, fallbackTitle) {
  const trimmed = String(value || "").trim();
  return trimmed || String(fallbackTitle || "").trim();
}

export default function DeckSaveDialog({
  open,
  onClose,
  onOverwrite,
  onSaveAs,
  selectedDeck,
  currentTitle,
  isSaving,
  errorMessage,
}) {
  const defaultTitle = useMemo(
    () => normalizeTitle(currentTitle, "新しいデッキ"),
    [currentTitle]
  );
  const [draftTitle, setDraftTitle] = useState(defaultTitle);

  useEffect(() => {
    if (!open) return undefined;

    setDraftTitle(defaultTitle);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [defaultTitle, onClose, open]);

  const trimmedTitle = normalizeTitle(draftTitle, defaultTitle);

  const handleSaveAs = () => {
    if (!trimmedTitle) return;
    onSaveAs(trimmedTitle);
  };

  if (!open) return null;

  return (
    <div className="deck-save-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="deck-save-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="デッキを保存"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="deck-save-dialog-header">
          <h3>保存</h3>
          <p className="deck-save-dialog-note">
            {selectedDeck
              ? "上書き保存するか、別名で保存するかを選べます。"
              : "保存するデッキ名を入力してください。"}
          </p>
        </div>

        {selectedDeck ? (
          <div className="deck-save-dialog-sections">
            <section className="deck-save-dialog-section">
              <div className="deck-save-dialog-section-header">
                <h4>上書き保存</h4>
                <p>{`現在の保存先: ${selectedDeck.title}`}</p>
              </div>
              <button
                type="button"
                className="deck-primary-button"
                onClick={onOverwrite}
                disabled={isSaving}
              >
                上書き保存
              </button>
            </section>

            <section className="deck-save-dialog-section">
              <div className="deck-save-dialog-section-header">
                <h4>別名で保存</h4>
                <p>別の名前で新しく保存します。</p>
              </div>
              <label className="deck-field-label" htmlFor="deck-save-dialog-title">
                デッキ名
              </label>
              <input
                id="deck-save-dialog-title"
                className="deck-title-input"
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="デッキ名を入力"
                disabled={isSaving}
              />
              <button
                type="button"
                className="deck-secondary-button"
                onClick={handleSaveAs}
                disabled={!trimmedTitle || isSaving}
              >
                別名で保存
              </button>
            </section>
          </div>
        ) : (
          <div className="deck-save-dialog-single">
            <label className="deck-field-label" htmlFor="deck-save-dialog-title">
              デッキ名
            </label>
            <input
              id="deck-save-dialog-title"
              className="deck-title-input"
              type="text"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="デッキ名を入力"
              disabled={isSaving}
            />
          </div>
        )}

        {errorMessage ? <p className="deck-save-dialog-error">{errorMessage}</p> : null}

        <div className="deck-save-dialog-actions">
          <button type="button" className="deck-secondary-button" onClick={onClose} disabled={isSaving}>
            キャンセル
          </button>
          {!selectedDeck ? (
            <button
              type="button"
              className="deck-primary-button"
              onClick={handleSaveAs}
              disabled={!trimmedTitle || isSaving}
            >
              保存
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
