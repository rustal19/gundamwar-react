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

const MULTI_SELECT_KEYS = [
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
