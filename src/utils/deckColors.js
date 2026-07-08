export const DECK_COLOR_MAP = {
  青: "#4f9ad9",
  緑: "#72a84f",
  赤: "#d75b4f",
  黒: "#4d545a",
  白: "#f0eee6",
  茶: "#b78b4b",
  紫: "#9b6fc9",
};

const COLOR_ORDER = ["青", "緑", "赤", "黒", "白", "茶", "紫"];

function splitColorText(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/[／/・,、\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeColorName(value) {
  const text = String(value || "").trim();
  return COLOR_ORDER.find((color) => text === color || text.includes(color)) || "";
}

function getCardColors(card) {
  return [
    card?.sp_power_color1_name,
    card?.sp_power_color2_name,
    ...splitColorText(card?.color),
  ]
    .map(normalizeColorName)
    .filter(Boolean);
}

export function getDeckColors(items) {
  const names = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    getCardColors(item?.card || item).forEach((colorName) => names.add(colorName));
  });

  return COLOR_ORDER.filter((name) => names.has(name)).map((name) => ({
    name,
    value: DECK_COLOR_MAP[name],
  }));
}
