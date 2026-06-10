import basicGImageLibrary from "../data/basicGImageLibrary.json";

export const BASIC_G_COLORS = [
  { key: "blue", label: "青" },
  { key: "green", label: "緑" },
  { key: "black", label: "黒" },
  { key: "red", label: "赤" },
  { key: "tea", label: "茶" },
  { key: "white", label: "白" },
  { key: "purple", label: "紫" },
];

function padImageIndex(index) {
  return String(index).padStart(4, "0");
}

export function getBasicGColorConfig(colorKey) {
  return BASIC_G_COLORS.find((color) => color.key === colorKey) || BASIC_G_COLORS[0];
}

export function getBasicGImageOptions(colorKey) {
  const options = basicGImageLibrary?.[colorKey];
  return Array.isArray(options) ? options : [];
}

export function getBasicGDefaultSelection() {
  return BASIC_G_COLORS.reduce((selection, color) => {
    const firstOption = getBasicGImageOptions(color.key)[0];
    selection[color.key] = firstOption?.index || 1;
    return selection;
  }, {});
}

export function getBasicGImageOption(colorKey, imageIndex) {
  const options = getBasicGImageOptions(colorKey);
  return options.find((option) => Number(option.index) === Number(imageIndex)) || options[0] || null;
}

export function createBasicGCard(colorKey, imageIndex) {
  const color = getBasicGColorConfig(colorKey);
  const selectedOption = getBasicGImageOption(color.key, imageIndex);
  const resolvedIndex = Number(selectedOption?.index || imageIndex || 1);

  return {
    cardId: `basic-g-${color.key}-${padImageIndex(resolvedIndex)}`,
    cardNumber1: "G",
    cardNumber2: "",
    cardType: 10,
    card_type_name: "Generation",
    name: "基本G",
    color: color.label,
    sp_power_color1_name: color.label,
    spPowerCost1: "1",
    totalCost: "-",
    resourceCost: "-",
    imagePath: selectedOption?.path || "",
    traits: [],
    traits2: [],
    sets: [],
    basicGColorKey: color.key,
    basicGImageIndex: resolvedIndex,
  };
}
