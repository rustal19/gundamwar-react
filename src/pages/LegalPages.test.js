import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Terms from "./Terms";
import Privacy from "./Privacy";

// CRA の resetMocks は jest.fn の実装を消すため、素の関数で差し替える。
let mockDeletionFormUrl = "";
jest.mock("../data/siteContact", () => ({
  getDeletionRequestFormUrl: () => mockDeletionFormUrl,
  LEGAL_ESTABLISHED_DATE: "2026年9月10日",
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

test("利用規約に規約変更の条項がある", () => {
  renderPage(Terms);

  const heading = screen.getByRole("heading", { name: "規約の変更" });
  expect(heading).toBeInTheDocument();
  expect(screen.getByText(/このページに掲載した時点から適用します/)).toBeInTheDocument();
});

test("プライバシーポリシーにも変更の条項がある", () => {
  renderPage(Privacy);

  expect(screen.getByRole("heading", { name: "本ポリシーの変更" })).toBeInTheDocument();
  expect(screen.getByText(/このページに掲載した時点から適用します/)).toBeInTheDocument();
});

// 実装と食い違う案内を出さないための固定。デッキとニックネームは自分で操作でき、
// 大会の記録は残り、アカウントだけが依頼になる。
test("削除の案内が、自分でできること・できないこと・依頼が要ることを区別する", () => {
  renderPage(Privacy);

  expect(
    screen.getByText(/デッキ構築画面の「読み込み」からご自身で削除できます/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/ニックネームはマイページでいつでも変更でき/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/大会の記録として残るため削除できません/)
  ).toBeInTheDocument();
  expect(screen.getByText(/削除依頼窓口は準備中です/)).toBeInTheDocument();
});

test("規約側も同じ区別をしている", () => {
  renderPage(Terms);

  expect(
    screen.getByText(/デッキ構築画面の「読み込み」からご自身で削除できます/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/大会の記録として残るため削除できません/)
  ).toBeInTheDocument();
});

test("フォームURLを設定しても、自分でできる案内は残る", () => {
  mockDeletionFormUrl = "https://forms.gle/example";

  renderPage(Privacy);
  expect(
    screen.getByText(/デッキ構築画面の「読み込み」からご自身で削除できます/)
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "削除依頼フォーム" })).toBeInTheDocument();
});

test("規約とプライバシーポリシーに制定日が入っている", () => {
  renderPage(Terms);
  expect(screen.getByText(/制定日: 2026年9月10日/)).toBeInTheDocument();
});

test("プライバシーポリシーにも制定日が入っている", () => {
  renderPage(Privacy);
  expect(screen.getByText(/制定日: 2026年9月10日/)).toBeInTheDocument();
});
