import { defaultRegulation, getCardSets, validateDeck } from "./deckValidation";

function cardItem({ id, name, count = 1, zone = "main", sets = ["S1"] }) {
  return {
    cardId: id,
    count,
    zone,
    card: {
      cardId: id,
      name,
      sets,
    },
  };
}

function validDeck(overrides = {}) {
  return [
    cardItem({ id: "card-1", name: "カード1", count: 3 }),
    cardItem({ id: "card-2", name: "カード2", count: 3 }),
    cardItem({ id: "card-3", name: "カード3", count: 3 }),
    cardItem({ id: "card-4", name: "カード4", count: 3 }),
    cardItem({ id: "card-5", name: "カード5", count: 3 }),
    cardItem({ id: "card-6", name: "カード6", count: 3 }),
    cardItem({ id: "card-7", name: "カード7", count: 3 }),
    cardItem({ id: "card-8", name: "カード8", count: 3 }),
    cardItem({ id: "card-9", name: "カード9", count: 3 }),
    cardItem({ id: "card-10", name: "カード10", count: 3 }),
    cardItem({ id: "card-11", name: "カード11", count: 3 }),
    cardItem({ id: "card-12", name: "カード12", count: 3 }),
    cardItem({ id: "card-13", name: "カード13", count: 3 }),
    cardItem({ id: "card-14", name: "カード14", count: 3 }),
    cardItem({ id: "card-15", name: "カード15", count: 3 }),
    cardItem({ id: "card-16", name: "カード16", count: 3 }),
    cardItem({ id: "card-17", name: "カード17", count: 2 }),
    ...Array.from({ length: 10 }, (_, index) =>
      cardItem({
        id: `side-${index + 1}`,
        name: `サイド${index + 1}`,
        count: 1,
        zone: "side",
      })
    ),
  ].map((item) => {
    const override = overrides[item.cardId];
    return override ? { ...item, ...override, card: { ...item.card, ...(override.card || {}) } } : item;
  });
}

describe("deckValidation", () => {
  it("returns no violations for a valid deck", () => {
    expect(validateDeck(validDeck(), defaultRegulation())).toEqual([]);
  });

  it("detects main_count violations", () => {
    const violations = validateDeck([cardItem({ id: "card-1", name: "カード1", count: 49 })]);

    expect(violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "main_count" })])
    );
  });

  it("detects side_count violations", () => {
    const deck = validDeck().filter((item) => item.zone !== "side").concat(
      cardItem({ id: "side-1", name: "サイド1", count: 5, zone: "side" })
    );

    expect(validateDeck(deck)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "side_count" })])
    );
  });

  it("detects max_copies violations by card name across main and side", () => {
    const deck = [
      cardItem({ id: "card-a", name: "同名カード", count: 3 }),
      cardItem({ id: "card-b", name: "同名カード", count: 1, zone: "side" }),
    ];

    expect(validateDeck(deck)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "max_copies", cardName: "同名カード" }),
      ])
    );
  });

  it("detects banned cards by name or cardId", () => {
    const deck = validDeck({
      "card-1": { card: { name: "禁止カード" } },
      "card-2": { cardId: "banned-id", card: { cardId: "banned-id" } },
    });

    const violations = validateDeck(deck, {
      bannedCards: ["禁止カード", "banned-id"],
    });

    expect(violations.filter((violation) => violation.code === "banned")).toHaveLength(2);
  });

  it("detects limited card violations by name or cardId", () => {
    const deck = validDeck({
      "card-1": { count: 2, card: { name: "制限カード" } },
      "card-2": { cardId: "limited-id", count: 2, card: { cardId: "limited-id" } },
    });

    const violations = validateDeck(deck, {
      limitedCards: ["制限カード", "limited-id"],
    });

    expect(violations.filter((violation) => violation.code === "limited")).toHaveLength(2);
  });

  it("detects allowed_sets violations", () => {
    const deck = validDeck({
      "card-1": { card: { sets: ["S2"] } },
    });

    expect(validateDeck(deck, { allowedSets: ["S1"] })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "allowed_sets", cardName: "カード1" })])
    );
  });

  it("skips allowed_sets validation when set metadata is unavailable", () => {
    const deck = validDeck({
      "card-1": { card: { sets: [] } },
    });

    expect(validateDeck(deck, { allowedSets: ["S1"] })).toEqual([]);
  });

  it("extracts sets from the search result card fields and string fallbacks", () => {
    expect(getCardSets({ sets: ["BB1", "ST1"] })).toEqual(["BB1", "ST1"]);
    expect(getCardSets({ setName: "BB1 / ST1" })).toEqual(["BB1", "ST1"]);
  });
});
