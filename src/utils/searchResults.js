import {
  CARD_TYPE_OPTIONS,
  CHARACTER_EXTRA_OPTIONS,
  CHAR_FEATURE_OPTIONS,
  COLOR_EXCLUDE_OPTIONS,
  COLOR_INCLUDE_OPTIONS,
  OTHER_FEATURE_OPTIONS,
  SET_EXTRA_OPTIONS_BB,
  SET_EXTRA_OPTIONS_DB,
  SET_EXTRA_OPTIONS_EX,
  SET_EXTRA_OPTIONS_ST,
  SET_INCLUDED_OPTIONS,
  SET_NAME_TO_CODE,
  UNIT_EXTRA_OPTIONS,
  UNIT_FEATURE_OPTIONS,
} from "../data/searchOptions";

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

export function formatSearchResultsSummary(total, page, totalPages) {
  return `全${total}件・${page} / ${totalPages}ページ`;
}

function hasSummaryValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  // 色やカードタイプは数値へ変換して読むため、壊れたURL(手編集や旧形式の
  // ブックマーク)では NaN になりうる。要約に「NaN」と出さない。
  if (typeof value === "number") return Number.isFinite(value);
  return value !== null && value !== undefined && value !== false;
}

function getOptionLabels(value, options) {
  const values = Array.isArray(value) ? value : hasSummaryValue(value) ? [value] : [];

  return values
    .map((item) => {
      const itemValue = typeof item === "object" && item !== null ? item.value : item;
      const itemLabel = typeof item === "object" && item !== null ? item.label : "";
      const option = options.find(({ value: optionValue }) => (
        String(optionValue) === String(itemValue)
      ));
      // 選択肢に無く、ラベルも無い壊れた値は要約に出さない(NaN対策)
      if (!option && !itemLabel && !hasSummaryValue(itemValue)) return "";
      return option?.label || itemLabel || String(itemValue ?? "");
    })
    .filter(Boolean)
    .join("、");
}

function formatRange(minimum, maximum) {
  const hasMinimum = hasSummaryValue(minimum);
  const hasMaximum = hasSummaryValue(maximum);

  if (hasMinimum && hasMaximum) return `${minimum}〜${maximum}`;
  if (hasMinimum) return `${minimum}以上`;
  if (hasMaximum) return `${maximum}以下`;
  return "";
}

const DECK_RANGE_TYPE_LABELS = {
  tensaku: "添削杯",
  classic: "クラシック",
  rising: "ライジング",
};

function formatDeckRangeDate(value) {
  if (!hasSummaryValue(value)) return "";

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);

  const [, year, month, day] = match;
  return `${year}年${Number(month)}月${Number(day)}日まで`;
}

// URLに保存された検索条件を、結果画面で読み直せる日本語の要約へ変換する。
export function buildSearchCriteriaSummary(params = {}) {
  const summary = [];
  const add = (key, label, value) => {
    if (!hasSummaryValue(value)) return;
    summary.push({ key, label, value: String(value) });
  };
  const addOptions = (key, label, options) => {
    add(key, label, getOptionLabels(params[key], options));
  };
  const addRange = (key, label, minimumKey, maximumKey) => {
    add(key, label, formatRange(params[minimumKey], params[maximumKey]));
  };

  if (hasSummaryValue(params.name)) {
    add(
      "name",
      "カード名",
      params.name_forward ? `${params.name}（前方一致）` : params.name
    );
  } else if (params.name_forward) {
    add("name_forward", "カード名の一致", "前方一致");
  }

  addOptions("cardType", "カードタイプ", CARD_TYPE_OPTIONS);
  addOptions("colorInclude", "含む色", COLOR_INCLUDE_OPTIONS);
  addOptions("colorExclude", "除外する色", COLOR_EXCLUDE_OPTIONS);
  if (params.colorMulti === "not") add("colorMulti", "多色", "除く");

  addRange("spCost", "指定国力", "spCostMin", "spCostMax");
  addRange("totalCost", "合計国力", "totalCostMin", "totalCostMax");
  addRange("resourceCost", "資源コスト", "resourceCostMin", "resourceCostMax");
  if (params.includeUndecided) add("includeUndecided", "国力", "Xも含む");

  add("text", "カードテキスト", params.text);
  addRange("fight", "格闘", "fightMin", "fightMax");
  addRange("shoot", "射撃", "shootMin", "shootMax");
  addRange("defense", "防御", "defenseMin", "defenseMax");
  if (params.includeAltStats === false) {
    add("includeAltStats", "戦闘修正", "変形状態を含めない");
  }

  add("terrain", "地形適正", Array.isArray(params.terrain) ? params.terrain.join("、") : params.terrain);
  addOptions("unitFeature", "UNIT特徴", UNIT_FEATURE_OPTIONS);
  addOptions("unitFeatureExtra", "UNIT追加特徴", UNIT_EXTRA_OPTIONS);
  addOptions("charFeature", "CHARACTER特徴", CHAR_FEATURE_OPTIONS);
  addOptions("charFeatureExtra", "CHARACTER追加特徴", CHARACTER_EXTRA_OPTIONS);
  addOptions("otherFeature", "その他の特徴", OTHER_FEATURE_OPTIONS);
  add("traitText", "所属・系統", params.traitText);
  if (params.traits_logic === "or") add("traits_logic", "特徴の一致", "いずれかを含む");
  add("exclusivePilotText", "専用", params.exclusivePilotText);

  if (hasSummaryValue(params.formatName)) {
    // 現行URLではフォーマット名が権威値。旧URL用の内部値と重複表示しない。
    add("formatName", "構築範囲", params.formatName);
  } else {
    if (hasSummaryValue(params.deckRangeType) && params.deckRangeType !== "none") {
      add(
        "deckRangeType",
        "構築範囲",
        DECK_RANGE_TYPE_LABELS[params.deckRangeType] || "日付による指定"
      );
    }
    add("deckRangeDetail", "収録日の上限", formatDeckRangeDate(params.deckRangeDetail));
  }
  if (params.exclude === "banned") add("exclude", "禁止制限", "禁止カードを除く");
  if (params.exclude === "restricted") add("exclude", "禁止制限", "制限カードを除く");

  addOptions("setIncluded", "収録弾", SET_INCLUDED_OPTIONS);
  addOptions("setFeatureExtraBB", "BB・EB", SET_EXTRA_OPTIONS_BB);
  addOptions("setFeatureExtraST", "スターター", SET_EXTRA_OPTIONS_ST);
  addOptions("setFeatureExtraDB", "特殊ブースター", SET_EXTRA_OPTIONS_DB);
  addOptions("setFeatureExtraEX", "その他の収録弾", SET_EXTRA_OPTIONS_EX);

  return summary;
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
