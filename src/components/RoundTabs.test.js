import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RoundTabs from "./RoundTabs";

test("SEラウンドはSE内連番で表示し、選択値には全体のラウンド番号を使う", () => {
  const onChange = jest.fn();
  const rounds = [
    { id: "top-cut-2", number: 4, stage: "top_cut" },
    { id: "swiss-1", number: 1, stage: "swiss" },
    { id: "top-cut-1", number: 3, stage: "top_cut" },
    { id: "swiss-2", number: 2, stage: "swiss" },
  ];

  render(
    <RoundTabs rounds={rounds} selectedRoundNumber={3} onChange={onChange} />
  );

  expect(screen.getByRole("button", { name: "第1回戦" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "第2回戦" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "決勝トーナメント1回戦" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "決勝トーナメント2回戦" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "第3回戦" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "決勝トーナメント2回戦" }));
  expect(onChange).toHaveBeenCalledWith(4);
});
