import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  KANSAI_CLASSIC_FORMAT_NAME,
  OTHER_FORMAT_NAMES,
  TENSAKU_FORMAT_NAMES,
} from "../data/formatGroups";
import { OTHER_FORMAT_NAME } from "../data/formats";
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderPublicDecks(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PublicDecks />
      <LocationProbe />
    </MemoryRouter>
  );
}

function getLocationParams() {
  return new URLSearchParams(screen.getByTestId("location-search").textContent);
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

test("フォーマットタブ切替で検索語を維持し、1ページ目へ戻る", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });

  renderPublicDecks("/decks?query=Blue&format=スタンダード&page=3");

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith({
      page: 3,
      query: "Blue",
      format: "スタンダード",
      authMode: "mock",
    })
  );
  expect(screen.getByRole("tab", { name: "スタンダード" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.queryByLabelText("添削杯の開催回")).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Red" } });
  fireEvent.keyDown(screen.getByRole("tab", { name: "スタンダード" }), {
    key: "ArrowRight",
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "Blue",
      format: KANSAI_CLASSIC_FORMAT_NAME,
      authMode: "mock",
    })
  );
  expect(screen.getByRole("tab", { name: "クラシック" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByRole("tab", { name: "クラシック" })).toHaveFocus();
  await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue("Blue"));
  expect(getLocationParams().get("query")).toBe("Blue");
  expect(getLocationParams().get("format")).toBe(KANSAI_CLASSIC_FORMAT_NAME);
  expect(getLocationParams().get("page")).toBe("1");

  fireEvent.click(screen.getByRole("tab", { name: "すべて" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "Blue",
      format: "",
      authMode: "mock",
    })
  );
  expect(getLocationParams().has("format")).toBe(false);
  expect(getLocationParams().get("page")).toBe("1");
});

test("添削杯タブ内で開催回を選び、URLと取得条件へ反映できる", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });

  renderPublicDecks("/decks?query=Blue&format=スタンダード&page=2");
  await waitFor(() => expect(fetchPublicDecks).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("tab", { name: "添削杯" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "Blue",
      format: TENSAKU_FORMAT_NAMES[0],
      authMode: "mock",
    })
  );
  expect(screen.getByRole("tab", { name: "添削杯" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByLabelText("添削杯の開催回")).toHaveValue(TENSAKU_FORMAT_NAMES[0]);

  fireEvent.change(screen.getByLabelText("添削杯の開催回"), {
    target: { value: TENSAKU_FORMAT_NAMES[2] },
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "Blue",
      format: TENSAKU_FORMAT_NAMES[2],
      authMode: "mock",
    })
  );
  expect(getLocationParams().get("format")).toBe(TENSAKU_FORMAT_NAMES[2]);
  expect(getLocationParams().get("page")).toBe("1");
});

test("添削杯の開催回・ページ・検索語をURLから復元し、空状態を表示する", async () => {
  const restoredFormat = TENSAKU_FORMAT_NAMES[3];
  const changedFormat = TENSAKU_FORMAT_NAMES[0];
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 2,
    pageSize: 20,
  });

  renderPublicDecks(
    `/decks?query=${encodeURIComponent("赤単")}&format=${encodeURIComponent(restoredFormat)}&page=2`
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith({
      page: 2,
      query: "赤単",
      format: restoredFormat,
      authMode: "mock",
    })
  );
  expect(screen.getByRole("tab", { name: "添削杯" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByLabelText("添削杯の開催回")).toHaveValue(restoredFormat);
  expect(await screen.findByText("公開デッキはありません。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "次へ" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("添削杯の開催回"), {
    target: { value: changedFormat },
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "赤単",
      format: changedFormat,
      authMode: "mock",
    })
  );
  expect(getLocationParams().get("page")).toBe("1");

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "青赤" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "青赤",
      format: changedFormat,
      authMode: "mock",
    })
  );
  expect(getLocationParams().get("query")).toBe("青赤");
  expect(getLocationParams().get("format")).toBe(changedFormat);
  expect(getLocationParams().get("page")).toBe("1");
});

test("その他タブは具体的なフォーマットとその他ラベルをURLから復元できる", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 2,
    pageSize: 20,
  });

  renderPublicDecks(
    `/decks?query=大会&format=${encodeURIComponent(OTHER_FORMAT_NAME)}&page=2`
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith({
      page: 2,
      query: "大会",
      format: OTHER_FORMAT_NAME,
      authMode: "mock",
    })
  );
  expect(screen.getByRole("tab", { name: "その他" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByLabelText("その他のフォーマット")).toHaveValue(OTHER_FORMAT_NAME);

  fireEvent.change(screen.getByLabelText("その他のフォーマット"), {
    target: { value: OTHER_FORMAT_NAMES[0] },
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith({
      page: 1,
      query: "大会",
      format: OTHER_FORMAT_NAMES[0],
      authMode: "mock",
    })
  );
  expect(getLocationParams().get("format")).toBe(OTHER_FORMAT_NAMES[0]);
  expect(getLocationParams().get("page")).toBe("1");
});
