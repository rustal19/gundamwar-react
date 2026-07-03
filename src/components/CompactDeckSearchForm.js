import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { trackEvent } from "../utils/analytics";
import { preserveForcedMobileLayoutInParams } from "../utils/deviceLayout";
import { parseSearchParams } from "../utils/searchResults";
import { DECK_RANGE_PRESET_CUTOFFS, TENSAKU_OPTIONS } from "../data/searchOptions";
import "./CompactDeckSearchForm.css";

const CARD_TYPE_OPTIONS = [
  { label: "UNIT", value: "1" },
  { label: "CHARACTER", value: "2" },
  { label: "COMMAND", value: "3" },
  { label: "OPERATION", value: "4" },
  { label: "GENERATION", value: "10" },
  { label: "ACE", value: "11" },
];

const COLOR_OPTIONS = [
  { label: "青", value: "1", className: "blue" },
  { label: "緑", value: "2", className: "green" },
  { label: "黒", value: "3", className: "black" },
  { label: "赤", value: "4", className: "red" },
  { label: "茶", value: "5", className: "brown" },
  { label: "白", value: "6", className: "white" },
  { label: "紫", value: "7", className: "purple" },
];

const DECK_RANGE_OPTIONS = [
  { label: "指定なし", value: "none" },
  { label: "添削杯", value: "tensaku" },
  { label: "クラシック", value: "classic" },
  { label: "ライジング", value: "rising" },
];

function createInitialState() {
  return {
    name: "",
    name_forward: false,
    text: "",
    cardType: [],
    colorInclude: [],
    deckRangeType: "none",
    deckRangeDetail: "",
    pageSize: "20",
  };
}

function buildQueryString(params, currentSearch) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    if (Array.isArray(value)) {
      if (value.length === 0) return;
      query.set(key, JSON.stringify(value));
      return;
    }

    if (typeof value === "boolean") {
      if (!value) return;
      query.set(key, "true");
      return;
    }

    query.set(key, String(value));
  });

  preserveForcedMobileLayoutInParams(query, currentSearch);
  return query.toString();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function getSelectedLabel(options, values, fallback = "指定なし") {
  if (!Array.isArray(values) || values.length === 0) return fallback;
  const labels = values
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : fallback;
}

