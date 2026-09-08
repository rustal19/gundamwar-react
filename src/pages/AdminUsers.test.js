import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminUsers from "./AdminUsers";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, resetUserNickname, updateUserRole } from "../services/users";

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../services/users", () => ({
  fetchUsers: jest.fn(),
  resetUserNickname: jest.fn(),
  updateUserRole: jest.fn(),
}));

const alice = {
  id: "u1",
  name: "Alice",
  email: "alice@example.test",
  nickname: "アリス",
  role: "user",
};

function renderAdmin(authValue = {}, props = {}) {
  useAuth.mockReturnValue({
    authMode: "mock",
    isAdmin: true,
    isAuthenticated: true,
    isReady: true,
    ...authValue,
  });
  return render(
    <MemoryRouter>
      <AdminUsers {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchUsers.mockResolvedValue({ items: [alice] });
  resetUserNickname.mockResolvedValue({ ...alice, nickname: "" });
  updateUserRole.mockResolvedValue({ ...alice, role: "organizer" });
  window.confirm = jest.fn(() => true);
});

test("初回取得中は0件表示を出さない", () => {
  fetchUsers.mockReturnValue(new Promise(() => {}));

  renderAdmin();

  expect(screen.getByText("ユーザー情報を読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("登録されているユーザーはいません。")).not.toBeInTheDocument();
  expect(screen.queryByText("検索条件に一致するユーザーはいません。")).not.toBeInTheDocument();
});

test("無条件取得と検索後で空状態の理由を区別する", async () => {
  fetchUsers.mockResolvedValueOnce({ items: [] });
  renderAdmin();

  expect(await screen.findByText("登録されているユーザーはいません。")).toBeInTheDocument();

  fetchUsers.mockResolvedValueOnce({ items: [] });
  fireEvent.change(screen.getByLabelText("ユーザー検索"), { target: { value: "nobody" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  expect(await screen.findByText("検索条件に一致するユーザーはいません。")).toBeInTheDocument();
  expect(screen.queryByText("登録されているユーザーはいません。")).not.toBeInTheDocument();
});

test("取得失敗は空状態や古い一覧を併記せず、失敗した条件で再試行する", async () => {
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fetchUsers.mockRejectedValueOnce(new Error("Request failed with status 500"));
  fireEvent.change(screen.getByLabelText("ユーザー検索"), { target: { value: "alice" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  expect(
    await screen.findByText("ユーザー情報を取得できませんでした。時間をおいて再試行してください。")
  ).toBeInTheDocument();
  expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  expect(screen.queryByText("検索条件に一致するユーザーはいません。")).not.toBeInTheDocument();
  expect(screen.queryByText("Request failed with status 500")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("ユーザー検索"), { target: { value: "edited" } });
  fireEvent.click(screen.getByRole("button", { name: "再試行" }));

  expect(await screen.findByText("Alice")).toBeInTheDocument();
  expect(fetchUsers).toHaveBeenLastCalledWith({ query: "alice", authMode: "mock" });
});

test("認証準備中は権限エラーやユーザー取得を開始しない", () => {
  renderAdmin({ isAdmin: false, isReady: false });

  expect(screen.getByText("認証情報を読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("このページを表示する権限がありません。")).not.toBeInTheDocument();
  expect(fetchUsers).not.toHaveBeenCalled();
});

test("未ログインでは権限エラーではなくログイン導線を表示する", () => {
  renderAdmin({ isAdmin: false, isAuthenticated: false, isReady: true });

  expect(screen.getByRole("link", { name: "ログイン画面へ" })).toBeInTheDocument();
  expect(
    screen.queryByText(/このページを表示する権限がありません。/)
  ).not.toBeInTheDocument();
  expect(fetchUsers).not.toHaveBeenCalled();
});

test("管理者でなければ既存の権限制御を維持する", () => {
  renderAdmin({ isAdmin: false, isReady: true });

  expect(
    screen.getByText(/このページを表示する権限がありません。/)
  ).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "ログイン画面へ" })).not.toBeInTheDocument();
  expect(fetchUsers).not.toHaveBeenCalled();
});

test("compact表示ではユーザー情報と操作を全幅カード用の構造で表示する", async () => {
  const { container } = renderAdmin({}, { compact: true });

  expect(await screen.findByText("Alice")).toBeInTheDocument();
  expect(container.querySelector("main")).toHaveClass("admin-users-page--compact");
  expect(screen.getByText("メール: alice@example.test")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "権限" })).toHaveTextContent(
    "主催者(大会を作成・運営できる)"
  );
  expect(screen.getByRole("button", { name: "ニックネームをリセット" })).toBeInTheDocument();
});

test("ニックネームリセットを確認で取り消した場合はAPIを呼ばない", async () => {
  window.confirm.mockReturnValue(false);
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "ニックネームをリセット" }));

  expect(window.confirm).toHaveBeenCalledWith(
    "このユーザーのニックネームをリセットしますか？"
  );
  expect(resetUserNickname).not.toHaveBeenCalled();
});

test("ロール更新エラーは取得済み一覧を消さずに日本語で表示する", async () => {
  updateUserRole.mockRejectedValue(new Error("forbidden"));
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "権限" }), {
    target: { value: "organizer" },
  });

  expect(
    await screen.findByText("ユーザーのロールを変更できませんでした。もう一度お試しください。")
  ).toBeInTheDocument();
  expect(screen.getByText("Alice")).toBeInTheDocument();
  expect(screen.queryByText("ユーザー情報を取得できませんでした。")).not.toBeInTheDocument();
});

