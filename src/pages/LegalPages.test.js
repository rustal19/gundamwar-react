import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Terms from "./Terms";
import Privacy from "./Privacy";

// CRA の resetMocks は jest.fn の実装を消すため、素の関数で差し替える。
let mockDeletionFormUrl = "";
jest.mock("../data/siteContact", () => ({
  getDeletionRequestFormUrl: () => mockDeletionFormUrl,
  GA_DATA_USE_URL: "https://policies.google.com/technologies/partner-sites",
  GA_OPT_OUT_URL: "https://tools.google.com/dlpage/gaoptout",
}));

function renderPage(Page) {
  return render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockDeletionFormUrl = "";
});

test("プライバシーポリシーはGoogleアナリティクスの利用とオプトアウト手段を明示する", () => {
  renderPage(Privacy);

  expect(screen.getByText(/Googleが提供するアクセス解析ツール/)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Googleアナリティクス オプトアウト アドオン" })
  ).toHaveAttribute("href", "https://tools.google.com/dlpage/gaoptout");
});

test("利用規約もアクセス解析に触れ、詳細をプライバシーポリシーへ案内する", () => {
  renderPage(Terms);

  expect(screen.getByText(/Googleアナリティクスによるアクセス解析/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
    "href",
    "/privacy"
  );
});

// URLが未設定のまま公開されても、壊れたリンクを出さないことが要件。
test("削除依頼フォームのURLが未設定なら準備中の文面を出し、リンクを作らない", () => {
  renderPage(Privacy);
  expect(screen.getByText(/削除依頼窓口は準備中です/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "削除依頼フォーム" })).not.toBeInTheDocument();
});

test("規約側もURL未設定なら準備中の文面を出す", () => {
  renderPage(Terms);
  expect(screen.getByText(/削除依頼窓口は準備中です/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "削除依頼フォーム" })).not.toBeInTheDocument();
});

test("URLを設定するとプライバシーポリシーに窓口が出る", () => {
  mockDeletionFormUrl = "https://forms.gle/example";

  renderPage(Privacy);
  expect(screen.getByRole("link", { name: "削除依頼フォーム" })).toHaveAttribute(
    "href",
    "https://forms.gle/example"
  );
  expect(screen.queryByText(/削除依頼窓口は準備中です/)).not.toBeInTheDocument();
});

test("URLを設定すると規約にも窓口が出る", () => {
  mockDeletionFormUrl = "https://forms.gle/example";

  renderPage(Terms);
  expect(screen.getByRole("link", { name: "削除依頼フォーム" })).toHaveAttribute(
    "href",
    "https://forms.gle/example"
  );
  expect(screen.queryByText(/削除依頼窓口は準備中です/)).not.toBeInTheDocument();
});
