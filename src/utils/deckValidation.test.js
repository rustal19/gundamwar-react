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

  it("cardIdがない項目同士を取り違えない", () => {
    const violations = validateDeck(
      [
        { count: 1, zone: "main", card: { name: "普通のカード" } },
        { count: 1, zone: "main", card: { name: "禁止カード" } },
      ],
      { bannedCards: ["禁止カード"] }
    );

    expect(violations.filter((violation) => violation.code === "banned")).toEqual([
      expect.objectContaining({ cardName: "禁止カード" }),
    ]);
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

// Gカード(ジェネレーション)の構築ルール。
// - 基本Gと「(自動B)：このカードは基本Gとして扱う。(注：デッキ構築時を含む)」を持つカードは
//   同名3枚制限にも特殊Gの枚数にも数えない。
// - 特殊Gはメイン・サイド合計6枚まで。
describe("deckValidation - Gカードの構築ルール", () => {
  function gItem({ id, name, count = 1, zone = "main", cardType = 10 }) {
    return {
      cardId: id,
      count,
      zone,
      card: { cardId: id, name, cardType, card_type_name: "Generation" },
    };
  }

  function codesOf(violations) {
    return violations.map((violation) => violation.code);
  }

  it("基本Gは何枚入れても同名3枚制限に数えない", () => {
    const violations = validateDeck([
      gItem({ id: "basic-g-blue-0001", name: "基本G", count: 10 }),
    ]);

    expect(codesOf(violations)).not.toContain("max_copies");
    expect(codesOf(violations)).not.toContain("special_g_count");
  });

  it("「基本Gとして扱う」カードは同名3枚制限にも特殊Gの枚数にも数えない", () => {
    const violations = validateDeck([
      gItem({ id: "101050075", name: "地球連邦軍", count: 6 }),
      gItem({ id: "102050065", name: "ジオン公国", count: 6 }),
    ]);

    expect(codesOf(violations)).not.toContain("max_copies");
    expect(codesOf(violations)).not.toContain("special_g_count");
  });

  it("特殊Gが合計6枚までなら違反にならない", () => {
    const violations = validateDeck([
      gItem({ id: "101050012", name: "エゥーゴ支持者", count: 3 }),
      gItem({ id: "101050019", name: "サイド6住民", count: 3 }),
    ]);

    expect(codesOf(violations)).not.toContain("special_g_count");
  });

  it("特殊Gが7枚以上なら special_g_count 違反になる", () => {
    const violations = validateDeck([
      gItem({ id: "101050012", name: "エゥーゴ支持者", count: 3 }),
      gItem({ id: "101050019", name: "サイド6住民", count: 3 }),
      gItem({ id: "101050020", name: "地球連邦軍女性兵士", count: 1 }),
    ]);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "special_g_count",
          message: "特殊Gはメイン・サイド合計6枚までです。現在は7枚です。",
        }),
      ])
    );
  });

  it("特殊Gの枚数はメインとサイドを合算する", () => {
    const violations = validateDeck([
      gItem({ id: "101050012", name: "エゥーゴ支持者", count: 3 }),
      gItem({ id: "101050019", name: "サイド6住民", count: 3 }),
      gItem({ id: "101050020", name: "地球連邦軍女性兵士", count: 1, zone: "side" }),
    ]);

    expect(codesOf(violations)).toContain("special_g_count");
  });

  it("基本G扱いのカードは特殊Gの枚数を圧迫しない", () => {
    const violations = validateDeck([
      gItem({ id: "101050012", name: "エゥーゴ支持者", count: 3 }),
      gItem({ id: "101050019", name: "サイド6住民", count: 3 }),
      gItem({ id: "101050075", name: "地球連邦軍", count: 10 }),
      gItem({ id: "basic-g-red-0001", name: "基本G", count: 10 }),
    ]);

    expect(codesOf(violations)).not.toContain("special_g_count");
  });

  it("カードIDが未知でもカード種別で特殊Gと判定する", () => {
    const violations = validateDeck([
      gItem({ id: "999999999", name: "新しい特殊G", count: 7 }),
    ]);

    expect(codesOf(violations)).toContain("special_g_count");
  });
});
