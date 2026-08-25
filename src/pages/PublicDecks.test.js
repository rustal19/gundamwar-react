import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fetchPublicDecks } from "../services/publicDecks";
import PublicDecks from "./PublicDecks";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ authMode: "mock" }),
}));

jest.mock("../services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDecks: jest.fn(),
}));

function createDecks(start, count) {
  return Array.from({ length: count }, (_, index) => {
    const number = start + index;
    return {
      id: `deck-${number}`,
      title: `公開デッキ${number}`,
      description: `説明${number}`,
      format: "スタンダード",
      items: [
        {
          cardId: `card-${number}`,
          count: 3,
          card: { name: `カード${number}`, sp_power_color1_name: "青" },
        },
      ],
      owner: { id: "owner-1", name: "投稿者" },
      publishedAt: `2026-08-${String(number).padStart(2, "0")}T00:00:00.000Z`,
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
});

test("20件以下の公開デッキをすべて表示し、不要なページャーを出さない", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: createDecks(1, 7),
    total: 7,
    page: 1,
    pageSize: 20,
  });

  const { container } = render(
    <MemoryRouter initialEntries={["/decks"]}>
      <PublicDecks />
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(7));
  expect(container.querySelector(".pagination")).not.toBeInTheDocument();

  const firstDeck = screen.getAllByRole("article")[0];
  expect(within(firstDeck).getByRole("link", { name: "公開デッキ1" })).toHaveAttribute(
    "href",
    "/decks/deck-1"
  );
  expect(within(firstDeck).getByText("スタンダード")).toBeInTheDocument();
});

test("20件を超える公開デッキは条件を維持したまま次ページへ移動できる", async () => {
  fetchPublicDecks.mockImplementation(({ page }) =>
    Promise.resolve({
      items: page === 2 ? createDecks(21, 5) : createDecks(1, 20),
      total: 25,
      page,
      pageSize: 20,
    })
  );

  render(
    <MemoryRouter initialEntries={["/decks?query=Blue&format=スタンダード&page=1"]}>
      <PublicDecks />
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith({
      page: 1,
      query: "Blue",
      format: "スタンダード",
      authMode: "mock",
    })
  );
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(20));
  expect(screen.getAllByText("1 / 2")).toHaveLength(2);

  fireEvent.click(screen.getAllByRole("button", { name: "次へ" })[0]);

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 2,
      query: "Blue",
      format: "スタンダード",
      authMode: "mock",
    })
  );
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(5));
  expect(screen.getAllByText("2 / 2")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "公開デッキ25" })).toHaveAttribute(
    "href",
    "/decks/deck-25"
  );
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
});
