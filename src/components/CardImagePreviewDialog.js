import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import CardImage from "./CardImage";
import { getCardCode } from "../utils/cardImages";
import "./CardImagePreviewDialog.css";

const CardImagePreviewDialog = ({ card, isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const cardCode = getCardCode(card);
  const modelName = [card?.modelNumber1, card?.modelNumber2].filter(Boolean).join(" / ");
  const typeName = card?.card_type_name ? String(card.card_type_name).trim() : "";
  const heading = [typeName, cardCode].filter(Boolean).join(" | ");

  return createPortal(
    <div className="card-image-preview-overlay" role="presentation" onClick={onClose}>
      <div
        className="card-image-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={card?.name ? `${card.name} の画像` : "カード画像"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-image-preview-header">
          <div className="card-image-preview-title">
            {heading ? <span>{heading}</span> : null}
            <strong>{[modelName, card?.name].filter(Boolean).join(" ")}</strong>
          </div>
          <button type="button" className="card-image-preview-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="card-image-preview-media">
          <CardImage card={card} preferThumbnail={false} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CardImagePreviewDialog;
