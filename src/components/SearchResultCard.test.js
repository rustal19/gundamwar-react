import { render, screen } from "@testing-library/react";
import { FORMAT_PRESETS } from "../data/formats";
import { getCardFormatStatus } from "../utils/searchResults";
import SearchResultCard from "./SearchResultCard";

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({
    addCard: jest.fn(),
    countsByZoneByCardId: {
      "image-count-card": { main: 3, side: 1, total: 4 },
    },
  }),
}));
jest.mock("./CardImage", () => () => null);
jest.mock("./CardImagePreviewDialog", () => () => null);

const regulation = FORMAT_PRESETS.find(
  ({ name }) => name === "関西グロリアス"
).regulation;

describe("SearchResultCardの大会フォーマットバッジ", () => {
  test("禁止カードに禁止バッジを表示する", () => {
    const card = { cardId: 101020126, name: "チェーミン・ノア" };

    render(
      <SearchResultCard
        card={card}
        formatStatus={getCardFormatStatus(card, regulation)}
      />
    );

    expect(screen.getByText("禁止")).toHaveClass("result-card-format-badge", "banned");
    expect(screen.queryByText("制限")).not.toBeInTheDocument();
  });

  test("画像表示でも制限カードに制限バッジを表示する", () => {
    const card = { cardId: "101010083", name: "制限カード" };

    render(
      <SearchResultCard
        card={card}
        viewMode="image"
        formatStatus={getCardFormatStatus(card, regulation)}
      />
    );

    expect(screen.getByText("制限")).toHaveClass("result-card-format-badge", "limited");
  });
});

describe("SearchResultCardの数値ラベル", () => {
  test("画像表示のデッキ枚数に項目名と単位を表示する", () => {
    const { container } = render(
      <SearchResultCard
        card={{ cardId: "image-count-card", name: "枚数確認カード" }}
        viewMode="image"
        showDeckActions
      />
    );

    expect(container.querySelector(".result-card-image-count")).toHaveTextContent("合計4枚");
    expect(container.querySelector(".result-card-image-meta")).toHaveTextContent(
      /^メイン3枚 \/ サイド1枚$/
    );
    expect(container.querySelector(".result-card-image-meta")).toHaveAttribute("aria-live", "polite");
  });

  test("画像表示は未追加でも短い枚数表示を残す", () => {
    const { container } = render(
      <SearchResultCard card={{ cardId: "empty-card", name: "未追加カード" }} viewMode="image" showDeckActions />
    );
    expect(container.querySelector(".result-card-image-meta")).toHaveTextContent(/^メイン0枚 \/ サイド0枚$/);
    expect(container.querySelector(".result-card-image-count")).toBeNull();
  });

  test("国力・戦闘修正・カード番号を既存用語で可視表示する", () => {
    const { container } = render(
      <SearchResultCard
        card={{
          cardId: "unit-1",
          card_type_name: "UNIT",
          name: "ラベル確認カード",
          sp_power_color1_name: "青",
          spPowerCost1: 2,
          totalCost: 4,
          resourceCost: 1,
          melee1: 3,
          shooting1: 1,
          defense1: 3,
          cardNumber1: "U",
          cardNumber2: "123",
        }}
      />
    );

    ["国力", "指定", "合計", "資源", "戦闘修正", "格闘", "射撃", "防御", "カード番号"].forEach(
      (label) => expect(screen.getByText(label)).toBeVisible()
    );
    expect(
      Array.from(container.querySelectorAll(".card-costs .card-data-item"), (item) => item.textContent)
    ).toEqual(["指定青 2", "合計4", "資源1"]);
    expect(
      Array.from(container.querySelectorAll(".card-combat-stats .card-data-item"), (item) => item.textContent)
    ).toEqual(["格闘3", "射撃1", "防御3"]);
    expect(container.querySelector(".card-number")).toHaveTextContent("カード番号U-123");
  });

  test("別名面の二値の戦闘修正にも同じラベルを表示する", () => {
    const { container } = render(
      <SearchResultCard
        card={{
          cardId: "unit-2",
          name: "変形カード",
          altName: "変形後",
          altMelee1: 4,
          altMelee2: 6,
          altShooting1: 2,
          altShooting2: 3,
          altDefense1: 5,
          altDefense2: 7,
        }}
      />
    );

    expect(screen.getByText("戦闘修正")).toBeVisible();
    expect(
      Array.from(container.querySelectorAll(".card-combat-stats .card-data-item"), (item) => item.textContent)
    ).toEqual(["格闘4 / 6", "射撃2 / 3", "防御5 / 7"]);
  });
});
