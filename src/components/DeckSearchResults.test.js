import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeckSearchResults from "./DeckSearchResults";

const originalFetch = global.fetch;
const originalScrollTo = window.HTMLElement.prototype.scrollTo;

beforeAll(() => {
  window.HTMLElement.prototype.scrollTo = jest.fn();
});

function renderResults(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DeckSearchResults />
    </MemoryRouter>
  );
}

afterEach(() => {
  global.fetch = originalFetch;
});

afterAll(() => {
  window.HTMLElement.prototype.scrollTo = originalScrollTo;
});

test("検索前は検索条件の指定を促す", async () => {
  global.fetch = jest.fn();

  renderResults("/deck");

  expect(await screen.findByText("検索条件を指定してください。")).toBeInTheDocument();
  expect(screen.queryByText("検索結果がありません。")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("検索を実行して0件なら検索結果なしと表示する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  });

  renderResults("/deck?name=存在しないカード");

  expect(await screen.findByText("検索結果がありません。")).toBeInTheDocument();
  expect(screen.queryByText("検索条件を指定してください。")).not.toBeInTheDocument();
});
