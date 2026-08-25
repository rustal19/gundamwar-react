import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";

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

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1280,
  });
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

test("/search renders the search form and collapsed sidebar", () => {
  const { container } = renderApp("/search");

  expect(container.querySelector("#name")).toBeInTheDocument();
  expect(container.querySelector(".gw-sidebar")).toHaveClass("gw-sidebar-collapsed");
  expect(container.querySelector('a[href="/search"]')).toHaveAttribute("title");
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
