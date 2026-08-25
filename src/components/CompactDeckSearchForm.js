import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { trackEvent } from "../utils/analytics";
import { preserveForcedMobileLayoutInParams } from "../utils/deviceLayout";
import { parseSearchParams } from "../utils/searchResults";
import { FORMAT_PRESETS } from "../data/formats";
import { FORMAT_GROUPS } from "../data/formatGroups";
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

const FORMAT_PRESET_NAMES = new Set(
  FORMAT_PRESETS.map(({ name }) => String(name || "").trim()).filter(Boolean)
);

const FORMAT_SELECT_GROUPS = FORMAT_GROUPS.map((group) => ({
  ...group,
  formatNames: group.formatNames.filter((name) => FORMAT_PRESET_NAMES.has(name)),
})).filter(({ formatNames }) => formatNames.length > 0);

function createInitialState() {
  return {
    name: "",
    name_forward: false,
    text: "",
    cardType: [],
    colorInclude: [],
    formatName: "",
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

function normalizeFormatName(value) {
  return String(value || "").trim();
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

const CompactDeckSearchForm = ({ onSearch, formatName, onFormatChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = useMemo(() => createInitialState(), []);
  const [formValues, setFormValues] = useState(initialState);
  const pendingFormatSearchRef = useRef(null);
  const isFormatControlled = formatName !== undefined;
  const selectedFormatName = isFormatControlled
    ? normalizeFormatName(formatName)
    : formValues.formatName;
  const isUnknownFormat = Boolean(
    selectedFormatName && !FORMAT_PRESET_NAMES.has(selectedFormatName)
  );

  useEffect(() => {
    const parsed = parseSearchParams(location.search);
    if (pendingFormatSearchRef.current === location.search) {
      pendingFormatSearchRef.current = null;
      setFormValues((current) => ({
        ...current,
        formatName: normalizeFormatName(parsed.formatName),
      }));
      return;
    }

    pendingFormatSearchRef.current = null;
    setFormValues({
      name: parsed.name || "",
      name_forward: Boolean(parsed.name_forward),
      text: parsed.text || "",
      cardType: normalizeStringArray(parsed.cardType),
      colorInclude: normalizeStringArray(parsed.colorInclude),
      formatName: normalizeFormatName(parsed.formatName),
      pageSize: String(parsed.pageSize || 20),
    });
  }, [initialState, location.search]);

  useEffect(() => {
    if (!isFormatControlled) return;

    const query = new URLSearchParams(location.search);
    const urlFormatName = normalizeFormatName(query.get("formatName"));
    const hasLegacyRange = query.has("deckRangeType") || query.has("deckRangeDetail");
    if (urlFormatName === selectedFormatName && !hasLegacyRange) return;

    query.delete("page");
    query.delete("deckRangeType");
    query.delete("deckRangeDetail");
    if (selectedFormatName) {
      query.set("formatName", selectedFormatName);
    } else {
      query.delete("formatName");
    }

    const queryString = query.toString();
    const nextSearch = queryString ? `?${queryString}` : "";
    pendingFormatSearchRef.current = nextSearch;
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch,
      },
      { replace: true }
    );
  }, [
    isFormatControlled,
    location.pathname,
    location.search,
    navigate,
    selectedFormatName,
  ]);

  const toggleArrayValue = (key, value) => {
    setFormValues((current) => {
      const exists = current[key].includes(value);
      return {
        ...current,
        [key]: exists ? current[key].filter((item) => item !== value) : [...current[key], value],
      };
    });
  };

  const handleFormatChange = (nextFormatName) => {
    setFormValues((current) => ({
      ...current,
      formatName: nextFormatName,
    }));
    onFormatChange?.(nextFormatName);
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
      formatName: selectedFormatName,
      page: 1,
    };

    trackEvent("search_submit", {
      search_context: "deck",
      has_name: Boolean(params.name),
      has_text: Boolean(params.text),
      card_type_count: Array.isArray(params.cardType) ? params.cardType.length : 0,
      include_color_count: Array.isArray(params.colorInclude) ? params.colorInclude.length : 0,
      deck_range_type: "none",
      format_name: params.formatName || "",
      page_size: Number(params.pageSize || 0),
    });

    dispatchSearch({
      params,
      queryString: buildQueryString(params, location.search),
    });
  };

  const handleReset = () => {
    setFormValues(initialState);
    onFormatChange?.("");
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
          <span className="compact-inline-label">フォーマット</span>
          <select
            aria-label="フォーマット"
            value={selectedFormatName}
            onChange={(event) => handleFormatChange(event.target.value)}
          >
            <option value="">指定なし</option>
            {isUnknownFormat ? (
              <optgroup label="保存済みフォーマット">
                <option value={selectedFormatName}>{selectedFormatName}</option>
              </optgroup>
            ) : null}
            {FORMAT_SELECT_GROUPS.map(({ key, label, formatNames }) => (
              <optgroup key={key} label={label}>
                {formatNames.map((presetName) => (
                  <option key={presetName} value={presetName}>
                    {presetName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

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
