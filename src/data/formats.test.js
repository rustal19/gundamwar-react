import kansaiFormats from "./kansaiFormats.json";
import { FORMAT_PRESETS } from "./formats";
import { validateDeck } from "../utils/deckValidation";

describe.each(kansaiFormats.formats)("$name", (format) => {
  test("is available as a format preset", () => {
    expect(FORMAT_PRESETS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: format.name,
          regulation: format.regulation,
          note: format.note,
        }),
      ])
    );
  });

  test("rejects its banned cards", () => {
    const cardId = format.regulation.bannedCards[0];
    const violations = validateDeck(
      [{ cardId, count: 1, zone: "main", card: { cardId, name: cardId } }],
      format.regulation
    );

    expect(violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "banned", cardName: cardId })])
    );
  });

  test("rejects two copies of its limited cards", () => {
    const cardId = format.regulation.limitedCards[0];
    const violations = validateDeck(
      [{ cardId, count: 2, zone: "main", card: { cardId, name: cardId } }],
      format.regulation
    );

    expect(violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "limited", cardName: cardId })])
    );
  });
});
