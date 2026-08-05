import kansaiFormats from "./kansaiFormats.json";
import gwCupFormats from "./gwCupFormats.json";

const mapPreset = ({ name, regulation, note }) => ({ name, regulation, note });

export const FORMAT_PRESETS = [
  {
    name: "スタンダード",
    regulation: {
      name: "スタンダード",
      mainMin: 50,
      mainMax: 50,
      sideSize: 10,
      maxCopies: 3,
      bannedCards: [],
      limitedCards: [],
      allowedSets: null,
    },
  },
  ...kansaiFormats.formats.map(mapPreset),
  ...gwCupFormats.formats.map(mapPreset),
];

export const OTHER_FORMAT_NAME = "その他";
