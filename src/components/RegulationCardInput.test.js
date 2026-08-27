import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { searchCardsByName } from "../services/cardSearch";
import { getCardImageCandidates } from "../utils/cardImages";
import RegulationCardInput, {
  CARD_CANDIDATE_DISPLAY_LIMIT,
  createRegulationCardState,
} from "./RegulationCardInput";

jest.mock("../services/cardSearch", () => ({
  searchCardsByName: jest.fn(),
  resolveCardReference: jest.fn(),
}));

function Harness({ initialValue = createRegulationCardState([]), label = "禁止カード" }) {
  const [value, setValue] = useState(initialValue);
  return (
    <RegulationCardInput
      idPrefix="test-card"
      label={label}
      value={value}
      onChange={setValue}
    />
  );
}

function createCandidates(count = 12) {
  return Array.from({ length: count }, (_, index) => ({
    cardId: String(100000001 + index),
    name: index < 2 ? "ガンダムF91" : `ガンダム候補${index + 1}`,
    setName: index === 0 ? "第1弾" : index === 1 ? "ベースドブースター" : `第${index + 1}弾`,
    imagePath: `/card-images/candidate-${index + 1}.jpg`,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("多数の検索候補を10件に絞り、画像・名前・収録弾をIDなしで表示する", async () => {
  const candidates = createCandidates();
  searchCardsByName.mockResolvedValue({
    cards: candidates,
    total: 722,
    isTruncated: true,
  });
  const { container } = render(<Harness />);

  fireEvent.change(screen.getByLabelText("禁止カードを検索"), {
    target: { value: "ガンダム" },
  });
  fireEvent.click(screen.getByRole("button", { name: "禁止カードの候補を検索" }));

  const summary = await screen.findByText(
    "722件の候補があります。先頭10件を表示しています。カード名をより具体的に入力して絞り込んでください。"
  );
  const results = summary.closest(".regulation-card-search-results");
  expect(results.querySelectorAll(".regulation-card-candidate-button")).toHaveLength(
    CARD_CANDIDATE_DISPLAY_LIMIT
  );
  expect(results).not.toHaveTextContent("100000001");
  const firstCandidate = within(results).getByRole("button", {
    name: "ガンダムF91、収録弾: 第1弾",
  });
  expect(firstCandidate).toBeInTheDocument();
  expect(
    within(results).getByRole("button", {
      name: "ガンダムF91、収録弾: ベースドブースター",
    })
  ).toBeInTheDocument();
  expect(within(results).getAllByRole("img")[0]).toHaveAttribute(
    "src",
    "/card-images-thumb/candidate-1.webp"
  );
  getCardImageCandidates(candidates[0]).forEach(() => {
    fireEvent.error(within(firstCandidate).getByRole("img"));
  });
  expect(firstCandidate.querySelector(".card-image-placeholder-code")).toHaveTextContent(
    "Unknown"
  );
  expect(firstCandidate).not.toHaveTextContent("100000001");
  expect(container.querySelectorAll(".regulation-card-candidate-button")).toHaveLength(10);
});

test("一括解決の曖昧候補にも同じ表示上限と識別情報を適用する", () => {
  const candidates = createCandidates();
  const initialValue = {
    selectedCards: [],
    draft: "",
    resolveVersion: 0,
    rows: [
      {
        id: "ambiguous-row",
        input: "ガンダム",
        lineNumber: 1,
        status: "ambiguous",
        candidates,
        candidateTotal: 722,
        message: "候補を選択してください。",
      },
    ],
  };

  render(<Harness initialValue={initialValue} />);

  const rowCandidates = screen.getByLabelText(/候補を選択してください。の候補$/);
  expect(rowCandidates.querySelectorAll(".regulation-card-candidate-button")).toHaveLength(10);
  expect(rowCandidates).toHaveTextContent(
    "722件の候補があります。先頭10件を表示しています。カード名を修正して絞り込んでください。"
  );
  expect(rowCandidates).not.toHaveTextContent("100000001");
  expect(
    within(rowCandidates).getByRole("button", {
      name: "ガンダムF91、収録弾: 第1弾",
    })
  ).toBeInTheDocument();
});

test("名前を取得できない既存カードだけは識別用IDを表示する", () => {
  render(
    <Harness
      initialValue={createRegulationCardState(["100000999"], {
        trustExistingIds: true,
      })}
    />
  );

  expect(screen.getByText("カード名未取得 (100000999)")).toBeInTheDocument();
});
