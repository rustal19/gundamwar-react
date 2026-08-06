import React, { useCallback, useState } from "react";
import CardImage from "./CardImage";
import CardImagePreviewDialog from "./CardImagePreviewDialog";
import { useDeck } from "../context/DeckContext";
import { getCardCode } from "../utils/cardImages";
import {
  buildBackgroundStyle,
  buildEnvironmentLabel,
  getCardColorNames,
  splitCommaText,
} from "../utils/searchResults";

const SearchResultCard = ({
  card,
  viewMode = "detail",
  showDeckActions = false,
  compactDetailLayout = false,
  enableImagePreview = false,
  formatStatus = null,
}) => {
  const { addCard, countsByZoneByCardId } = useDeck();
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const deckCounts = countsByZoneByCardId[card.cardId] || { main: 0, side: 0, total: 0 };
  const mainCount = deckCounts.main;
  const sideCount = deckCounts.side;
  const deckCount = deckCounts.total;
  const traits = [...(card.traits || []), ...(card.traits2 || [])];
  const aliases = splitCommaText(card.aliases);
  const exclusivePilots = splitCommaText(card.exclusivePilots);
  const cardCode = getCardCode(card);
  const { primaryName, secondaryName } = getCardColorNames(card);
  const modelName = [card.modelNumber1, card.modelNumber2].filter(Boolean).join(" / ");
  const imagePreviewLabel = card?.name
    ? `${card.name} の画像を拡大表示`
    : "カード画像を拡大表示";
  const hasStatus = card.melee1 || card.shooting1 || card.defense1;
  const formatBadges = [
    formatStatus?.isBanned
      ? { key: "banned", label: "禁止", className: "banned" }
      : null,
    formatStatus?.isLimited
      ? { key: "limited", label: "制限", className: "limited" }
      : null,
  ].filter(Boolean);

  const renderFormatBadges = (overlay = false) => {
    if (formatBadges.length === 0) return null;
    return (
      <div
        className={[
          "result-card-format-badges",
          overlay ? "result-card-format-badges-overlay" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="大会フォーマット判定"
      >
        {formatBadges.map(({ key, label, className }) => (
          <span key={key} className={`result-card-format-badge ${className}`}>
            {label}
          </span>
        ))}
      </div>
    );
  };

  const openImagePreview = useCallback(() => {
    if (!enableImagePreview) return;
    setIsImagePreviewOpen(true);
  }, [enableImagePreview]);

  const closeImagePreview = useCallback(() => {
    setIsImagePreviewOpen(false);
  }, []);

  const statusBlock = hasStatus ? (
    <div className={compactDetailLayout ? "card-status result-card-status-inline" : "card-status"}>
      <div>
        <strong>
          [{card.melee1 ?? ""}
          {card.melee2 ? ` / ${card.melee2}` : ""}] [{card.shooting1 ?? ""}
          {card.shooting2 ? ` / ${card.shooting2}` : ""}] [{card.defense1 ?? ""}
          {card.defense2 ? ` / ${card.defense2}` : ""}]
        </strong>
      </div>
      <div className="card-environment">{buildEnvironmentLabel(card)}</div>
    </div>
  ) : null;

  if (viewMode === "image") {
    const label = [cardCode, card.name].filter(Boolean).join(" ");
    const imageFrame = (
      <div className="result-card-image-frame" title={label}>
        <CardImage card={card} />
        {renderFormatBadges(true)}
        {showDeckActions && deckCount > 0 ? (
          <span className="result-card-image-count">{deckCount}</span>
        ) : null}
      </div>
    );

    return (
      <>
        <article className="card-item result-card-image-only">
          <div className="result-card-image-stack">
            {enableImagePreview ? (
              <button
                type="button"
                className="result-card-image-trigger"
                onClick={openImagePreview}
                aria-label={imagePreviewLabel}
              >
                {imageFrame}
              </button>
            ) : (
              imageFrame
            )}
            {showDeckActions ? (
              <div className="result-card-image-zone-actions">
                <button
                  className="deck-action-button primary"
                  type="button"
                  onClick={() => addCard(card, 1, "main")}
                  aria-label={label ? `${label} をメインデッキに追加` : "メインデッキに追加"}
                >
                  メイン
                </button>
                <button
                  className="deck-action-button"
                  type="button"
                  onClick={() => addCard(card, 1, "side")}
                  aria-label={label ? `${label} をサイドボードに追加` : "サイドボードに追加"}
                >
                  サイド
                </button>
              </div>
            ) : null}
            {showDeckActions && deckCount > 0 ? (
              <div className="result-card-image-meta">{`M ${mainCount} / S ${sideCount}`}</div>
            ) : null}
          </div>
        </article>

        {enableImagePreview ? (
          <CardImagePreviewDialog card={card} isOpen={isImagePreviewOpen} onClose={closeImagePreview} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <article
        key={card.cardId}
        className={[
          "card-item",
          "result-card",
          compactDetailLayout ? "result-card-compact-layout" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={buildBackgroundStyle(card)}
      >
      <div className="result-card-media">
        {enableImagePreview ? (
          <button
            type="button"
            className="result-card-image-trigger"
            onClick={openImagePreview}
            aria-label={imagePreviewLabel}
          >
            <CardImage card={card} compact={compactDetailLayout} />
          </button>
        ) : (
          <CardImage card={card} compact={compactDetailLayout} />
        )}
      </div>

      <div className="result-card-content">
        <div className="result-card-header">
          <div className={compactDetailLayout ? "result-card-compact-summary" : ""}>
            <div className="card-top">
              <strong>{card.card_type_name}</strong>
              {" | "}
              {primaryName} {card.spPowerCost1}
              {secondaryName
                ? ` / ${secondaryName} ${card.spPowerCost2}`
                : ""}
              {` - ${card.totalCost || "-"} - ${card.resourceCost || "-"}`}
            </div>
            <div className="card-model-name">
              <strong>
                {modelName} {card.name}
              </strong>
            </div>
            {renderFormatBadges()}
            {compactDetailLayout ? statusBlock : null}
          </div>

          {showDeckActions ? (
            <div className="card-actions result-card-add-actions">
              <button
                className="deck-action-button primary"
                type="button"
                onClick={() => addCard(card, 1, "main")}
                aria-label={`${card.name || "card"} をメインデッキに追加`}
              >
                メイン
              </button>
              <button
                className="deck-action-button"
                type="button"
                onClick={() => addCard(card, 1, "side")}
                aria-label={`${card.name || "card"} をサイドボードに追加`}
              >
                サイド
              </button>
            </div>
          ) : null}
        </div>

        <div className="card-divider" />

        {card.text_normal && card.text_normal !== "null" ? (
          <div className="card-text" style={{ whiteSpace: "pre-line" }}>
            {card.text_normal}
          </div>
        ) : null}

        {compactDetailLayout ? null : statusBlock}

        {card.altName ? (
          <>
            <div className="card-divider" />
            <div>
              <strong>
                {card.alt_card_type_name} {card.altName}
              </strong>
            </div>
            {card.text_alt && card.text_alt !== "null" ? (
              <div className="card-text" style={{ whiteSpace: "pre-line" }}>
                {card.text_alt}
              </div>
            ) : null}
            {card.altMelee1 || card.altShooting1 || card.altDefense1 ? (
              <div className="card-status">
                <div>
                  [{card.altMelee1 ?? ""}
                  {card.altMelee2 ? ` / ${card.altMelee2}` : ""}] [{card.altShooting1 ?? ""}
                  {card.altShooting2 ? ` / ${card.altShooting2}` : ""}] [{card.altDefense1 ?? ""}
                  {card.altDefense2 ? ` / ${card.altDefense2}` : ""}]
                </div>
                <div className="card-environment">{buildEnvironmentLabel(card)}</div>
              </div>
            ) : null}
          </>
        ) : null}

        {traits.length > 0 || aliases.length > 0 || exclusivePilots.length > 0 ? (
          <div className="card-divider" />
        ) : null}

        {traits.length > 0 ? <div className="card-traits">{`特徴: ${traits.join(" / ")}`}</div> : null}

        {aliases.length > 0 ? <div className="card-aliases">{`別名: ${aliases.join(" / ")}`}</div> : null}

        {exclusivePilots.length > 0 ? (
          <div className="card-exclusive">{`専用パイロット: ${exclusivePilots.join(" / ")}`}</div>
        ) : null}

        <div className="card-divider" />

        <div className="card-footer-grid">
          <div className="card-sets">{`収録弾: ${(card.sets || []).join(" / ")}`}</div>
          <div className="card-number">{cardCode}</div>
        </div>
      </div>
      </article>

      {enableImagePreview ? (
        <CardImagePreviewDialog card={card} isOpen={isImagePreviewOpen} onClose={closeImagePreview} />
      ) : null}
    </>
  );
};

export default SearchResultCard;
