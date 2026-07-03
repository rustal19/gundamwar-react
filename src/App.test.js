import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

test("ヘッダーと検索フォームが表示される", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText("Gundam War Database")).toBeInTheDocument();
  expect(screen.getByText("カード名")).toBeInTheDocument();
});

test("フッターに利用規約とプライバシーポリシーへのリンクが表示される", () => {
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
  expect(screen.getByText(/非公式ファンサイト/)).toBeInTheDocument();
});
