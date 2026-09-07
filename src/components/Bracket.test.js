import React from "react";
import { render, screen, within } from "@testing-library/react";
import Bracket from "./Bracket";

const entries = [
  { id: "entry-1", user: { name: "プレイヤー1" } },
  { id: "entry-2", user: { name: "プレイヤー2" } },
  { id: "entry-3", user: { name: "プレイヤー3" } },
  { id: "entry-4", user: { name: "プレイヤー4" } },
];

const rounds = [
  { id: "swiss-1", number: 1, stage: "swiss", status: "completed", matches: [] },
  {
    id: "top-cut-1",
    number: 2,
    stage: "top_cut",
    status: "completed",
    matches: [
      {
        id: "match-1",
        tableNo: 1,
        player1EntryId: "entry-1",
        player2EntryId: "entry-2",
        player1Games: 2,
        player2Games: 1,
        result: "p1_win",
      },
      {
        id: "match-2",
        tableNo: 2,
        player1EntryId: "entry-3",
        player2EntryId: "entry-4",
        player1Games: 0,
        player2Games: 2,
        result: "p2_win",
      },
    ],
  },
  {
    id: "top-cut-2",
    number: 3,
    stage: "top_cut",
    status: "in_progress",
    matches: [
      {
        id: "match-3",
        tableNo: 1,
        player1EntryId: "entry-1",
        player2EntryId: "entry-4",
        player1Games: null,
        player2Games: null,
        result: null,
      },
    ],
  },
];

test("確定済みSEラウンドは大会進行中でもスコアを表示する", () => {
  render(<Bracket rounds={rounds} entries={entries} />);

  expect(screen.getByRole("heading", { name: "決勝トーナメント1回戦" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "決勝トーナメント2回戦" })).toBeInTheDocument();
  expect(screen.getByText("2 - 1（P1勝利）")).toBeInTheDocument();
  expect(screen.getByText("0 - 2（P2勝利）")).toBeInTheDocument();
  expect(screen.queryByText("未報告")).not.toBeInTheDocument();

  expect(screen.getByLabelText("決勝トーナメント1回戦")).not.toHaveClass("final");
  expect(screen.getByLabelText("決勝トーナメント2回戦")).toHaveClass("final");
});

test("showResults指定時は進行中ラウンドの未報告状態も表示する", () => {
  render(<Bracket rounds={rounds} entries={entries} showResults />);

  expect(screen.getByText("未報告")).toBeInTheDocument();
});

test("ブラケットでは同名参加者だけを短い識別子で区別する", () => {
  const duplicateEntries = [
    { id: "entry-1", user: { id: "user-1", name: "同名選手" } },
    { id: "entry-2", user: { id: "user-2", name: "同名選手" } },
    ...entries.slice(2),
  ];

  render(<Bracket rounds={rounds} entries={duplicateEntries} />);

  const firstRound = screen.getByLabelText("決勝トーナメント1回戦");
  const duplicateLabels = within(firstRound).getAllByText(/^同名選手 #[0-9a-z]{4,}$/);
  expect(duplicateLabels).toHaveLength(2);
  expect(duplicateLabels[0].textContent).not.toBe(duplicateLabels[1].textContent);
  expect(within(firstRound).getByText("プレイヤー3")).toBeInTheDocument();
});
