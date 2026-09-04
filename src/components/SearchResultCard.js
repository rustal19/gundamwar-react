import React, { useCallback, useState } from "react";
import CardImage from "./CardImage";
import CardImagePreviewDialog from "./CardImagePreviewDialog";
import { useDeck } from "../context/DeckContext";
import { getCardCode } from "../utils/cardImages";
import { formatDeckCountSummary } from "../utils/deckCounts";
import {
  buildBackgroundStyle,
  buildEnvironmentLabel,
  getCardColorNames,
  splitCommaText,
} from "../utils/searchResults";

function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatCardValue(value) {
  return hasDisplayValue(value) ? String(value) : "-";
}

function formatCombatValue(primary, secondary) {
  const primaryText = formatCardValue(primary);
  return hasDisplayValue(secondary)
    ? `${primaryText} / ${String(secondary)}`
    : primaryText;
}

function CombatStats({ melee1, melee2, shooting1, shooting2, defense1, defense2 }) {
  const stats = [
    ["格闘", formatCombatValue(melee1, melee2)],
    ["射撃", formatCombatValue(shooting1, shooting2)],
    ["防御", formatCombatValue(defense1, defense2)],
  ];

  return (
    <div className="card-combat-stats">
      <span className="card-data-heading">戦闘修正</span>
      {stats.map(([label, value]) => (
        <span key={label} className="card-data-item">
          <span className="card-data-label">{label}</span>
          <span className="card-data-value">{value}</span>
        </span>
      ))}
    </div>
  );
}

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
  const primarySpecifiedCost = [primaryName, card.spPowerCost1]
    .filter(hasDisplayValue)
    .join(" ");
  const secondarySpecifiedCost = [secondaryName, card.spPowerCost2]
    .filter(hasDisplayValue)
    .join(" ");
  const specifiedCost = [primarySpecifiedCost, secondarySpecifiedCost]
    .filter(Boolean)
    .join(" / ") || "-";
  const imagePreviewLabel = card?.name
    ? `${card.name} の画像を拡大表示`
    : "カード画像を拡大表示";
  const hasStatus = [card.melee1, card.shooting1, card.defense1].some(hasDisplayValue);
  const hasAltStatus = [card.altMelee1, card.altShooting1, card.altDefense1].some(
    hasDisplayValue
  );
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
      <CombatStats
        melee1={card.melee1}
        melee2={card.melee2}
        shooting1={card.shooting1}
        shooting2={card.shooting2}
        defense1={card.defense1}
        defense2={card.defense2}
      />
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
          <span className="result-card-image-count">{`合計${deckCount}枚`}</span>
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
                  ＋メイン
                </button>
                <button
                  className="deck-action-button"
                  type="button"
                  onClick={() => addCard(card, 1, "side")}
                  aria-label={label ? `${label} をサイドボードに追加` : "サイドボードに追加"}
                >
                  ＋サイド
                </button>
              </div>
            ) : null}
            {/* 0枚のときも出す。モバイルは検索ペインでデッキ側が隠れるため、
                この行が変わることだけが「追加できた」という手応えになる。 */}
            {showDeckActions ? (
              <div className="result-card-image-meta" aria-live="polite">
                このデッキに {formatDeckCountSummary(mainCount, sideCount)}
              </div>
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
              <span className="card-costs">
                <span className="card-data-heading">国力</span>
                <span className="card-data-item">
                  <span className="card-data-label">指定</span>
                  <span className="card-data-value">{specifiedCost}</span>
                </span>
                <span className="card-data-item">
                  <span className="card-data-label">合計</span>
                  <span className="card-data-value">{formatCardValue(card.totalCost)}</span>
                </span>
                <span className="card-data-item">
                  <span className="card-data-label">資源</span>
                  <span className="card-data-value">{formatCardValue(card.resourceCost)}</span>
                </span>
              </span>
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
                ＋メイン
              </button>
              <button
                className="deck-action-button"
                type="button"
                onClick={() => addCard(card, 1, "side")}
                aria-label={`${card.name || "card"} をサイドボードに追加`}
              >
                ＋サイド
              </button>
              {/* 詳細表示にはこれまで枚数表示が一切なく、押しても何も
                  変わらないように見えていた。 */}
              <span className="result-card-add-count" aria-live="polite">
                このデッキに {formatDeckCountSummary(mainCount, sideCount)}
              </span>
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
            {hasAltStatus ? (
              <div className="card-status">
                <CombatStats
                  melee1={card.altMelee1}
                  melee2={card.altMelee2}
                  shooting1={card.altShooting1}
                  shooting2={card.altShooting2}
                  defense1={card.altDefense1}
                  defense2={card.altDefense2}
                />
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
          <div className="card-number card-data-item">
            <span className="card-data-label">カード番号</span>
            <span className="card-data-value">{cardCode || "-"}</span>
          </div>
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
