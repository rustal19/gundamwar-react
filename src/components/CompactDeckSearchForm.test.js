import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { FORMAT_PRESETS } from "../data/formats";
import CompactDeckSearchForm from "./CompactDeckSearchForm";

function renderForm(props = {}, initialEntry = "/deck") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CompactDeckSearchForm {...props} />
    </MemoryRouter>
  );
}

function ControlledForm({ initialFormatName, onFormatChange, onSearch }) {
  const [formatName, setFormatName] = useState(initialFormatName);

  return (
    <CompactDeckSearchForm
      formatName={formatName}
      onFormatChange={(nextFormatName) => {
        onFormatChange(nextFormatName);
        setFormatName(nextFormatName);
      }}
      onSearch={onSearch}
    />
  );
}

function LocationSearch() {
  const location = useLocation();
  return <span data-testid="location-search">{location.search}</span>;
}

test("共通フォーマットプリセットを指定なしとともに表示する", () => {
  renderForm();

  const select = screen.getByLabelText("デッキのフォーマット");
  const optionValues = Array.from(select.options, (option) => option.value);

  expect(optionValues[0]).toBe("");
  FORMAT_PRESETS.forEach(({ name }) => {
    expect(optionValues).toContain(name);
  });
});

test("URLのフォーマットを復元して検索条件へ含める", async () => {
  const onSearch = jest.fn();
  const formatName = "関西グロリアス";
  renderForm(
    { onSearch },
    `/deck?name=${encodeURIComponent("ガンダム")}&formatName=${encodeURIComponent(formatName)}&pageSize=50`
  );

  await waitFor(() => {
    expect(screen.getByLabelText("デッキのフォーマット")).toHaveValue(formatName);
  });

  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  expect(onSearch).toHaveBeenCalledTimes(1);
  const payload = onSearch.mock.calls[0][0];
  const query = new URLSearchParams(payload.queryString);
  expect(payload.params).toMatchObject({
    name: "ガンダム",
    formatName,
    page: 1,
    pageSize: "50",
  });
  expect(query.get("formatName")).toBe(formatName);
  expect(query.has("deckRangeType")).toBe(false);
  expect(query.has("deckRangeDetail")).toBe(false);
});

test("controlled選択を通知し、未送信の入力を保ったまま検索へ反映する", async () => {
  const onFormatChange = jest.fn();
  const onSearch = jest.fn();
  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <ControlledForm
        initialFormatName="関西クラシック"
        onFormatChange={onFormatChange}
        onSearch={onSearch}
      />
      <LocationSearch />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText("カード名"), {
    target: { value: "未送信のカード名" },
  });
  fireEvent.change(screen.getByLabelText("デッキのフォーマット"), {
    target: { value: "関西ライジング" },
  });

  expect(onFormatChange).toHaveBeenCalledWith("関西ライジング");
  expect(screen.getByLabelText("デッキのフォーマット")).toHaveValue("関西ライジング");
  await waitFor(() => {
    expect(
      new URLSearchParams(screen.getByTestId("location-search").textContent).get("formatName")
    ).toBe("関西ライジング");
  });
  expect(screen.getByLabelText("カード名")).toHaveValue("未送信のカード名");

  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  expect(onSearch.mock.calls[0][0].params).toMatchObject({
    name: "未送信のカード名",
    formatName: "関西ライジング",
  });
});

test("未知の保存フォーマットを維持し、リセットしてもデッキのフォーマットは消さない", () => {
  const onFormatChange = jest.fn();
  const onSearch = jest.fn();
  render(
    <MemoryRouter initialEntries={["/deck?mobileLayout=ios"]}>
      <ControlledForm
        initialFormatName="旧大会フォーマット"
        onFormatChange={onFormatChange}
        onSearch={onSearch}
      />
    </MemoryRouter>
  );

  expect(screen.getByLabelText("デッキのフォーマット")).toHaveValue("旧大会フォーマット");
  expect(screen.getByRole("option", { name: "旧大会フォーマット" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "リセット" }));

  // フォーマットは保存・適合判定・公開に使うデッキの属性なので、
  // 検索条件のリセットでは変更しない
  expect(onFormatChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText("デッキのフォーマット")).toHaveValue("旧大会フォーマット");
  const payload = onSearch.mock.calls[0][0];
  const query = new URLSearchParams(payload.queryString);
  expect(payload.params.formatName).toBe("旧大会フォーマット");
  expect(query.get("formatName")).toBe("旧大会フォーマット");
  expect(query.get("mobileLayout")).toBe("ios");
});

test("リセットは検索条件だけを消す", () => {
  const onSearch = jest.fn();
  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <ControlledForm initialFormatName="関西クラシック" onSearch={onSearch} />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByLabelText("カード名"), { target: { value: "ガンダム" } });
  fireEvent.click(screen.getByRole("button", { name: "リセット" }));

  const payload = onSearch.mock.calls[onSearch.mock.calls.length - 1][0];
  expect(payload.params.name).toBe("");
  expect(payload.params.formatName).toBe("関西クラシック");
});
