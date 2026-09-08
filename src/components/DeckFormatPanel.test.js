import { fireEvent, render, screen, within } from "@testing-library/react";
import DeckFormatPanel from "./DeckFormatPanel";

function renderPanel(props = {}) {
  const onFormatChange = jest.fn();
  const view = render(
    <DeckFormatPanel formatName="" items={[]} onFormatChange={onFormatChange} {...props} />
  );
  return { ...view, onFormatChange };
}

test("未選択では開いて選択でき、適合済みとは表示しない", () => {
  const { onFormatChange } = renderPanel();
  const panel = screen.getByRole("region", { name: "フォーマット・禁止制限" });
  const toggle = within(panel).getByRole("button", { name: /フォーマット・禁止制限/ });

  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(within(panel).getByText("未選択・適合未確認")).toBeInTheDocument();
  expect(within(panel).queryByText(/適合済み/)).not.toBeInTheDocument();

  fireEvent.change(within(panel).getByLabelText("構築するデッキのフォーマット"), {
    target: { value: "関西クラシック" },
  });
  expect(onFormatChange).toHaveBeenCalledWith("関西クラシック");
});

test("空デッキでも通信なしで禁止制限を実名表示する", () => {
  renderPanel({ formatName: "関西クラシック", items: [] });
  const panel = screen.getByRole("region", { name: "フォーマット・禁止制限" });
  const toggle = within(panel).getByRole("button", { name: /フォーマット・禁止制限/ });

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(within(toggle).getByText(/空デッキ/)).toBeInTheDocument();
  fireEvent.click(toggle);

  expect(within(panel).getByText("チェーミン・ノア")).toBeInTheDocument();
  expect(within(panel).getByText("総攻撃")).toBeInTheDocument();
  expect(within(panel).queryByText("カードID 101020126")).not.toBeInTheDocument();
  expect(within(panel).getByText("空デッキです。適合済みではありません。")).toBeInTheDocument();
});

test("開閉後も選択値と違反概要を保持し、閉じたままカード変更を反映する", () => {
  const violatingItem = {
    cardId: "101020126",
    count: 1,
    zone: "main",
    card: { cardId: "101020126", name: "チェーミン・ノア" },
  };
  const { rerender } = render(
    <DeckFormatPanel formatName="関西クラシック" items={[violatingItem]} onFormatChange={jest.fn()} />
  );
  const panel = screen.getByRole("region", { name: "フォーマット・禁止制限" });
  const toggle = within(panel).getByRole("button", { name: /フォーマット・禁止制限/ });

  expect(within(toggle).getByText("関西クラシック")).toBeInTheDocument();
  expect(within(toggle).getByText(/違反/)).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(within(panel).getByText(/チェーミン・ノアは禁止カードです/)).toBeInTheDocument();
  fireEvent.click(toggle);

  rerender(
    <DeckFormatPanel
      formatName="関西クラシック"
      items={Array.from({ length: 17 }, (_, index) => ({
        cardId: `card-${index}`,
        count: index === 16 ? 2 : 3,
        zone: "main",
        card: { cardId: `card-${index}`, name: `カード${index}` },
      }))}
      onFormatChange={jest.fn()}
    />
  );
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(within(toggle).getByText("違反なし")).toBeInTheDocument();
  expect(within(toggle).getByText("関西クラシック")).toBeInTheDocument();
});

test("その他と未知形式は適合済み扱いしない", () => {
  const { rerender } = render(
    <DeckFormatPanel formatName="その他" items={[]} onFormatChange={jest.fn()} />
  );
  const panel = screen.getByRole("region", { name: "フォーマット・禁止制限" });
  const toggle = within(panel).getByRole("button", { name: /フォーマット・禁止制限/ });
  expect(within(toggle).getByText("ルール未登録・適合未確認")).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(within(panel).getByText("登録済みのレギュレーションがないため、適合は確認できません。")).toBeInTheDocument();

  rerender(<DeckFormatPanel formatName="旧大会フォーマット" items={[]} onFormatChange={jest.fn()} />);
  expect(within(panel).getByText("ルール未登録・適合未確認")).toBeInTheDocument();
  expect(within(panel).getByRole("option", { name: "旧大会フォーマット" })).toBeInTheDocument();
});
