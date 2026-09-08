import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DeckPublicationPanel from "./DeckPublicationPanel";

function validItems() {
  return Array.from({ length: 17 }, (_, index) => ({
    cardId: `card-${index}`,
    count: index === 16 ? 2 : 3,
    zone: "main",
    card: { cardId: `card-${index}`, name: `カード${index}` },
  }));
}

function violatingItems() {
  const items = validItems();
  items[0] = {
    ...items[0],
    cardId: "101020126",
    card: { cardId: "101020126", name: "チェーミン・ノア" },
  };
  return items;
}

test("選択欄を隠しても保存済み公開対象の違反理由を表示する", () => {
  render(
    <DeckPublicationPanel
      deck={{ id: "deck-1", items: violatingItems(), format: "関西クラシック", isPublic: false }}
      formatValue="関西クラシック"
      hideFormatSelection
      onPublicationChange={jest.fn()}
    />
  );
  const panel = screen.getByRole("region", { name: "デッキ公開設定" });

  expect(within(panel).queryByLabelText("フォーマット")).not.toBeInTheDocument();
  expect(within(panel).getByText("「関西クラシック」のレギュレーションに適合していないため公開できません。")).toBeInTheDocument();
  expect(within(panel).getByText(/チェーミン・ノアは禁止カードです/)).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "公開する" })).toBeDisabled();
});

test.each(["その他", "旧大会フォーマット"])("%sはルール未登録案内を残す", (formatValue) => {
  render(
    <DeckPublicationPanel
      deck={{ id: "deck-1", items: validItems(), format: formatValue, isPublic: false }}
      formatValue={formatValue}
      hideFormatSelection
      onPublicationChange={jest.fn()}
    />
  );
  expect(screen.getByText("登録済みのレギュレーションがないため、公開時のフォーマット適合チェックは行われません。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "公開する" })).toBeEnabled();
});

test("未選択は公開拒否するが公開済みデッキは非公開化できる", async () => {
  const onPublicationChange = jest.fn().mockResolvedValue({});
  render(
    <DeckPublicationPanel
      deck={{ id: "deck-1", items: validItems(), format: "", isPublic: true }}
      formatValue=""
      hideFormatSelection
      onPublicationChange={onPublicationChange}
    />
  );

  expect(screen.getByText("公開するにはフォーマットを選択してください。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "公開内容を更新" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "非公開にする" }));
  await waitFor(() => expect(onPublicationChange).toHaveBeenCalledWith({
    deckId: "deck-1",
    isPublic: false,
    description: "",
    format: "",
  }));
});

test("公開済み同形式では再検証による公開阻止をしない", () => {
  render(
    <DeckPublicationPanel
      deck={{ id: "deck-1", items: violatingItems(), format: "関西クラシック", isPublic: true }}
      formatValue="関西クラシック"
      hideFormatSelection
      onPublicationChange={jest.fn()}
    />
  );

  expect(screen.queryByText(/適合していないため公開できません/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "公開内容を更新" })).toBeEnabled();
});
