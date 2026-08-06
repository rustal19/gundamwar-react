import { SET_NAME_TO_CODE } from "../data/searchOptions";

export const API_SEARCH_URL =
  process.env.REACT_APP_API_SEARCH_URL || "https://gundamwar.net/api/search";

const COLOR_MAP = {
  青: "#BCDFFD",
  緑: "#CEE29C",
  黒: "#C9CECE",
  赤: "#FFC9BF",
  茶: "#FFF692",
  白: "#ebebe6",
  紫: "#DDB0E7",
};

function splitColorCandidates(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/[/／]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getCardColorNames(card) {
  const fallbackColors = splitColorCandidates(card?.color);
  const primaryName = card?.sp_power_color1_name || fallbackColors[0] || "";
  const secondaryName = card?.sp_power_color2_name || fallbackColors[1] || "";

  return {
    primaryName,
    secondaryName,
  };
}

export const MULTI_SELECT_KEYS = [
  "cardType",
  "colorInclude",
  "colorExclude",
  "terrain",
  "unitFeature",
  "unitFeatureExtra",
  "charFeature",
  "charFeatureExtra",
  "otherFeature",
  "setIncluded",
  "setFeatureExtraBB",
  "setFeatureExtraST",
  "setFeatureExtraDB",
  "setFeatureExtraEX",
];

const RAW_STRING_KEYS = ["name", "text", "traitText", "exclusivePilotText"];

function autoConvert(value) {
  if (typeof value !== "string" || value.trim() === "") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? value : numericValue;
}

function normalizeFormatValue(value) {
  return String(value ?? "").trim();
}

function normalizeFormatList(values) {
  return (Array.isArray(values) ? values : [])
    .map(normalizeFormatValue)
    .filter(Boolean);
}

export function parseSearchParams(search) {
  const params = new URLSearchParams(search);
  const parsed = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);
    if (MULTI_SELECT_KEYS.includes(key)) {
      try {
        parsed[key] = JSON.parse(values[0]);
      } catch (error) {
        parsed[key] = values;
      }
      continue;
    }
    parsed[key] = values.length > 1 ? values : values[0];
  }

  Object.keys(parsed).forEach((key) => {
    if (RAW_STRING_KEYS.includes(key)) return;
    if (Array.isArray(parsed[key])) {
      parsed[key] = parsed[key].map(autoConvert);
    } else {
      parsed[key] = autoConvert(parsed[key]);
    }
  });

  if (parsed.colorInclude) {
    const colors = Array.isArray(parsed.colorInclude)
      ? parsed.colorInclude
      : [parsed.colorInclude];
    parsed.colorInclude = colors.map((value) => Number(value));
  }

  return parsed;
}

// ページング・並び順・レイアウトフラグは「検索条件」に数えない。
const NON_CRITERIA_KEYS = new Set([
  "page",
  "pageSize",
  "mobileLayout",
  "sortMethod",
  "sortOrder",
]);

// 既定値のままなら実質的な絞り込みではないので条件に数えない。
const NON_CRITERIA_DEFAULTS = {
  colorMulti: "able",
  deckRangeType: "none",
  exclude: "no",
  includeAltStats: true,
  name_forward: false,
  traits_logic: "and",
};

// URLのパラメータに実質的な検索条件が含まれているか。
// /search でフォーム表示と結果表示を排他的に切り替えるために使う
// (条件なし=フォーム、条件あり=結果。本番と同じ挙動)。
export function hasSearchCriteria(params) {
  return Object.entries(params).some(([key, value]) => {
    if (NON_CRITERIA_KEYS.has(key)) return false;
    if (Object.prototype.hasOwnProperty.call(NON_CRITERIA_DEFAULTS, key)) {
      return value !== NON_CRITERIA_DEFAULTS[key];
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim() !== "";
    if (typeof value === "boolean") return value;
    return value !== null && value !== undefined && value !== "";
  });
}

export function getCardFormatStatus(card, regulation) {
  const cardId = normalizeFormatValue(card?.cardId);
  const bannedCardIds = new Set(normalizeFormatList(regulation?.bannedCards));
  const limitedCardIds = new Set(normalizeFormatList(regulation?.limitedCards));

  return {
    isBanned: Boolean(cardId) && bannedCardIds.has(cardId),
    isLimited: Boolean(cardId) && limitedCardIds.has(cardId),
  };
}

// フォーマットの使用可能収録弾(日本語名で保持)を、検索APIのsetIncludedが
// 期待する収録弾コードへ変換する。allowedSetsが無い(全弾許可)場合はnullを返し、
// プールのサーバー側フィルタを行わない。範囲外カードは結果に出さない方針のため、
// クライアント側の「範囲外」判定は持たない。
export function getFormatSetCodes(regulation) {
  if (!Array.isArray(regulation?.allowedSets)) return null;
  const codes = normalizeFormatList(regulation.allowedSets)
    .map((name) => SET_NAME_TO_CODE[name] || name);
  return codes.length > 0 ? codes : null;
}

export function buildBackgroundStyle(card) {
  const { primaryName, secondaryName } = getCardColorNames(card);
  const color1 = COLOR_MAP[primaryName] || "#f5f5f5";
  const color2 = COLOR_MAP[secondaryName] || null;

  if (color2) {
    return {
      background: `linear-gradient(to right, ${color1} 50%, ${color2} 50%)`,
    };
  }

  return {
    backgroundColor: color1,
  };
}

export function buildEnvironmentLabel(card) {
  return [
    card.space === 1 ? "[宇宙]" : null,
    card.earth === 1 ? "[地球]" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function splitCommaText(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
