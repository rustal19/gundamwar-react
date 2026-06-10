const IMAGE_EXTENSIONS = ["webp", "jpg", "png"];
const DEFAULT_IMAGE_BASE_URL =
  process.env.REACT_APP_CARD_IMAGE_BASE_URL || "/card-images";
const DEFAULT_THUMB_IMAGE_BASE_URL =
  process.env.REACT_APP_CARD_THUMB_IMAGE_BASE_URL || "/card-images-thumb";
const DEFAULT_BASIC_G_IMAGE_BASE_URL = "/basic-g-images";
const DEFAULT_BASIC_G_THUMB_IMAGE_BASE_URL = "/basic-g-images-thumb";

const CARD_TYPE_LABELS = {
  1: "UNIT",
  2: "CHARACTER",
  3: "COMMAND",
  4: "OPERATION",
  10: "GENERATION",
  11: "ACE",
};

function sanitizeStem(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_");
}

function replaceExtensionWithWebp(path) {
  return String(path || "").replace(/\.[^./]+$/, ".webp");
}

function toThumbnailPath(path) {
  const normalized = String(path || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith(`${DEFAULT_BASIC_G_IMAGE_BASE_URL}/`)) {
    return replaceExtensionWithWebp(
      normalized.replace(
        `${DEFAULT_BASIC_G_IMAGE_BASE_URL}/`,
        `${DEFAULT_BASIC_G_THUMB_IMAGE_BASE_URL}/`
      )
    );
  }
  if (normalized.startsWith(`${DEFAULT_IMAGE_BASE_URL}/`)) {
    return replaceExtensionWithWebp(
      normalized.replace(
        `${DEFAULT_IMAGE_BASE_URL}/`,
        `${DEFAULT_THUMB_IMAGE_BASE_URL}/`
      )
    );
  }
  return normalized;
}

export function getThumbnailPath(path) {
  return toThumbnailPath(path);
}

export function getCardCode(card) {
  const left = card?.cardNumber1 ? String(card.cardNumber1).trim() : "";
  const right = card?.cardNumber2 ? String(card.cardNumber2).trim() : "";
  return [left, right].filter(Boolean).join("-");
}

export function isBasicGCard(card) {
  return Boolean(card?.basicGColorKey) || String(card?.cardId || "").startsWith("basic-g-");
}

export function getCardTypeLabel(card) {
  const typeName = card?.card_type_name ? String(card.card_type_name).trim() : "";
  if (typeName) return typeName;

  const numericCardType = Number(card?.cardType ?? card?.card_type ?? "");
  if (Number.isFinite(numericCardType) && CARD_TYPE_LABELS[numericCardType]) {
    return CARD_TYPE_LABELS[numericCardType];
  }

  return "OTHER";
}

export function getCardImageCandidates(card, options = {}) {
  const preferThumbnail = options.preferThumbnail !== false;
  const directCandidates = Array.isArray(card?.imageCandidates)
    ? card.imageCandidates
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];
  const directImagePath = card?.imagePath ? String(card.imagePath).trim() : "";
  const stems = [];
  const cardId = card?.cardId != null ? String(card.cardId).trim() : "";
  const cardCode = sanitizeStem(getCardCode(card));

  if (directImagePath) {
    directCandidates.unshift(directImagePath);
  }
  if (cardId) {
    stems.push(cardId);
  }
  if (cardCode) {
    stems.push(cardCode);
  }

  const uniqueDirectCandidates = Array.from(new Set(directCandidates));
  const uniqueStems = Array.from(new Set(stems));
  const thumbnailDirectCandidates = preferThumbnail
    ? uniqueDirectCandidates.map(toThumbnailPath).filter(Boolean)
    : [];
  const thumbnailStemCandidates = preferThumbnail
    ? uniqueStems.flatMap((stem) =>
        IMAGE_EXTENSIONS.map((ext) => `${DEFAULT_THUMB_IMAGE_BASE_URL}/${stem}.${ext}`)
      )
    : [];

  return [
    ...Array.from(new Set(thumbnailDirectCandidates)),
    ...Array.from(new Set(thumbnailStemCandidates)),
    ...uniqueDirectCandidates,
    ...uniqueStems.flatMap((stem) =>
      IMAGE_EXTENSIONS.map((ext) => `${DEFAULT_IMAGE_BASE_URL}/${stem}.${ext}`)
    ),
  ];
}

export function getCardPlaceholderLabel(card) {
  const code = getCardCode(card);
  if (code) return code;
  if (card?.cardId != null) return `ID ${card.cardId}`;
  return "Unknown";
}

export const CARD_IMAGE_BASE_URL = DEFAULT_IMAGE_BASE_URL;
export const CARD_THUMB_IMAGE_BASE_URL = DEFAULT_THUMB_IMAGE_BASE_URL;
