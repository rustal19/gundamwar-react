import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TournamentCard from "./TournamentCard";

const baseTournament = {
  id: "t-card",
  title: "テスト大会",
  status: "registration",
  startsAt: "2026-08-01T10:00:00.000Z",
  format: "swiss",
  regulation: { name: "スタンダード" },
  entryCount: 0,
  capacity: 16,
};

test("下書き大会は下書き表示付きで管理ページへリンクする", () => {
  render(
    <MemoryRouter>
      <TournamentCard tournament={{ ...baseTournament, status: "draft" }} />
    </MemoryRouter>
  );

  expect(screen.getByText("下書き")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "テスト大会" })).toHaveAttribute(
    "href",
    "/tournaments/t-card/manage"
  );
  expect(screen.getByRole("link", { name: "詳細" })).toHaveAttribute(
    "href",
    "/tournaments/t-card/manage"
  );
});

test("公開中の大会は従来どおり詳細ページへリンクする", () => {
  render(
    <MemoryRouter>
      <TournamentCard tournament={baseTournament} />
    </MemoryRouter>
  );

  expect(screen.getByText("受付中")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "テスト大会" })).toHaveAttribute(
    "href",
    "/tournaments/t-card"
  );
  expect(screen.getByRole("link", { name: "詳細" })).toHaveAttribute(
    "href",
    "/tournaments/t-card"
  );
});

test("縦積み・横並びのどちらでも日付から「日」が抜けない", () => {
  const { unmount } = render(
    <MemoryRouter>
      <TournamentCard tournament={baseTournament} />
    </MemoryRouter>
  );
  // 縦積み(既定)。大会一覧のモバイル幅ではCSSがこの3要素を横一列にするため、
  // 数字だけだと「8月 1 (土)」と読めなくなる。
  expect(screen.getByText("1日")).toBeInTheDocument();
  unmount();

  render(
    <MemoryRouter>
      <TournamentCard tournament={baseTournament} dateLayout="inline" />
    </MemoryRouter>
  );
  expect(screen.getByText("8月1日")).toBeInTheDocument();
});
