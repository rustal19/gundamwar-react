import React, { useEffect, useMemo, useRef, useState } from "react";
import { resolveCardReference, searchCardsByName } from "../services/cardSearch";
import "./RegulationCardInput.css";

const CARD_ID_PATTERN = /^\d{9}$/;
const EMPTY_STATE = {
  selectedCards: [],
  rows: [],
  draft: "",
  resolveVersion: 0,
};

let rowSequence = 0;

function nextRowId() {
  rowSequence += 1;
  return `regulation-card-row-${rowSequence}`;
}

function normalizeReference(value) {
  return String(value ?? "").trim();
}

function normalizeSelectedCard(card) {
  const cardId = normalizeReference(card?.cardId);
  if (!cardId) return null;
  return {
    ...card,
    cardId,
    name: normalizeReference(card?.name),
  };
}

function linesWithNumbers(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((input, index) => ({ input: input.trim(), lineNumber: index + 1 }))
    .filter((line) => line.input);
}

function addSelectedCard(selectedCards, card) {
  const normalized = normalizeSelectedCard(card);
  if (!normalized) return selectedCards;
  const existingIndex = selectedCards.findIndex((item) => item.cardId === normalized.cardId);
  if (existingIndex < 0) return [...selectedCards, normalized];
  if (!normalized.name || selectedCards[existingIndex].name === normalized.name) return selectedCards;
  return selectedCards.map((item, index) =>
    index === existingIndex ? { ...item, ...normalized } : item
  );
}

export function createRegulationCardState(
  references,
  { trustExistingIds = false, knownCards = [] } = {}
) {
  const knownById = new Map(
    (Array.isArray(knownCards) ? knownCards : [])
      .map(normalizeSelectedCard)
      .filter(Boolean)
      .map((card) => [card.cardId, card])
  );
  let selectedCards = [];
  const rows = [];

  (Array.isArray(references) ? references : []).forEach((reference, index) => {
    const input = normalizeReference(reference);
    if (!input) return;
    const knownCard = knownById.get(input);
    if (knownCard || (trustExistingIds && CARD_ID_PATTERN.test(input))) {
      selectedCards = addSelectedCard(
        selectedCards,
        knownCard || { cardId: input, name: "", isTrustedExistingId: true }
      );
      return;
    }
    rows.push({
      id: nextRowId(),
      input,
      lineNumber: index + 1,
      status: "pending",
      candidates: [],
      message: "解決中です。",
      origin: "existing",
    });
  });

  return {
    selectedCards,
    rows,
    draft: "",
    resolveVersion: rows.length ? 1 : 0,
  };
}

export function getRegulationCardIds(state) {
  const seen = new Set();
  return (state?.selectedCards || []).reduce((ids, card) => {
    const cardId = normalizeReference(card?.cardId);
    if (!cardId || seen.has(cardId)) return ids;
    seen.add(cardId);
    ids.push(cardId);
    return ids;
  }, []);
}

export function getRegulationCardReferences(state) {
  return [
    ...getRegulationCardIds(state),
    ...(state?.rows || []).map((row) => normalizeReference(row.input)).filter(Boolean),
  ];
}

function rowStatusMessage(row) {
  if (row.status === "pending" || row.status === "resolving") return "解決中";
  if (row.status === "ambiguous") return row.message || "候補を選択してください";
  if (row.status === "error") return `未解決（検索エラー）: ${row.message || "カード検索に失敗しました"}`;
  return `未解決: ${row.message || "一致するカードが見つかりません"}`;
}

export function getRegulationCardErrors(label, state) {
  const draftErrors = linesWithNumbers(state?.draft).map(
    (line) =>
      `${label} 一括入力${line.lineNumber}行目「${line.input}」: 未処理です。「一括解決」を実行してください。`
  );
  const rowErrors = (state?.rows || []).map(
    (row) =>
      `${label} ${row.lineNumber || 1}行目「${normalizeReference(row.input) || "空欄"}」: ${rowStatusMessage(row)}`
  );
  return [...draftErrors, ...rowErrors];
}

function displayCardLabel(card) {
  return card.name ? `${card.name} (${card.cardId})` : `カード名未取得 (${card.cardId})`;
}

