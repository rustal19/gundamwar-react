import React, { useEffect, useMemo, useState } from "react";
import { useDeckPreview } from "../hooks/useDeckPreview";
import "./DeckExportDialog.css";

export default function DeckExportDialog({
  open,
  onClose,
  mainItems,
  sideItems,
  mainCount,
  sideCount,
  exportText,
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const previewItems = useMemo(
    () => [...(mainItems || []), ...(sideItems || [])],
    [mainItems, sideItems]
  );
  const { previewUrl, previewBlob, isRendering, errorMessage } = useDeckPreview({
    open,
    mainItems,
    sideItems,
    mainCount,
    sideCount,
  });

  useEffect(() => {
    if (!open) return undefined;

    setStatusMessage("");

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const handleCopyImage = async () => {
    if (!previewBlob) return;

    try {
      if (typeof window.ClipboardItem !== "function") {
        throw new Error("ClipboardItem is not available.");
      }

      await navigator.clipboard.write([
        new window.ClipboardItem({
          "image/png": previewBlob,
        }),
      ]);
      setStatusMessage("画像をクリップボードにコピーしました。");
    } catch (error) {
      console.error("Failed to copy deck export image.", error);
      setStatusMessage("画像のコピーに失敗しました。");
    }
  };

  const handleCopyList = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setStatusMessage("リストをクリップボードにコピーしました。");
    } catch (error) {
      console.error("Failed to copy deck export list.", error);
      setStatusMessage("リストのコピーに失敗しました。");
    }
  };

  if (!open) return null;

  const footerMessage = statusMessage || errorMessage;
  const footerClassName =
    statusMessage && !errorMessage
      ? "deck-export-dialog-status"
      : "deck-export-dialog-status deck-export-dialog-status-error";

  return (
    <div className="deck-export-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="deck-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="デッキ書き出し"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="deck-export-dialog-header">
          <h3>書き出し</h3>
          <p className="deck-export-dialog-note">
            メインデッキとサイドボードを画像またはリストとしてコピーできます。
          </p>
        </div>

        <div className="deck-export-dialog-preview-frame">
          {previewUrl ? (
            <img
              className="deck-export-dialog-preview-image"
              src={previewUrl}
              alt="デッキ書き出しプレビュー"
            />
          ) : (
            <div className="deck-export-dialog-preview-empty">
              {isRendering
                ? "プレビューを生成しています..."
                : previewItems.length > 0
                  ? "プレビューを表示できませんでした。"
                  : "デッキが空のためプレビューを表示できません。"}
            </div>
          )}
        </div>

        <div className="deck-export-dialog-actions">
          <button
            type="button"
            className="deck-secondary-button"
            onClick={handleCopyImage}
            disabled={!previewBlob || isRendering}
          >
            画像をクリップボードにコピー
          </button>
          <button
            type="button"
            className="deck-secondary-button"
            onClick={handleCopyList}
            disabled={!exportText}
          >
            リストをクリップボードにコピー
          </button>
          <button type="button" className="deck-primary-button" onClick={onClose}>
            ダイアログを閉じる
          </button>
        </div>

        {footerMessage ? <p className={footerClassName}>{footerMessage}</p> : null}
      </div>
    </div>
  );
}
