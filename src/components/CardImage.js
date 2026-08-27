import React, { useEffect, useMemo, useState } from "react";
import {
  getCardImageCandidates,
  getCardPlaceholderLabel,
  getThumbnailPath,
} from "../utils/cardImages";
import "./CardImage.css";

const CardImage = ({
  card,
  className = "",
  compact = false,
  preferThumbnail = true,
  hideInternalId = false,
  inline = false,
}) => {
  const candidates = useMemo(() => {
    const generatedCandidates = getCardImageCandidates(card, { preferThumbnail });
    if (!preferThumbnail) return generatedCandidates;
    const explicitImagePaths = [
      card?.imagePath,
      ...(Array.isArray(card?.imageCandidates) ? card.imageCandidates : []),
    ]
      .map((candidate) => getThumbnailPath(candidate))
      .filter(Boolean);
    return Array.from(new Set([...explicitImagePaths, ...generatedCandidates]));
  }, [card, preferThumbnail]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates]);

  const resolvedSrc = candidates[candidateIndex] || "";
  const placeholderCard = hideInternalId ? { ...card, cardId: null } : card;
  const FrameElement = inline ? "span" : "div";
  const PlaceholderElement = inline ? "span" : "div";
  const wrapperClassName = [
    "card-image-frame",
    compact ? "card-image-frame-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <FrameElement className={wrapperClassName}>
      {resolvedSrc ? (
        <img
          className="card-image-element"
          src={resolvedSrc}
          alt={card?.name || "Card"}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (candidateIndex < candidates.length - 1) {
              setCandidateIndex((current) => current + 1);
              return;
            }
            setCandidateIndex(candidates.length);
          }}
        />
      ) : (
        <PlaceholderElement className="card-image-placeholder">
          <PlaceholderElement className="card-image-placeholder-code">
            {getCardPlaceholderLabel(placeholderCard)}
          </PlaceholderElement>
          <PlaceholderElement className="card-image-placeholder-name">
            {card?.name || "Card image"}
          </PlaceholderElement>
        </PlaceholderElement>
      )}
    </FrameElement>
  );
};

export default CardImage;
