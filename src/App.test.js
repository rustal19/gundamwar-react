import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { API_SEARCH_URL } from "./utils/searchResults";

const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const originalFetch = global.fetch;

jest.mock("./services/tournaments", () => ({
  __esModule: true,
  fetchTournaments: jest.fn(() => Promise.resolve({ items: [] })),
}));

// CRA既定の resetMocks で実装が消えないよう、素の関数でモックする。
jest.mock("./services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDeck: () => new Promise(() => {}),
  fetchPublicDecks: () => Promise.resolve({ items: [] }),
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

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: jest.fn(),
  });
  setViewportWidth(1280);
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("home renders the portal brand and desktop sidebar links", () => {
  const { container } = renderApp("/");
  const sidebar = container.querySelector(".gw-sidebar");

  expect(screen.getAllByText("Gundam War Portal").length).toBeGreaterThan(0);
  expect(sidebar).toBeInTheDocument();
  expect(within(sidebar).getByRole("link", { name: /Gundam War Portal/ })).toHaveAttribute(
    "href",
    "/"
  );
  expect(sidebar.querySelector('a[href="/"]')).toBeInTheDocument();
  expect(sidebar.querySelector('a[href="/search"]')).toBeInTheDocument();
  expect(sidebar.querySelector('a[href="/deck"]')).toBeInTheDocument();
  expect(sidebar.querySelector('a[href="/decks"]')).toBeInTheDocument();
  expect(sidebar.querySelector('a[href="/tournaments"]')).toBeInTheDocument();
});

test("mobile menu keeps aria state in sync and closes from the backdrop or navigation", () => {
  const { container } = renderApp("/terms?mobileLayout=ios");
  const toggle = screen.getByRole("button", { name: "メニューを開く" });

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveAttribute("aria-controls", "mobile-navigation-drawer");
  expect(container.querySelector("#mobile-navigation-drawer")).not.toBeInTheDocument();

  fireEvent.click(toggle);

  const layer = container.querySelector("#mobile-navigation-drawer");
  const drawer = layer.querySelector(".gw-sidebar-drawer");
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveAccessibleName("メニューを閉じる");
  expect(drawer).toBeInTheDocument();
  expect(layer.firstElementChild).toBe(drawer);

  fireEvent.click(layer.querySelector(".mobile-drawer-backdrop"));

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveAccessibleName("メニューを開く");
  expect(container.querySelector("#mobile-navigation-drawer")).not.toBeInTheDocument();

  fireEvent.click(toggle);
  const reopenedDrawer = container.querySelector(".gw-sidebar-drawer");
  const searchLink = reopenedDrawer.querySelector('a[href="/search?mobileLayout=ios"]');
  expect(searchLink).toBeInTheDocument();

  fireEvent.click(searchLink);

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveAccessibleName("メニューを開く");
  expect(container.querySelector("#mobile-navigation-drawer")).not.toBeInTheDocument();
});

test("/search renders the search form and collapsed sidebar", () => {
  const { container } = renderApp("/search");

  expect(screen.getByRole("heading", { level: 1, name: "カード検索" })).toBeInTheDocument();
  expect(container.querySelector("#name")).toBeInTheDocument();
  expect(container.querySelector(".gw-sidebar")).toHaveClass("gw-sidebar-collapsed");
  expect(container.querySelector('a[href="/search"]')).toHaveAttribute("title");
});

