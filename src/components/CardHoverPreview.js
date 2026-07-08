import React, { useState } from "react";
import CardImage from "./CardImage";
import CardImagePreviewDialog from "./CardImagePreviewDialog";
import "./CardHoverPreview.css";

export default function CardHoverPreview({ card, compact = false, children }) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const label = children || card?.name || "カード画像";

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="card-hover-preview-trigger"
          onClick={() => setIsDialogOpen(true)}
        >
          {label}
        </button>
        <CardImagePreviewDialog
          card={card}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      </>
    );
  }

  return (
    <span
      className="card-hover-preview"
      onMouseEnter={() => setIsPopoverOpen(true)}
      onMouseLeave={() => setIsPopoverOpen(false)}
      onFocus={() => setIsPopoverOpen(true)}
      onBlur={() => setIsPopoverOpen(false)}
    >
      <button type="button" className="card-hover-preview-trigger">
        {label}
      </button>
      {isPopoverOpen ? (
        <span className="card-hover-preview-popover" aria-hidden="true">
          <CardImage card={card} preferThumbnail={false} />
        </span>
      ) : null}
    </span>
  );
}
