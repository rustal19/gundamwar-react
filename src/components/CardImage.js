import React, { useEffect, useMemo, useState } from "react";
import { getCardImageCandidates, getCardPlaceholderLabel } from "../utils/cardImages";
import "./CardImage.css";

const CardImage = ({
  card,
  className = "",
  compact = false,
  preferThumbnail = true,
}) => {
  const candidates = useMemo(
    () => getCardImageCandidates(card, { preferThumbnail }),
    [card, preferThumbnail]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates]);

  const resolvedSrc = candidates[candidateIndex] || "";
  const wrapperClassName = [
    "card-image-frame",
    compact ? "card-image-frame-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
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
        <div className="card-image-placeholder">
          <div className="card-image-placeholder-code">
            {getCardPlaceholderLabel(card)}
          </div>
          <div className="card-image-placeholder-name">{card?.name || "Card image"}</div>
        </div>
      )}
    </div>
  );
};

export default CardImage;