test.each([1280, 375])(
  "%ipxの検索フォームは先頭と最下部の両方から検索を実行できる",
  (viewportWidth) => {
    setViewportWidth(viewportWidth);
    const path = viewportWidth === 375 ? "/search?mobileLayout=ios" : "/search";
    const { container } = renderApp(path);
    const form = container.querySelector("#card-search-form");
    const header = form.firstElementChild;
    const footer = form.lastElementChild;
    const heading = within(form).getByRole("heading", { level: 1, name: "カード検索" });
    const headerSubmit = within(header).getByRole("button", { name: "検索" });
    const footerSubmit = within(footer).getByRole("button", { name: "検索" });
    const footerReset = within(footer).getByRole("button", { name: "リセット" });
    const firstInput = container.querySelector("#name");

    expect(header).toHaveClass("search-form-header");
    expect(footer).toHaveClass("search-form-footer");
    expect(header).toContainElement(heading);
    expect(header).toContainElement(headerSubmit);
    expect(footer).toContainElement(footerSubmit);
    expect(footerSubmit).toHaveAttribute("type", "submit");
    expect(footerReset).toHaveAttribute("type", "reset");
    expect(
      headerSubmit.compareDocumentPosition(firstInput) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      firstInput.compareDocumentPosition(footerSubmit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  }
);

test("検索結果から条件を保持してフォームへ戻り、細かい選択条件も再編集できる", async () => {
  const query = new URLSearchParams({
    name: "ガンダム",
    name_forward: "true",
    cardType: JSON.stringify(["1"]),
    unitFeatureExtra: JSON.stringify(["mobileDoll"]),
    page: "2",
    pageSize: "20",
  });
  global.fetch = jest.fn(() => new Promise(() => {}));

  const { container } = renderApp(`/search?${query.toString()}`);
  const editLink = await screen.findByRole("link", { name: "検索に戻る" });

  expect(editLink.getAttribute("href")).toContain(query.toString());
  fireEvent.click(editLink);

  const nameInput = await screen.findByLabelText("カード名");
  expect(screen.getByRole("heading", { level: 1, name: "カード検索" })).toBeInTheDocument();
  expect(nameInput).toHaveValue("ガンダム");
  expect(container.querySelector('#box_name_forward')).toBeChecked();
  expect(container.querySelector('input[name="cardType"][value="1"]')).toBeChecked();
  expect(container.querySelector('select[name="pageSize"]')).toHaveValue("20");
  expect(screen.getByText("MD")).toBeInTheDocument();

  fireEvent.change(nameInput, { target: { value: "ガンダムX" } });
  fireEvent.click(
    within(container.querySelector(".search-form-header")).getByRole("button", { name: "検索" })
  );

  expect(await screen.findByRole("heading", { level: 1, name: "検索結果" })).toBeInTheDocument();
  let searchRequests;
  await waitFor(() => {
    searchRequests = global.fetch.mock.calls.filter(([url]) => url === API_SEARCH_URL);
    expect(searchRequests).toHaveLength(2);
  });
  const lastRequest = searchRequests[searchRequests.length - 1];
  const requestBody = JSON.parse(lastRequest[1].body);
  expect(requestBody).toMatchObject({
    name: "ガンダムX",
    name_forward: true,
    cardType: [1],
    unitFeatureExtra: ["mobileDoll"],
    page: 1,
    pageSize: 20,
  });
});

test("375pxでは検索後にフォームを畳み、結果と条件要約を先頭に表示する", async () => {
  setViewportWidth(375);
  global.fetch = jest.fn(() => new Promise(() => {}));
  const { container } = renderApp("/search?mobileLayout=ios");

  fireEvent.change(screen.getByLabelText("カード名"), { target: { value: "シャア" } });
  fireEvent.click(
    within(container.querySelector(".search-form-footer")).getByRole("button", { name: "検索" })
  );

  expect(await screen.findByRole("heading", { level: 1, name: "検索結果" })).toBeInTheDocument();
  expect(container.querySelector(".app-shell")).toHaveClass("app-shell-mobile");
  expect(container.querySelector("#card-search-form")).not.toBeInTheDocument();
  expect(container.querySelector("#search-results-container")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "現在の検索条件" })).toHaveTextContent(
    "カード名: シャア"
  );
});

