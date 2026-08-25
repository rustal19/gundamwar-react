import React from "react";
import { SET_RELEASE_ORDER_OPTIONS } from "../data/searchOptions";
import "./RegulationCardInput.css";
import "./RegulationSetInput.css";

export const REGULATION_SET_MODES = {
  UNRESTRICTED: "unrestricted",
  SELECT: "select",
  CUTOFF: "cutoff",
};

const KNOWN_SET_NAMES = new Set(SET_RELEASE_ORDER_OPTIONS.map((option) => option.label));

function normalizeSetNames(value) {
  const values = Array.isArray(value)
    ? value
    : value == null
      ? null
      : String(value).split(/\r?\n|,/);
  if (values == null) return null;
  return values.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

export function createRegulationSetState(allowedSets) {
  const originalAllowedSets = normalizeSetNames(allowedSets);
  if (originalAllowedSets == null || originalAllowedSets.length === 0) {
    return {
      mode: REGULATION_SET_MODES.UNRESTRICTED,
      selectedSets: [],
      cutoffSet: "",
      unknownSets: [],
      originalAllowedSets: null,
      touched: false,
    };
  }

  return {
    mode: REGULATION_SET_MODES.SELECT,
    selectedSets: unique(originalAllowedSets.filter((name) => KNOWN_SET_NAMES.has(name))),
    cutoffSet: "",
    unknownSets: unique(originalAllowedSets.filter((name) => !KNOWN_SET_NAMES.has(name))),
    originalAllowedSets,
    touched: false,
  };
}

export function getRegulationAllowedSets(state) {
  if (!state) return null;

  // 読み込んだ既存値やプリセットは、セット入力を触るまで並びも含めてそのまま保つ。
  if (!state.touched && Object.prototype.hasOwnProperty.call(state, "originalAllowedSets")) {
    return state.originalAllowedSets == null ? null : [...state.originalAllowedSets];
  }

  if (state.mode === REGULATION_SET_MODES.UNRESTRICTED) return null;

  if (state.mode === REGULATION_SET_MODES.CUTOFF) {
    const cutoffIndex = SET_RELEASE_ORDER_OPTIONS.findIndex(
      (option) => option.label === state.cutoffSet
    );
    if (cutoffIndex < 0) return [];
    return SET_RELEASE_ORDER_OPTIONS.slice(0, cutoffIndex + 1).map((option) => option.label);
  }

  const selected = new Set(state.selectedSets || []);
  const selectedInReleaseOrder = SET_RELEASE_ORDER_OPTIONS
    .filter((option) => selected.has(option.label))
    .map((option) => option.label);
  return [...selectedInReleaseOrder, ...unique(state.unknownSets || [])];
}

function selectedCutoffFallback(state) {
  const selected = new Set(state.selectedSets || []);
  const selectedOptions = SET_RELEASE_ORDER_OPTIONS.filter((option) => selected.has(option.label));
  return selectedOptions[selectedOptions.length - 1]?.label || SET_RELEASE_ORDER_OPTIONS[0]?.label || "";
}

function setsThrough(cutoffSet) {
  const cutoffIndex = SET_RELEASE_ORDER_OPTIONS.findIndex(
    (option) => option.label === cutoffSet
  );
  return cutoffIndex < 0
    ? []
    : SET_RELEASE_ORDER_OPTIONS.slice(0, cutoffIndex + 1).map((option) => option.label);
}

export default function RegulationSetInput({ idPrefix = "allowed-sets", value, onChange }) {
  const state = value || createRegulationSetState(null);
  const selected = new Set(state.selectedSets || []);
  const selectedOptions = SET_RELEASE_ORDER_OPTIONS.filter((option) =>
    selected.has(option.label)
  );
  const visibleSelectedOptions = selectedOptions.slice(0, 12);
  const cutoffIndex = SET_RELEASE_ORDER_OPTIONS.findIndex(
    (option) => option.label === state.cutoffSet
  );

  const changeMode = (mode) => {
    onChange((current) => {
      const cutoffSet =
        mode === REGULATION_SET_MODES.CUTOFF && !current.cutoffSet
          ? selectedCutoffFallback(current)
          : current.cutoffSet;
      return {
        ...current,
        mode,
        cutoffSet,
        selectedSets:
          mode === REGULATION_SET_MODES.CUTOFF
            ? setsThrough(cutoffSet)
            : current.selectedSets,
        touched: true,
      };
    });
  };

  const toggleSet = (setName, checked) => {
    onChange((current) => ({
      ...current,
      selectedSets: checked
        ? unique([...(current.selectedSets || []), setName])
        : (current.selectedSets || []).filter((name) => name !== setName),
      touched: true,
    }));
  };

  const removeUnknownSet = (setName) => {
    onChange((current) => ({
      ...current,
      unknownSets: (current.unknownSets || []).filter((name) => name !== setName),
      touched: true,
    }));
  };

  return (
    <fieldset className="tournament-form-wide regulation-card-input regulation-set-input">
      <legend>使用可能セット</legend>

      <div
        className="regulation-set-modes"
        role="radiogroup"
        aria-label="使用可能セットの指定方法"
      >
        <label>
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={state.mode === REGULATION_SET_MODES.UNRESTRICTED}
            onChange={() => changeMode(REGULATION_SET_MODES.UNRESTRICTED)}
          />
          制限なし(全カード)
        </label>
        <label>
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={state.mode === REGULATION_SET_MODES.SELECT}
            onChange={() => changeMode(REGULATION_SET_MODES.SELECT)}
          />
          弾を選ぶ
        </label>
        <label>
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={state.mode === REGULATION_SET_MODES.CUTOFF}
            onChange={() => changeMode(REGULATION_SET_MODES.CUTOFF)}
          />
          この弾まで
        </label>
      </div>

      {state.mode === REGULATION_SET_MODES.SELECT ? (
        <>
          <p className="tournament-muted regulation-set-help">
            使用できる弾を複数選択できます。保存時は収録弾の日本語名で保持されます。
          </p>
          <div className="regulation-set-options" role="group" aria-label="使用可能な弾">
            {SET_RELEASE_ORDER_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="checkbox"
                  checked={selected.has(option.label)}
                  onChange={(event) => toggleSet(option.label, event.target.checked)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="regulation-card-selected" aria-label="選択中の使用可能セット">
            {selectedOptions.length ? (
              <>
                {visibleSelectedOptions.map((option) => (
                  <span key={option.value} className="regulation-card-chip">
                    <span>{option.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleSet(option.label, false)}
                      aria-label={`${option.label} を選択解除`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {selectedOptions.length > visibleSelectedOptions.length ? (
                  <span className="tournament-muted">
                    ほか{selectedOptions.length - visibleSelectedOptions.length}弾を選択中
                  </span>
                ) : null}
              </>
            ) : (
              <span className="tournament-muted">選択中の弾はありません。</span>
            )}
          </div>
        </>
      ) : null}

      {state.mode === REGULATION_SET_MODES.CUTOFF ? (
        <div className="regulation-set-cutoff">
          <label htmlFor={`${idPrefix}-cutoff`}>カットオフの弾</label>
          <select
            id={`${idPrefix}-cutoff`}
            value={state.cutoffSet || selectedCutoffFallback(state)}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                cutoffSet: event.target.value,
                selectedSets: setsThrough(event.target.value),
                touched: true,
              }))
            }
          >
            {SET_RELEASE_ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="tournament-muted">
            {cutoffIndex >= 0
              ? `${state.cutoffSet}までの${cutoffIndex + 1}弾を使用可能として保存します。`
              : "選んだ弾までを発売順ですべて使用可能にします。"}
          </p>
        </div>
      ) : null}

      {state.mode !== REGULATION_SET_MODES.UNRESTRICTED && state.unknownSets?.length ? (
        <div className="regulation-set-unknown" role="alert">
          <strong>不明な弾</strong>
          <p>
            {state.mode === REGULATION_SET_MODES.CUTOFF
              ? "一覧と一致しない既存値です。「この弾まで」で保存すると発売順の弾名に置き換わります。"
              : "一覧と一致しない既存値です。削除するまでは「弾を選ぶ」で保存しても保持されます。"}
          </p>
          <div className="regulation-card-selected">
            {state.unknownSets.map((setName) => (
              <span key={setName} className="regulation-card-chip regulation-set-unknown-chip">
                <span>{setName}</span>
                <button
                  type="button"
                  onClick={() => removeUnknownSet(setName)}
                  aria-label={`不明な弾 ${setName} を削除`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
