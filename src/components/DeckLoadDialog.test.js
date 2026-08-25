import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeckLoadDialog from "./DeckLoadDialog";

jest.mock("../hooks/useDeckPreview", () => ({
  useDeckPreview: () => ({ previewUrl: "", isRendering: false, errorMessage: "" }),
}));

const savedDeck = {
  id: "deck-1",
  title: "テストデッキ",
  items: [],
  isPublic: false,
  description: "",
};

function renderDialog(
  onPublicationChange = jest.fn(),
  deck = savedDeck,
  errorMessage = ""
) {
  return render(
    <DeckLoadDialog
      open
      onClose={jest.fn()}
      savedDecks={[deck]}
      initialDeckId={deck.id}
      onLoad={jest.fn()}
      onDelete={jest.fn()}
      onPublicationChange={onPublicationChange}
      isLoading={false}
      isDeleting={false}
      isPublishing={false}
      publishingDeckId=""
      deletingDeckId=""
      errorMessage={errorMessage}
    />
  );
}

test("公開時はフォーマット未選択だと公開ボタンを無効にする", async () => {
  const onPublicationChange = jest.fn(() => Promise.resolve());
  renderDialog(onPublicationChange);

  const publishButton = screen.getByRole("button", { name: "公開する" });
  expect(publishButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("フォーマット"), {
    target: { value: "スタンダード" },
  });
  expect(publishButton).not.toBeDisabled();

  fireEvent.click(publishButton);

  await waitFor(() => {
    expect(onPublicationChange).toHaveBeenCalledWith({
      deckId: "deck-1",
      isPublic: true,
      description: "",
      format: "スタンダード",
    });
  });
});

test("公開を拒否された場合はフォーマット違反を理由ごとに表示する", async () => {
  const validationError = new Error(
    "「関西クラシック」のレギュレーションに適合していないため公開できません。"
  );
  validationError.summary =
    "「関西クラシック」のレギュレーションに適合していないため公開できません。";
  validationError.violations = [
    {
      code: "main_count",
      message: "メインデッキは50枚以上50枚以下にしてください。現在は49枚です。",
    },
    {
      code: "banned",
      cardName: "禁止テストカード",
      message: "禁止テストカードは禁止カードです。デッキに入れることはできません。",
    },
  ];
  const onPublicationChange = jest.fn().mockRejectedValue(validationError);
  const { container } = renderDialog(
    onPublicationChange,
    savedDeck,
    validationError.message
  );

  fireEvent.change(screen.getByLabelText("フォーマット"), {
    target: { value: "関西クラシック" },
  });
  fireEvent.click(screen.getByRole("button", { name: "公開する" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(
    "「関西クラシック」のレギュレーションに適合していないため公開できません。"
  );
  expect(alert).toHaveTextContent("現在は49枚です。");
  expect(alert).toHaveTextContent("禁止テストカードは禁止カードです。");
  expect(container.querySelector(".deck-load-dialog-error")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("フォーマット"), {
    target: { value: "スタンダード" },
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("構造化された違反がない従来の公開エラーも表示する", async () => {
  const onPublicationChange = jest
    .fn()
    .mockRejectedValue(new Error("保存デッキが見つかりません。"));
  renderDialog(onPublicationChange);

  fireEvent.change(screen.getByLabelText("フォーマット"), {
    target: { value: "スタンダード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "公開する" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "保存デッキが見つかりません。"
  );
});

test("未登録の自由記載フォーマットは適合チェック対象外と表示する", async () => {
  renderDialog(jest.fn(), {
    ...savedDeck,
    format: "独自フォーマット",
  });

  expect(
    await screen.findByText(
      "登録済みのレギュレーションがないため、公開時のフォーマット適合チェックは行われません。"
    )
  ).toBeInTheDocument();
});

test("前後に空白がある既知フォーマットも適合チェック対象として表示する", async () => {
  renderDialog(jest.fn(), {
    ...savedDeck,
    format: " スタンダード ",
  });

  await waitFor(() =>
    expect(screen.getByLabelText("フォーマット")).toHaveValue(" スタンダード ")
  );
  expect(
    screen.queryByText(
      "登録済みのレギュレーションがないため、公開時のフォーマット適合チェックは行われません。"
    )
  ).not.toBeInTheDocument();
});
