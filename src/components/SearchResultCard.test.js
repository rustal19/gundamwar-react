import { render, screen } from "@testing-library/react";
import { FORMAT_PRESETS } from "../data/formats";
import { getCardFormatStatus } from "../utils/searchResults";
import SearchResultCard from "./SearchResultCard";

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({
    addCard: jest.fn(),
    countsByZoneByCardId: {},
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

  test("使用可能な収録弾がないカードに範囲外バッジを表示する", () => {
    const card = { cardId: "test-card", name: "範囲外カード", sets: ["29th"] };

    render(
      <SearchResultCard
        card={card}
        formatStatus={getCardFormatStatus(card, regulation)}
      />
    );

    expect(screen.getByText("範囲外")).toHaveClass(
      "result-card-format-badge",
      "out-of-pool"
    );
  });
});
