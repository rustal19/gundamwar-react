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

function renderDialog(onPublicationChange = jest.fn()) {
  render(
    <DeckLoadDialog
      open
      onClose={jest.fn()}
      savedDecks={[savedDeck]}
      initialDeckId="deck-1"
      onLoad={jest.fn()}
      onDelete={jest.fn()}
      onPublicationChange={onPublicationChange}
      isLoading={false}
      isDeleting={false}
      isPublishing={false}
      publishingDeckId=""
      deletingDeckId=""
      errorMessage=""
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
