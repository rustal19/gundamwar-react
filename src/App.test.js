import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";

jest.mock("./services/tournaments", () => ({
  __esModule: true,
  fetchTournaments: jest.fn(() => Promise.resolve({ items: [] })),
}));

jest.mock("./services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDecks: jest.fn(() => Promise.resolve({ items: [] })),
}));

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

function setMockUser(role) {
  window.localStorage.setItem(
    MOCK_USER_KEY,
    JSON.stringify({
      id: `${role}-user`,
      name: `${role} user`,
      nickname: `${role} member`,
      email: `${role}@example.test`,
      role,
    })
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1280,
  });
});

test("トップページにポータル名とサイドバーが表示される", async () => {
  renderApp("/");

  expect(screen.getAllByText("Gundam War Portal").length).toBeGreaterThan(0);
  expect(screen.getByText("ガンダムウォー非公式ポータル")).toBeInTheDocument();
  const nav = screen.getByRole("navigation", { name: "メインナビゲーション" });
  expect(within(nav).getByRole("link", { name: /ホーム/ })).toHaveAttribute("href", "/");
  expect(within(nav).getByRole("link", { name: /カード検索/ })).toHaveAttribute("href", "/search");
  expect(within(nav).getByRole("link", { name: /デッキ構築/ })).toHaveAttribute("href", "/deck");
  await waitFor(() => {
    expect(screen.getByText(/開催予定・進行中の大会はありません/)).toBeInTheDocument();
  });
});

test("/search に検索フォームが表示され、サイドバーは縮小される", () => {
  const { container } = renderApp("/search");

  expect(screen.getByText("カード名")).toBeInTheDocument();
  expect(container.querySelector(".gw-sidebar")).toHaveClass("gw-sidebar-collapsed");
  expect(screen.getByRole("link", { name: /カード検索/ })).toHaveAttribute("title", "カード検索");
});

test("フッターにサイト名と利用規約・プライバシーポリシーへのリンクが表示される", async () => {
  renderApp("/");

  expect(screen.getByText("Gundam War Portal", { selector: ".app-footer-brand" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
    "href",
    "/privacy"
  );
  expect(screen.getAllByText(/非公式ファンサイト/).length).toBeGreaterThan(0);
  await waitFor(() => {
    expect(screen.getByText(/開催予定・進行中の大会はありません/)).toBeInTheDocument();
  });
});

test("未ログインとuserには運営メニューを表示しない", () => {
  const { unmount } = renderApp("/");
  expect(screen.queryByText("運営メニュー")).not.toBeInTheDocument();
  unmount();

  setMockUser("user");
  renderApp("/");
  expect(screen.queryByText("運営メニュー")).not.toBeInTheDocument();
});

test("organizerには大会作成のみ、adminには権限管理も表示する", () => {
  setMockUser("organizer");
  const { unmount } = renderApp("/");

  expect(screen.getByText("運営メニュー")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /大会を作成/ })).toHaveAttribute(
    "href",
    "/tournaments/new"
  );
  expect(screen.queryByRole("link", { name: /権限管理/ })).not.toBeInTheDocument();
  unmount();

  window.localStorage.clear();
  setMockUser("admin");
  renderApp("/");
  expect(screen.getByRole("link", { name: /大会を作成/ })).toHaveAttribute(
    "href",
    "/tournaments/new"
  );
  expect(screen.getByRole("link", { name: /権限管理/ })).toHaveAttribute("href", "/admin/users");
});