function MultiSelectDropdown({ label, options, values, onToggle, renderOption }) {
  return (
    <div className="compact-inline-field compact-search-field-dropdown">
      <span className="compact-inline-label">{label}</span>
      <details className="compact-dropdown">
        <summary className="compact-dropdown-summary">
          <strong>{getSelectedLabel(options, values)}</strong>
        </summary>
        <div className="compact-dropdown-menu">
          {options.map((option) => {
            const checked = values.includes(option.value);
            return (
              <label key={option.value} className="compact-dropdown-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.value)}
                />
                {renderOption ? renderOption(option) : <span>{option.label}</span>}
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}

const CompactDeckSearchForm = ({ onSearch }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = useMemo(() => createInitialState(), []);
  const [formValues, setFormValues] = useState(initialState);

  useEffect(() => {
    const parsed = parseSearchParams(location.search);
    const deckRangeType = parsed.deckRangeType || "none";
    setFormValues({
      name: parsed.name || "",
      name_forward: Boolean(parsed.name_forward),
      text: parsed.text || "",
      cardType: normalizeStringArray(parsed.cardType),
      colorInclude: normalizeStringArray(parsed.colorInclude),
      deckRangeType,
      deckRangeDetail:
        parsed.deckRangeDetail ||
        (DECK_RANGE_PRESET_CUTOFFS[deckRangeType] ? DECK_RANGE_PRESET_CUTOFFS[deckRangeType] : ""),
      pageSize: String(parsed.pageSize || 20),
    });
  }, [initialState, location.search]);

  const toggleArrayValue = (key, value) => {
    setFormValues((current) => {
      const exists = current[key].includes(value);
      return {
        ...current,
        [key]: exists ? current[key].filter((item) => item !== value) : [...current[key], value],
      };
    });
  };

  const handleDeckRangeChange = (nextType) => {
    setFormValues((current) => ({
      ...current,
      deckRangeType: nextType,
      deckRangeDetail:
        DECK_RANGE_PRESET_CUTOFFS[nextType]
          ? DECK_RANGE_PRESET_CUTOFFS[nextType]
          : nextType === "tensaku" && current.deckRangeType === "tensaku"
            ? current.deckRangeDetail
            : "",
    }));
  };

  const dispatchSearch = (payload) => {
    if (typeof onSearch === "function") {
      onSearch(payload);
      return;
    }

    navigate({
      pathname: location.pathname,
      search: payload.queryString ? `?${payload.queryString}` : "",
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const params = {
      ...formValues,
      page: 1,
    };

    if (params.deckRangeType !== "tensaku") {
      delete params.deckRangeDetail;
    }

    trackEvent("search_submit", {
      search_context: "deck",
      has_name: Boolean(params.name),
      has_text: Boolean(params.text),
      card_type_count: Array.isArray(params.cardType) ? params.cardType.length : 0,
      include_color_count: Array.isArray(params.colorInclude) ? params.colorInclude.length : 0,
      deck_range_type: params.deckRangeType || "none",
      page_size: Number(params.pageSize || 0),
    });

    dispatchSearch({
      params,
      queryString: buildQueryString(params, location.search),
    });
  };

  const handleReset = () => {
    setFormValues(initialState);
    const query = new URLSearchParams();
    preserveForcedMobileLayoutInParams(query, location.search);
    dispatchSearch({ params: initialState, queryString: query.toString() });
  };

  return (
    <form className="compact-deck-search" onSubmit={handleSubmit}>
      <div className="compact-search-row compact-search-row-top">
        <div className="compact-search-name-row">
          <label className="compact-inline-field compact-search-field-name compact-inline-field-placeholder">
            <input
              type="text"
              value={formValues.name}
              aria-label="カード名"
              onChange={(event) =>
                setFormValues((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="カード名"
            />
          </label>

          <label className="compact-search-check">
            <input
              type="checkbox"
              checked={formValues.name_forward}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, name_forward: event.target.checked }))
              }
            />
            前方一致
          </label>
        </div>

        <MultiSelectDropdown
          label="カードタイプ"
          options={CARD_TYPE_OPTIONS}
          values={formValues.cardType}
          onToggle={(value) => toggleArrayValue("cardType", value)}
        />

        <label className="compact-inline-field compact-search-field-range">
          <span className="compact-inline-label">構築範囲</span>
          <select
            value={formValues.deckRangeType}
            onChange={(event) => handleDeckRangeChange(event.target.value)}
          >
            {DECK_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {formValues.deckRangeType === "tensaku" ? (
          <label className="compact-inline-field compact-search-field-tensaku">
            <span className="compact-inline-label">回次</span>
            <select
              value={formValues.deckRangeDetail}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  deckRangeDetail: event.target.value,
                }))
              }
            >
              <option value="">選択してください</option>
              {TENSAKU_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <MultiSelectDropdown
          label="色"
          options={COLOR_OPTIONS}
          values={formValues.colorInclude}
          onToggle={(value) => toggleArrayValue("colorInclude", value)}
          renderOption={(option) => (
            <>
              <span className={`compact-color-dot compact-swatch-${option.className}`} />
              <span>{option.label}</span>
            </>
          )}
        />

        <label className="compact-inline-field compact-search-field-small">
          <span className="compact-inline-label">表示件数</span>
          <select
            value={formValues.pageSize}
            onChange={(event) =>
              setFormValues((current) => ({ ...current, pageSize: event.target.value }))
            }
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}件
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compact-search-row compact-search-row-bottom">
        <label className="compact-inline-field compact-search-field-text compact-inline-field-placeholder">
          <input
            type="text"
            value={formValues.text}
            aria-label="カードテキスト"
            onChange={(event) =>
              setFormValues((current) => ({ ...current, text: event.target.value }))
            }
            placeholder="カードテキスト  スペース区切りで AND 検索"
          />
        </label>

        <div className="compact-search-actions">
          <button type="submit" className="compact-search-primary">
            検索
          </button>
          <button type="button" className="compact-search-secondary" onClick={handleReset}>
            リセット
          </button>
        </div>
      </div>
    </form>
  );
};

export default CompactDeckSearchForm;
