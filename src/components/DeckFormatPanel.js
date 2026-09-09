import React, { useMemo, useState } from "react";
import formatCardNames from "../data/formatCardNames.json";
import { FORMAT_PRESETS, OTHER_FORMAT_NAME } from "../data/formats";
import { FORMAT_GROUPS } from "../data/formatGroups";
import { SPECIAL_G_MAX, validateDeck } from "../utils/deckValidation";
import "./DeckFormatPanel.css";

const PRESET_NAMES = new Set(FORMAT_PRESETS.map(({ name }) => name));
const FORMAT_SELECT_GROUPS = FORMAT_GROUPS.map((group) => ({
  ...group,
  formatNames: group.formatNames.filter((name) => PRESET_NAMES.has(name)),
})).filter(({ formatNames }) => formatNames.length > 0);

// formatCardNames.json is display-only data generated from csv/card_data.csv for
// every bannedCards/limitedCards ID referenced by the existing format presets.
const STATIC_CARD_NAMES = new Map(Object.entries(formatCardNames));

function normalizeFormatName(value) {
  return String(value || "").trim();
}

function getItemCardId(item) {
  return String(item?.cardId ?? item?.card?.cardId ?? "").trim();
}

function getItemCardName(item) {
  return String(item?.card?.name ?? item?.name ?? "").trim();
}

function buildCardNameMap(items) {
  const names = new Map(STATIC_CARD_NAMES);
  (Array.isArray(items) ? items : []).forEach((item) => {
    const cardId = getItemCardId(item);
    const cardName = getItemCardName(item);
    if (cardId && cardName && !names.has(cardId)) names.set(cardId, cardName);
    if (cardName) names.set(cardName, cardName);
  });
  return names;
}

function RegulationCardList({ label, references, cardNames }) {
  const rules = Array.isArray(references) ? references : [];

  return (
    <div className="deck-format-rule-group">
      <strong>{`${label}（${rules.length}件）`}</strong>
      {rules.length === 0 ? (
        <p>登録なし</p>
      ) : (
        <ul>
          {rules.map((reference, index) => {
            const normalizedReference = String(reference || "").trim();
            const cardName = cardNames.get(normalizedReference);
            const isCardId = /^\d{9}$/.test(normalizedReference);
            return (
              <li key={`${normalizedReference}-${index}`}>
                {cardName || (isCardId ? `カードID ${normalizedReference}` : normalizedReference)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function DeckFormatPanel({ formatName, onFormatChange, items = [] }) {
  const normalizedFormatName = normalizeFormatName(formatName);
  const [isOpen, setIsOpen] = useState(() => !normalizedFormatName);
  const selectedFormat = useMemo(
    () => FORMAT_PRESETS.find(({ name }) => name === normalizedFormatName) || null,
    [normalizedFormatName]
  );
  const isUnknownFormat = Boolean(normalizedFormatName && !selectedFormat);
  const deckItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const deckViolations = useMemo(
    () => (selectedFormat ? validateDeck(deckItems, selectedFormat.regulation) : []),
    [deckItems, selectedFormat]
  );
  const cardNames = useMemo(() => buildCardNameMap(deckItems), [deckItems]);

  let statusText = "未選択・適合未確認";
  let statusClassName = "is-unchecked";
  if (isUnknownFormat) {
    statusText = "ルール未登録・適合未確認";
  } else if (selectedFormat) {
    statusText = deckItems.length === 0
      ? `空デッキ・違反${deckViolations.length}件`
      : deckViolations.length > 0
        ? `違反${deckViolations.length}件`
        : "違反なし";
    statusClassName = deckItems.length > 0 && deckViolations.length === 0
      ? "has-no-violations"
      : "has-violations";
  }

  const rule = selectedFormat?.regulation;

  return (
    <section className="deck-format-panel" aria-label="フォーマット・禁止制限">
      <button
        type="button"
        className="deck-format-panel-toggle"
        aria-expanded={isOpen}
        aria-controls="deck-format-panel-content"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="deck-format-panel-heading">フォーマット・禁止制限</span>
        <span className="deck-format-panel-summary">
          <strong>{normalizedFormatName || "未選択"}</strong>
          <span className={statusClassName}>{statusText}</span>
        </span>
        <span aria-hidden="true">{isOpen ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {isOpen ? (
        <div id="deck-format-panel-content" className="deck-format-panel-content">
          <label className="deck-format-select-field">
            <span>デッキのフォーマット</span>
            <select
              aria-label="構築するデッキのフォーマット"
              value={normalizedFormatName}
              onChange={(event) => onFormatChange?.(event.target.value)}
            >
              <option value="">選択してください</option>
              {isUnknownFormat && normalizedFormatName !== OTHER_FORMAT_NAME ? (
                <optgroup label="保存済みフォーマット">
                  <option value={normalizedFormatName}>{normalizedFormatName}</option>
                </optgroup>
              ) : null}
              {FORMAT_SELECT_GROUPS.map(({ key, label, formatNames }) => (
                <optgroup key={key} label={label}>
                  {formatNames.map((presetName) => (
                    <option key={presetName} value={presetName}>{presetName}</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="ルール未登録">
                <option value={OTHER_FORMAT_NAME}>{OTHER_FORMAT_NAME}</option>
              </optgroup>
            </select>
          </label>

          {!normalizedFormatName ? (
            <p className="deck-format-unchecked-note" role="status">
              フォーマットを選択すると、禁止・制限ルールと現在の違反を確認できます。
            </p>
          ) : isUnknownFormat ? (
            <p className="deck-format-unchecked-note" role="status">
              登録済みのレギュレーションがないため、適合は確認できません。
            </p>
          ) : (
            <>
              <div className="deck-format-rule-summary">
                <span>{`メイン ${rule.mainMin}〜${rule.mainMax}枚`}</span>
                <span>{`サイド 0枚または${rule.sideSize}枚`}</span>
                <span>{`同名 ${rule.maxCopies}枚まで`}</span>
                <span>{`特殊G 合計${SPECIAL_G_MAX}枚まで`}</span>
              </div>
              {selectedFormat.note ? <p className="deck-format-note">{selectedFormat.note}</p> : null}
              <div className="deck-format-rule-lists">
                <RegulationCardList label="禁止カード" references={rule.bannedCards} cardNames={cardNames} />
                <RegulationCardList label="制限カード" references={rule.limitedCards} cardNames={cardNames} />
              </div>
              <div
                className={deckViolations.length > 0 ? "deck-format-check has-violations" : "deck-format-check"}
                aria-live="polite"
              >
                <strong>現在のデッキ</strong>
                {deckItems.length === 0 ? <p>空デッキです。適合済みではありません。</p> : null}
                {deckViolations.length > 0 ? (
                  <ul>
                    {deckViolations.map((violation, index) => (
                      <li key={`${violation.code}-${violation.cardName || index}-${index}`}>
                        {violation.message}
                      </li>
                    ))}
                  </ul>
                ) : deckItems.length > 0 ? (
                  <p>現在のデッキに違反はありません。</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