export default function RegulationCardInput({
  idPrefix,
  label,
  value,
  onChange,
  allowBulk = true,
  maxSelectedCards = Infinity,
}) {
  const state = value || EMPTY_STATE;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef(null);
  const rowsToResolve = useMemo(
    () => state.rows.filter((row) => row.status === "pending" || row.status === "resolving"),
    [state.rows]
  );
  const rowsToResolveKey = rowsToResolve
    .map((row) => `${row.id}:${normalizeReference(row.input)}`)
    .join("|");

  useEffect(() => {
    if (!rowsToResolve.length) return undefined;
    const abortController = new AbortController();
    const resolvingIds = new Set(rowsToResolve.map((row) => row.id));

    onChange((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        resolvingIds.has(row.id) ? { ...row, status: "resolving", message: "解決中です。" } : row
      ),
    }));

    const run = async () => {
      const outcomesByInput = new Map();
      const outcomesById = new Map();

      for (const row of rowsToResolve) {
        const input = normalizeReference(row.input);
        if (!input) {
          outcomesById.set(row.id, {
            status: "unresolved",
            candidates: [],
            message: "カード名を入力してください。",
          });
          continue;
        }
        if (!outcomesByInput.has(input)) {
          try {
            outcomesByInput.set(
              input,
              await resolveCardReference(input, { signal: abortController.signal })
            );
          } catch (error) {
            if (error.name === "AbortError" || abortController.signal.aborted) return;
            outcomesByInput.set(input, {
              status: "error",
              candidates: [],
              message: error.message || "カード検索に失敗しました。",
            });
          }
        }
        outcomesById.set(row.id, outcomesByInput.get(input));
      }

      if (abortController.signal.aborted) return;
      onChange((current) => {
        let selectedCards = current.selectedCards;
        const rows = current.rows.reduce((nextRows, row) => {
          const outcome = outcomesById.get(row.id);
          if (!outcome || (row.status !== "pending" && row.status !== "resolving")) {
            nextRows.push(row);
            return nextRows;
          }
          if (outcome.status === "resolved") {
            selectedCards = addSelectedCard(selectedCards, outcome.card);
            return nextRows;
          }
          nextRows.push({
            ...row,
            status: outcome.status,
            candidates: outcome.candidates || [],
            message: outcome.message || "未解決です。",
          });
          return nextRows;
        }, []);
        return { ...current, selectedCards, rows };
      });
    };

    run();
    return () => abortController.abort();
    // Rows are deliberately processed by versioned batches. Depending on the
    // controlled value here would abort the request when a row becomes "resolving".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.resolveVersion, rowsToResolveKey]);

  useEffect(
    () => () => {
      searchAbortRef.current?.abort();
    },
    []
  );

  const selectCard = (card, rowId = "") => {
    const normalized = normalizeSelectedCard(card);
    if (!normalized) return;
    onChange((current) => {
      const selectedCards = addSelectedCard(current.selectedCards, normalized);
      const parsedMaximum = Number(maxSelectedCards);
      const normalizedMaximum = Number.isFinite(parsedMaximum)
        ? Math.max(0, Math.floor(parsedMaximum))
        : null;
      const limitedCards =
        normalizedMaximum != null
          ? normalizedMaximum === 0
            ? []
            : selectedCards.slice(-normalizedMaximum)
          : selectedCards;
      return {
        ...current,
        selectedCards: limitedCards,
        rows: current.rows.filter((row) =>
          rowId
            ? row.id !== rowId
            : row.input !== normalized.name && row.input !== normalized.cardId
        ),
      };
    });
    if (!rowId) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchTotal(0);
      setSearchError("");
    }
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchError("カード名を入力してください。");
      return;
    }
    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    setIsSearching(true);
    setSearchError("");
    try {
      const result = await searchCardsByName(query, { signal: abortController.signal });
      setSearchResults(result.cards);
      setSearchTotal(result.total);
      if (!result.cards.length) setSearchError("一致するカードが見つかりません。");
    } catch (error) {
      if (error.name === "AbortError") return;
      setSearchResults([]);
      setSearchTotal(0);
      setSearchError(error.message || "カード検索に失敗しました。");
    } finally {
      if (searchAbortRef.current === abortController) setIsSearching(false);
    }
  };

  const processDraft = () => {
    const lines = linesWithNumbers(state.draft);
    if (!lines.length) return;
    onChange((current) => ({
      ...current,
      draft: "",
      rows: [
        ...current.rows,
        ...lines.map((line) => ({
          id: nextRowId(),
          input: line.input,
          lineNumber: line.lineNumber,
          status: "pending",
          candidates: [],
          message: "解決中です。",
          origin: "bulk",
        })),
      ],
      resolveVersion: current.resolveVersion + 1,
    }));
  };

  const updateRowInput = (rowId, input) => {
    onChange((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              input,
              status: "unresolved",
              candidates: [],
              message: "編集後に「再解決」を実行してください。",
            }
          : row
      ),
    }));
  };

  const retryRow = (rowId) => {
    onChange((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? { ...row, status: "pending", candidates: [], message: "解決中です。" }
          : row
      ),
      resolveVersion: current.resolveVersion + 1,
    }));
  };

  const removeRow = (rowId) => {
    onChange((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== rowId),
    }));
  };

  const isResolving = rowsToResolve.length > 0;
  const searchListId = `${idPrefix}-search-results`;
  const bulkHelpId = `${idPrefix}-bulk-help`;

  return (
    <fieldset className="tournament-form-wide regulation-card-input">
      <legend>{label}</legend>

      <div className="regulation-card-search-row">
        <div className="regulation-card-control">
          <label htmlFor={`${idPrefix}-search`}>{label}を検索</label>
          <input
            id={`${idPrefix}-search`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              runSearch();
            }}
            aria-controls={searchListId}
            autoComplete="off"
          />
        </div>
        <button type="button" onClick={runSearch} disabled={isSearching}>
          {isSearching ? "検索中..." : `${label}の候補を検索`}
        </button>
      </div>

      {searchError ? <p className="regulation-card-search-error" role="alert">{searchError}</p> : null}
      {searchResults.length ? (
        <div id={searchListId} className="regulation-card-search-results">
          <p>
            {searchTotal}件の候補があります。追加するカードを選んでください。
            {searchTotal > searchResults.length ? "（先頭200件を表示）" : ""}
          </p>
          <ul>
            {searchResults.map((card) => (
              <li key={card.cardId}>
                <button type="button" onClick={() => selectCard(card)}>
                  {displayCardLabel(card)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="regulation-card-selected" aria-label={`追加済みの${label}`}>
        {state.selectedCards.length ? (
          state.selectedCards.map((card) => {
            const cardLabel = displayCardLabel(card);
            return (
              <span key={card.cardId} className="regulation-card-chip">
                <span>{cardLabel}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      selectedCards: current.selectedCards.filter(
                        (item) => item.cardId !== card.cardId
                      ),
                    }))
                  }
                  aria-label={`${cardLabel} を削除`}
                >
                  ×
                </button>
              </span>
            );
          })
        ) : (
          <span className="tournament-muted">追加済みのカードはありません。</span>
        )}
      </div>

      {allowBulk ? (
        <div className="regulation-card-bulk">
          <label htmlFor={`${idPrefix}-bulk`}>{label}一括入力</label>
          <textarea
            id={`${idPrefix}-bulk`}
            value={state.draft}
            onChange={(event) =>
              onChange((current) => ({ ...current, draft: event.target.value }))
            }
            placeholder="カード名を1行に1件ずつ貼り付け"
            aria-describedby={bulkHelpId}
            aria-invalid={Boolean(state.draft.trim())}
          />
          <p id={bulkHelpId} className="tournament-muted">
            カード名を改行区切りで入力してください。カードIDの直接検索には対応していないため、IDはカード名に直して解決してください。
          </p>
          <button type="button" onClick={processDraft} disabled={!state.draft.trim()}>
            {label}を一括解決
          </button>
        </div>
      ) : null}

      {state.rows.length ? (
        <div className="regulation-card-unresolved" role="alert">
          <strong>未解決の行があります。すべて解決または削除するまで保存できません。</strong>
          <ul>
            {state.rows.map((row) => {
              const statusText = `${label} ${row.lineNumber || 1}行目「${normalizeReference(row.input) || "空欄"}」: ${rowStatusMessage(row)}`;
              const visibleCandidates = (row.candidates || []).slice(0, 20);
              return (
                <li key={row.id} className="regulation-card-unresolved-row">
                  <strong>{statusText}</strong>
                  <div className="regulation-card-unresolved-actions">
                    <input
                      value={row.input}
                      onChange={(event) => updateRowInput(row.id, event.target.value)}
                      aria-label={`${label} ${row.lineNumber || 1}行目を修正`}
                      aria-invalid="true"
                    />
                    <button
                      type="button"
                      onClick={() => retryRow(row.id)}
                      disabled={!normalizeReference(row.input) || row.status === "resolving"}
                    >
                      再解決
                    </button>
                    <button type="button" onClick={() => removeRow(row.id)}>
                      この行を削除
                    </button>
                  </div>
                  {visibleCandidates.length ? (
                    <div className="regulation-card-row-candidates" aria-label={`${statusText}の候補`}>
                      <span>候補:</span>
                      {visibleCandidates.map((card) => (
                        <button key={card.cardId} type="button" onClick={() => selectCard(card, row.id)}>
                          {displayCardLabel(card)}
                        </button>
                      ))}
                      {row.candidates.length > visibleCandidates.length ? (
                        <span>候補が多いため先頭20件を表示しています。カード名を修正して絞り込んでください。</span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {isResolving ? <p className="tournament-muted" aria-live="polite">{label}を解決しています...</p> : null}
    </fieldset>
  );
}