test("/deck collapses the sidebar after navigation without blocking a later manual expansion", () => {
  const { container } = renderApp("/");
  const initialSidebar = container.querySelector(".gw-sidebar");
  const deckLink = container.querySelector('a[href="/deck"]');

  fireEvent.pointerEnter(initialSidebar);
  deckLink.focus();
  expect(deckLink).toHaveFocus();
  fireEvent.click(deckLink);

  const sidebar = container.querySelector(".gw-sidebar");
  const activeDeckLink = container.querySelector('a[href="/deck"]');
  expect(container.querySelector(".app-shell")).toHaveClass("app-shell-sidebar-collapsed");
  expect(sidebar).toHaveClass("gw-sidebar-collapsed");
  expect(sidebar).not.toHaveClass("gw-sidebar-temporarily-expanded");
  expect(activeDeckLink).not.toHaveFocus();

  fireEvent.pointerLeave(sidebar);
  fireEvent.pointerEnter(sidebar);
  expect(sidebar).toHaveClass("gw-sidebar-temporarily-expanded");
  fireEvent.pointerLeave(sidebar);
  expect(sidebar).not.toHaveClass("gw-sidebar-temporarily-expanded");

  fireEvent.focus(activeDeckLink);
  expect(sidebar).toHaveClass("gw-sidebar-temporarily-expanded");
  fireEvent.blur(activeDeckLink, { relatedTarget: document.body });
  expect(sidebar).not.toHaveClass("gw-sidebar-temporarily-expanded");

  fireEvent.click(container.querySelector('a[href="/"]'));
  expect(container.querySelector(".app-shell")).not.toHaveClass(
    "app-shell-sidebar-collapsed"
  );
  expect(container.querySelector(".gw-sidebar")).not.toHaveClass("gw-sidebar-collapsed");
});

test("only the deck builder route uses the viewport-locked app shell", () => {
  const deckBuilderView = renderApp("/deck");
  expect(deckBuilderView.container.querySelector(".app-shell")).toHaveClass("app-shell-deck");
  expect(deckBuilderView.container.querySelector(".app-shell")).toHaveClass(
    "app-shell-sidebar-collapsed"
  );
  expect(deckBuilderView.container.querySelector(".gw-sidebar")).toHaveClass(
    "gw-sidebar-collapsed"
  );
  expect(deckBuilderView.container.querySelector(".gw-sidebar")).not.toHaveClass(
    "gw-sidebar-temporarily-expanded"
  );
  deckBuilderView.unmount();

  const publicDeckListView = renderApp("/decks");
  expect(publicDeckListView.container.querySelector(".app-shell")).not.toHaveClass(
    "app-shell-deck"
  );
  publicDeckListView.unmount();

  const publicDeckDetailView = renderApp("/decks/deck-1");
  expect(publicDeckDetailView.container.querySelector(".app-shell")).not.toHaveClass(
    "app-shell-deck"
  );
});

test("footer renders the portal name and legal links", () => {
  const { container } = renderApp("/");
  const footer = container.querySelector(".app-footer");

  expect(within(footer).getByText("Gundam War Portal")).toBeInTheDocument();
  expect(footer.querySelector('a[href="/terms"]')).toBeInTheDocument();
  expect(footer.querySelector('a[href="/privacy"]')).toBeInTheDocument();
});

test("anonymous and user roles do not see organizer menu links", () => {
  const { container, unmount } = renderApp("/");
  expect(container.querySelector('a[href="/tournaments/new"]')).not.toBeInTheDocument();
  expect(container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
  unmount();

  setMockUser("user");
  const userView = renderApp("/");
  expect(userView.container.querySelector('a[href="/tournaments/new"]')).not.toBeInTheDocument();
  expect(userView.container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
});

test("organizer sees tournament creation and admin also sees user permissions", () => {
  setMockUser("organizer");
  const { container, unmount } = renderApp("/");

  expect(container.querySelector('a[href="/tournaments/new"]')).toBeInTheDocument();
  expect(container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
  unmount();

  window.localStorage.clear();
  setMockUser("admin");
  const adminView = renderApp("/");
  expect(adminView.container.querySelector('a[href="/tournaments/new"]')).toBeInTheDocument();
  expect(adminView.container.querySelector('a[href="/admin/users"]')).toBeInTheDocument();
});

test("login button opens GoogleSignInPanel popover and closes after mock login", async () => {
  const { container } = renderApp("/");

  fireEvent.click(container.querySelector(".gw-sidebar-login-button"));

  const loginDialog = screen.getByRole("dialog");
  const roleSelect = within(loginDialog).getByRole("combobox");
  expect(roleSelect).toBeInTheDocument();

  fireEvent.change(roleSelect, { target: { value: "organizer" } });
  fireEvent.click(loginDialog.querySelector(".google-mock-button"));

  await waitFor(() => {
    expect(container.querySelector(".gw-sidebar-login-menu")).not.toBeInTheDocument();
  });
  expect(container.querySelector('a[href="/tournaments/new"]')).toBeInTheDocument();
  expect(container.querySelector('a[href="/admin/users"]')).not.toBeInTheDocument();
});
