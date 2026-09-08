import React, { useEffect, useMemo, useState } from "react";
import { FORMAT_PRESETS, OTHER_FORMAT_NAME } from "../data/formats";
import { getDeckPublicationValidationError } from "../services/publicDecks";
import "./DeckPublicationPanel.css";

function normalizeFormat(value) {
  return String(value || "").trim();
}

function getPublicDeckPath(deckId) {
  const normalizedId = String(deckId || "");
  const publicDeckId = normalizedId.startsWith("saved:")
    ? normalizedId
    : `saved:${normalizedId}`;
  return `/decks/${publicDeckId}`;
}

export default function DeckPublicationPanel({
  deck,
  formatValue,
  onFormatChange,
  onPublicationChange,
  onPublicationError,
  onPublicationFeedbackClear,
  isLoading = false,
  isPublishing = false,
  publishingDeckId = "",
  className = "",
  compactUnsaved = false,
  hideFormatSelection = false,
}) {
  const [publicationDescription, setPublicationDescription] = useState(
    deck?.description || ""
  );
  const [localPublicationFormat, setLocalPublicationFormat] = useState(
    deck?.format || ""
  );
  const [publicationMessage, setPublicationMessage] = useState("");
  const [publicationViolations, setPublicationViolations] = useState([]);
  const [publicationHasError, setPublicationHasError] = useState(false);
  const hasControlledFormat = typeof formatValue !== "undefined";
  const publicationFormat = hasControlledFormat
    ? String(formatValue || "")
    : localPublicationFormat;
  const normalizedPublicationFormat = normalizeFormat(publicationFormat);
  const normalizedStoredFormat = normalizeFormat(deck?.format);

  useEffect(() => {
    setPublicationDescription(deck?.description || "");
    setLocalPublicationFormat(deck?.format || "");
  }, [deck?.description, deck?.format, deck?.id]);

  useEffect(() => {
    setPublicationMessage("");
    setPublicationViolations([]);
    setPublicationHasError(false);
  }, [deck?.id]);

  const formatOptions = useMemo(() => {
    const names = FORMAT_PRESETS.map((preset) => preset.name).filter(Boolean);
    const options = [...new Set([...names, OTHER_FORMAT_NAME])];
    if (publicationFormat && !options.includes(publicationFormat)) {
      options.unshift(publicationFormat);
    }
    return options;
  }, [publicationFormat]);

  const publicationFormatPreset = useMemo(
    () =>
      FORMAT_PRESETS.find(({ name }) => name === normalizedPublicationFormat) || null,
    [normalizedPublicationFormat]
  );
  const isPublicationValidationSkipped = Boolean(
    normalizedPublicationFormat && !publicationFormatPreset
  );
  const shouldValidatePublication = Boolean(
    deck &&
      normalizedPublicationFormat &&
      (!deck.isPublic || normalizedStoredFormat !== normalizedPublicationFormat)
  );
  const preflightError = useMemo(
    () => {
      if (!deck) return null;
      if (!normalizedPublicationFormat) {
        return getDeckPublicationValidationError(deck.items || [], publicationFormat);
      }
      return shouldValidatePublication
        ? getDeckPublicationValidationError(deck.items || [], normalizedPublicationFormat)
        : null;
    },
    [deck, normalizedPublicationFormat, publicationFormat, shouldValidatePublication]
  );
  const preflightViolations = Array.isArray(preflightError?.violations)
    ? preflightError.violations
    : [];

  const clearPublicationFeedback = () => {
    setPublicationMessage("");
    setPublicationViolations([]);
    setPublicationHasError(false);
    onPublicationFeedbackClear?.();
  };

  const handlePublicationSubmit = async (nextIsPublic) => {
    if (!deck || !onPublicationChange) return;
    if (nextIsPublic && (!normalizedPublicationFormat || preflightViolations.length > 0)) {
      return;
    }

    clearPublicationFeedback();
    try {
      await onPublicationChange({
        deckId: deck.id,
        isPublic: nextIsPublic,
        description: publicationDescription,
        format: publicationFormat,
      });
      setPublicationMessage(nextIsPublic ? "公開設定を更新しました。" : "非公開にしました。");
    } catch (error) {
      const violations = Array.isArray(error?.violations)
        ? error.violations.filter((violation) => violation?.message)
        : [];
      setPublicationMessage(
        violations.length > 0
          ? error.summary || "選択したフォーマットの条件を満たしていません。"
          : error?.message || "公開設定を更新できませんでした。"
      );
      setPublicationViolations(violations);
      setPublicationHasError(true);
      onPublicationError?.(error);
    }
  };

  const panelClassName = ["deck-publication-panel", className].filter(Boolean).join(" ");
  const isCurrentDeckPublishing =
    isPublishing && String(publishingDeckId) === String(deck?.id || "");

  if (!deck) {
    if (compactUnsaved) {
      return (
        <section
          className={`${panelClassName} is-unsaved is-compact-unsaved`}
          aria-label="デッキ公開設定"
        >
          <div className="deck-publication-header">
            <strong>未保存</strong>
            <span>保存後に公開できます</span>
          </div>
        </section>
      );
    }

    return (
      <section className={`${panelClassName} is-unsaved`} aria-label="デッキ公開設定">
        <div className="deck-publication-header">
          <strong>未保存</strong>
          <span>公開設定</span>
        </div>
        <p className="deck-publication-validation-note">
          デッキを保存してから公開できます。
        </p>
        <div className="deck-publication-actions">
          <button type="button" className="deck-primary-button" disabled>
            公開する
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={panelClassName} aria-label="デッキ公開設定">
      <div className="deck-publication-header">
        <strong>{deck.isPublic ? "公開中" : "非公開"}</strong>
        {deck.isPublic ? (
          <a className="deck-publication-link" href={getPublicDeckPath(deck.id)}>
            公開デッキを見る
          </a>
        ) : (
          <span>公開設定</span>
        )}
      </div>
      <p className="deck-publication-validation-note">
        公開にはフォーマットの選択と、そのレギュレーションへの適合が必要です。公開対象は最後に保存した内容です。
      </p>
      <textarea
        className="deck-publication-textarea"
        value={publicationDescription}
        onChange={(event) => {
          setPublicationDescription(event.target.value);
          clearPublicationFeedback();
        }}
        placeholder="デッキの説明"
        aria-label="デッキの説明"
        rows={3}
      />
      {!hideFormatSelection ? <label className="deck-publication-format">
        フォーマット
        <select
          value={publicationFormat}
          onChange={(event) => {
            const nextFormat = event.target.value;
            if (!hasControlledFormat) {
              setLocalPublicationFormat(nextFormat);
            }
            onFormatChange?.(nextFormat);
            clearPublicationFeedback();
          }}
        >
          <option value="">選択してください</option>
          {formatOptions.map((formatName) => (
            <option key={formatName} value={formatName}>
              {formatName}
            </option>
          ))}
        </select>
      </label> : null}
      {!normalizedPublicationFormat ? (
        <p className="deck-publication-message has-error" role="status">
          {`公開するには${preflightError?.message || "フォーマットを選択してください。"}`}
        </p>
      ) : null}
      {isPublicationValidationSkipped ? (
        <p className="deck-publication-validation-note">
          登録済みのレギュレーションがないため、公開時のフォーマット適合チェックは行われません。
        </p>
      ) : null}
      {preflightViolations.length > 0 ? (
        <div className="deck-publication-message has-error" role="status">
          <p>{preflightError.summary}</p>
          <details className="deck-publication-validation-details">
            <summary>{`違反の詳細（${preflightViolations.length}件）`}</summary>
            <ul>
              {preflightViolations.map((violation, index) => (
                <li
                  key={`${violation.code || "violation"}-${
                    violation.cardName || index
                  }-${index}`}
                >
                  {violation.message}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
      <div className="deck-publication-actions">
        <button
          type="button"
          className="deck-secondary-button"
          onClick={() => handlePublicationSubmit(false)}
          disabled={isPublishing || isLoading || !deck.isPublic}
        >
          {isCurrentDeckPublishing ? "更新中..." : "非公開にする"}
        </button>
        <button
          type="button"
          className="deck-primary-button"
          onClick={() => handlePublicationSubmit(true)}
          disabled={
            isPublishing ||
            isLoading ||
            !normalizedPublicationFormat ||
            preflightViolations.length > 0
          }
        >
          {isCurrentDeckPublishing
            ? "更新中..."
            : deck.isPublic
            ? "公開内容を更新"
            : "公開する"}
        </button>
      </div>
      {publicationMessage ? (
        <div
          className={
            publicationHasError
              ? "deck-publication-message has-error"
              : "deck-publication-message"
          }
          role={publicationHasError ? "alert" : "status"}
        >
          <p>{publicationMessage}</p>
          {publicationViolations.length > 0 ? (
            <ul>
              {publicationViolations.map((violation, index) => (
                <li
                  key={`${violation.code || "violation"}-${
                    violation.cardName || index
                  }-${index}`}
                >
                  {violation.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
