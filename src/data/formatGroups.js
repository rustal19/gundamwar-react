import { FORMAT_PRESETS, OTHER_FORMAT_NAME } from "./formats";

export const FORMAT_GROUP_KEYS = {
  ALL: "all",
  NONE: "none",
  STANDARD: "standard",
  KANSAI_CLASSIC: "kansaiClassic",
  KANSAI_RISING: "kansaiRising",
  ALPHA_STANDARD: "alphaStd",
  TENSAKU: "tensaku",
  OTHER: "other",
};

export const STANDARD_FORMAT_NAME = "スタンダード";
export const KANSAI_CLASSIC_FORMAT_NAME = "関西クラシック";
export const KANSAI_RISING_FORMAT_NAME = "関西ライジング";
export const ALPHA_STANDARD_FORMAT_NAME = "αスタンダード";
export const STANDALONE_FORMAT_NAMES = [
  KANSAI_CLASSIC_FORMAT_NAME,
  KANSAI_RISING_FORMAT_NAME,
  ALPHA_STANDARD_FORMAT_NAME,
];

const presetFormatNames = [
  ...new Set(FORMAT_PRESETS.map(({ name }) => name).filter(Boolean)),
];

export const TENSAKU_FORMAT_NAMES = presetFormatNames.filter((name) =>
  name.startsWith("添削杯")
);

export const OTHER_FORMAT_NAMES = presetFormatNames.filter(
  (name) =>
    name !== STANDARD_FORMAT_NAME &&
    !name.startsWith("添削杯") &&
    !STANDALONE_FORMAT_NAMES.includes(name)
);

export const FORMAT_GROUPS = [
  {
    key: FORMAT_GROUP_KEYS.STANDARD,
    label: "スタンダード",
    formatNames: [STANDARD_FORMAT_NAME],
  },
  {
    key: FORMAT_GROUP_KEYS.KANSAI_CLASSIC,
    label: "クラシック",
    formatNames: [KANSAI_CLASSIC_FORMAT_NAME],
  },
  {
    key: FORMAT_GROUP_KEYS.KANSAI_RISING,
    label: "ライジング",
    formatNames: [KANSAI_RISING_FORMAT_NAME],
  },
  {
    key: FORMAT_GROUP_KEYS.ALPHA_STANDARD,
    label: "αスタンダード",
    formatNames: [ALPHA_STANDARD_FORMAT_NAME],
  },
  {
    key: FORMAT_GROUP_KEYS.TENSAKU,
    label: "添削杯",
    formatNames: TENSAKU_FORMAT_NAMES,
  },
  {
    key: FORMAT_GROUP_KEYS.OTHER,
    label: "その他",
    formatNames: OTHER_FORMAT_NAMES,
  },
];

export const SEARCH_FORMAT_GROUPS = [
  { key: FORMAT_GROUP_KEYS.NONE, label: "指定なし", formatNames: [] },
  ...FORMAT_GROUPS.filter(({ key }) => key !== FORMAT_GROUP_KEYS.STANDARD),
];

export const PUBLIC_DECK_FORMAT_GROUPS = [
  { key: FORMAT_GROUP_KEYS.ALL, label: "すべて", formatNames: [] },
  ...FORMAT_GROUPS.map((group) =>
    group.key === FORMAT_GROUP_KEYS.OTHER
      ? { ...group, formatNames: [...group.formatNames, OTHER_FORMAT_NAME] }
      : group
  ),
];

export function deriveFormatGroup(formatName) {
  const normalizedName = String(formatName || "");
  if (!normalizedName) return FORMAT_GROUP_KEYS.NONE;
  if (normalizedName === STANDARD_FORMAT_NAME) return FORMAT_GROUP_KEYS.STANDARD;
  if (normalizedName === KANSAI_CLASSIC_FORMAT_NAME) return FORMAT_GROUP_KEYS.KANSAI_CLASSIC;
  if (normalizedName === KANSAI_RISING_FORMAT_NAME) return FORMAT_GROUP_KEYS.KANSAI_RISING;
  if (normalizedName === ALPHA_STANDARD_FORMAT_NAME) return FORMAT_GROUP_KEYS.ALPHA_STANDARD;
  if (normalizedName.startsWith("添削杯")) return FORMAT_GROUP_KEYS.TENSAKU;
  return FORMAT_GROUP_KEYS.OTHER;
}

export function deriveSearchFormatGroup(formatName) {
  const group = deriveFormatGroup(formatName);
  return group === FORMAT_GROUP_KEYS.STANDARD ? FORMAT_GROUP_KEYS.NONE : group;
}

export function getDefaultFormatName(groupKey, groups = FORMAT_GROUPS) {
  return groups.find(({ key }) => key === groupKey)?.formatNames[0] || "";
}

export function getTensakuRoundLabel(formatName) {
  const normalizedName = String(formatName || "");
  return normalizedName.replace(/^添削杯\s*/, "") || normalizedName || "添削杯";
}
