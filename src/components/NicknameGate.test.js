import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import NicknameGate, { useNicknameGuard } from "./NicknameGate";
import { useAuth, validateNickname } from "../context/AuthContext";

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn(),
  validateNickname: jest.fn(),
}));

function RequiredGateHarness() {
  return (
    <>
      <a href="/public">公開ページを見る</a>
      <NicknameGate />
    </>
  );
}

function GuardHarness() {
  const { guardNickname, NicknameGuardDialog } = useNicknameGuard();

  return (
    <>
      <button type="button" onClick={() => guardNickname()}>
        操作を続ける
      </button>
      <a href="/public">公開ページを見る</a>
      <NicknameGuardDialog />
    </>
  );
}

describe("NicknameGate", () => {
  let auth;

  beforeEach(() => {
    auth = {
      isAuthenticated: true,
      user: { nickname: "登録済み" },
      updateProfile: jest.fn().mockResolvedValue(undefined),
    };
    useAuth.mockImplementation(() => auth);
    validateNickname.mockReturnValue("");
  });

  test("必須ゲート内で初期focusとTab循環を保ち、Escapeでは閉じない", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/profile"]}>
        <RequiredGateHarness />
      </MemoryRouter>
    );
    const backgroundLink = screen.getByRole("link", { name: "公開ページを見る" });
    backgroundLink.focus();

    auth = { ...auth, user: { nickname: "" } };
    rerender(
      <MemoryRouter initialEntries={["/profile"]}>
        <RequiredGateHarness />
      </MemoryRouter>
    );

    const input = screen.getByLabelText("ニックネーム");
    const saveButton = screen.getByRole("button", { name: "保存" });
    expect(input).toHaveFocus();

    saveButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(input).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(saveButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(saveButton).toHaveFocus();

    backgroundLink.focus();
    expect(input).toHaveFocus();
  });

  test("必須ゲートの保存完了後は元のfocusへ戻る", async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/profile"]}>
        <RequiredGateHarness />
      </MemoryRouter>
    );
    const backgroundLink = screen.getByRole("link", { name: "公開ページを見る" });
    backgroundLink.focus();

    auth = { ...auth, user: { nickname: "" } };
    rerender(
      <MemoryRouter initialEntries={["/profile"]}>
        <RequiredGateHarness />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("ニックネーム"), {
      target: { value: "新しい名前" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith({ nickname: "新しい名前" }));
    auth = { ...auth, user: { nickname: "新しい名前" } };
    rerender(
      <MemoryRouter initialEntries={["/profile"]}>
        <RequiredGateHarness />
      </MemoryRouter>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(backgroundLink).toHaveFocus();
  });

  test("任意guardはEscapeでキャンセルし、起点へfocusを戻す", () => {
    auth = { ...auth, user: { nickname: "" } };
    render(<GuardHarness />);

    const trigger = screen.getByRole("button", { name: "操作を続ける" });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByLabelText("ニックネーム");
    const saveButton = screen.getByRole("button", { name: "保存" });
    expect(input).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(saveButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(input).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("任意guardの保存中はEscapeで閉じず、disabled要素からもfocusを外へ出さない", async () => {
    auth = {
      ...auth,
      user: { nickname: "" },
      updateProfile: jest.fn(() => new Promise(() => {})),
    };
    render(<GuardHarness />);

    const trigger = screen.getByRole("button", { name: "操作を続ける" });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByLabelText("ニックネーム");
    fireEvent.change(input, { target: { value: "新しい名前" } });
    const saveButton = screen.getByRole("button", { name: "保存" });
    saveButton.focus();
    fireEvent.click(saveButton);
    await waitFor(() => expect(saveButton).toBeDisabled());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(input).toHaveFocus();
  });

  test.each(["/terms", "/privacy"])("%s では必須ゲートを表示しない", (path) => {
    auth = { ...auth, user: { nickname: "" } };
    render(
      <MemoryRouter initialEntries={[path]}>
        <RequiredGateHarness />
      </MemoryRouter>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
