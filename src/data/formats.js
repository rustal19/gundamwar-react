import kansaiFormats from "./kansaiFormats.json";

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
  ...kansaiFormats.formats.map(({ name, regulation, note }) => ({
    name,
    regulation,
    note,
  })),
];

export const OTHER_FORMAT_NAME = "その他";
