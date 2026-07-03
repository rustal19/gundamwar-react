import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

jest.mock("./services/tournaments", () => ({
  __esModule: true,
  fetchTournaments: jest.fn(() => Promise.resolve({ items: [] })),
}));

jest.mock("./services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDecks: jest.fn(() => Promise.resolve({ items: [] })),
}));

test("トップページにポータルが表示される", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getAllByText("Gundam War Database").length).toBeGreaterThan(0);
  expect(screen.getByText("開催予定・進行中の大会")).toBeInTheDocument();
  expect(screen.getByText("新着公開デッキ")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText("開催予定・進行中の大会はありません。")).toBeInTheDocument();
  });
});

test("/search に検索フォームが表示される", () => {
  render(
    <MemoryRouter initialEntries={["/search"]}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText("カード名")).toBeInTheDocument();
});

test("フッターに利用規約とプライバシーポリシーへのリンクが表示される", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
    "href",
    "/privacy"
  );
  expect(screen.getAllByText(/非公式ファンサイト/).length).toBeGreaterThan(0);
  await waitFor(() => {
    expect(screen.getByText("開催予定・進行中の大会はありません。")).toBeInTheDocument();
  });
});