test("ロール変更とニックネームリセット後も一覧の成功状態を保つ", async () => {
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "権限" }), {
    target: { value: "organizer" },
  });
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "権限" })).toHaveValue("organizer")
  );

  fireEvent.click(screen.getByRole("button", { name: "ニックネームをリセット" }));

  expect(await screen.findByText("ニックネーム: 未設定")).toBeInTheDocument();
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Alice")).toBeInTheDocument();
});

test("検索開始前の更新応答が新しい検索結果を上書きしない", async () => {
  let resolveRoleUpdate;
  updateUserRole.mockReturnValue(
    new Promise((resolve) => {
      resolveRoleUpdate = resolve;
    })
  );
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "権限" }), {
    target: { value: "organizer" },
  });

  fetchUsers.mockResolvedValueOnce({
    items: [{ ...alice, id: "u2", name: "Bob", email: "bob@example.test" }],
  });
  fireEvent.change(screen.getByLabelText("ユーザー検索"), { target: { value: "bob" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  expect(await screen.findByText("Bob")).toBeInTheDocument();

  await act(async () => {
    resolveRoleUpdate({ ...alice, role: "organizer" });
  });

  expect(screen.getByText("Bob")).toBeInTheDocument();
  expect(screen.queryByText("Alice")).not.toBeInTheDocument();
});

test("同時に完了したロール変更とニックネームリセットを両方反映する", async () => {
  let resolveRoleUpdate;
  let resolveNicknameReset;
  updateUserRole.mockReturnValue(
    new Promise((resolve) => {
      resolveRoleUpdate = resolve;
    })
  );
  resetUserNickname.mockReturnValue(
    new Promise((resolve) => {
      resolveNicknameReset = resolve;
    })
  );
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "権限" }), {
    target: { value: "organizer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ニックネームをリセット" }));

  await act(async () => {
    resolveRoleUpdate({ ...alice, role: "organizer" });
  });
  await act(async () => {
    resolveNicknameReset({ ...alice, nickname: "" });
  });

  expect(screen.getByRole("combobox", { name: "権限" })).toHaveValue("organizer");
  expect(screen.getByText("ニックネーム: 未設定")).toBeInTheDocument();
});

test("同時更新が逆順に完了しても変更済みの別フィールドを戻さない", async () => {
  let resolveRoleUpdate;
  let resolveNicknameReset;
  updateUserRole.mockReturnValue(
    new Promise((resolve) => {
      resolveRoleUpdate = resolve;
    })
  );
  resetUserNickname.mockReturnValue(
    new Promise((resolve) => {
      resolveNicknameReset = resolve;
    })
  );
  renderAdmin();
  expect(await screen.findByText("Alice")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "権限" }), {
    target: { value: "organizer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ニックネームをリセット" }));

  await act(async () => {
    resolveNicknameReset({ ...alice, nickname: "" });
  });
  await act(async () => {
    resolveRoleUpdate({ ...alice, role: "organizer" });
  });

  expect(screen.getByRole("combobox", { name: "権限" })).toHaveValue("organizer");
  expect(screen.getByText("ニックネーム: 未設定")).toBeInTheDocument();
});
