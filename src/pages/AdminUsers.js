import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AsyncState from "../components/AsyncState";
import { useAuth } from "../context/AuthContext";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import { fetchUsers, resetUserNickname, updateUserRole } from "../services/users";

// 内部値をそのまま出すと、何ができる権限なのか読み取れない。
const ROLES = [
  { value: "user", label: "一般ユーザー" },
  { value: "organizer", label: "主催者(大会を作成・運営できる)" },
  { value: "admin", label: "管理者(権限管理ができる)" },
];

export default function AdminUsers({ compact = false }) {
  const { authMode, isAdmin, isAuthenticated, isReady } = useAuth();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [actionError, setActionError] = useState("");
  // 処理中・完了を操作ごとに持つ。同じ操作の連打は止めたいが、
  // 権限変更中にニックネームリセットを行う操作は塞がない。
  const [pendingRoleUserId, setPendingRoleUserId] = useState("");
  const [pendingNicknameUserId, setPendingNicknameUserId] = useState("");
  const [doneMessageByUserId, setDoneMessageByUserId] = useState({});
  const usersRequestIdRef = useRef(0);
  const {
    status: usersStatus,
    data: users,
    error: usersError,
    start: startUsersLoad,
    succeed: succeedUsersLoad,
    update: updateUsers,
    fail: failUsersLoad,
    reset: resetUsersLoad,
  } = useAsyncResource([]);

  const loadUsers = useCallback(
    async (nextQuery = "") => {
      if (isReady === false || !isAdmin) return;

      const requestId = usersRequestIdRef.current + 1;
      usersRequestIdRef.current = requestId;
      setSubmittedQuery(nextQuery);
      setActionError("");
      startUsersLoad();
      try {
        const payload = await fetchUsers({ query: nextQuery, authMode });
        if (usersRequestIdRef.current === requestId) {
          succeedUsersLoad(Array.isArray(payload.items) ? payload.items : []);
        }
      } catch {
        if (usersRequestIdRef.current === requestId) {
          failUsersLoad("ユーザー情報を取得できませんでした。時間をおいて再試行してください。");
        }
      }
    },
    [
      authMode,
      failUsersLoad,
      isAdmin,
      isReady,
      startUsersLoad,
      succeedUsersLoad,
    ]
  );

  useEffect(() => {
    if (isReady === false || !isAdmin) {
      usersRequestIdRef.current += 1;
      resetUsersLoad();
      return;
    }
    loadUsers("");
    return () => {
      usersRequestIdRef.current += 1;
    };
  }, [isAdmin, isReady, loadUsers, resetUsersLoad]);

  const handleSubmit = (event) => {
    event.preventDefault();
    loadUsers(query);
  };

  const handleRoleChange = async (userId, role) => {
    const requestId = usersRequestIdRef.current;
    setActionError("");
    setPendingRoleUserId(userId);
    setDoneMessageByUserId((current) => ({ ...current, [userId]: "" }));
    try {
      const updatedUser = await updateUserRole({ userId, role, authMode });
      if (usersRequestIdRef.current === requestId) {
        updateUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === updatedUser.id ? { ...user, role: updatedUser.role } : user
          )
        );
        setDoneMessageByUserId((current) => ({ ...current, [userId]: "権限を変更しました。" }));
      }
    } catch {
      if (usersRequestIdRef.current === requestId) {
        setActionError("ユーザーのロールを変更できませんでした。もう一度お試しください。");
      }
    } finally {
      if (usersRequestIdRef.current === requestId) setPendingRoleUserId("");
    }
  };

  const handleNicknameReset = async (userId) => {
    if (!window.confirm("このユーザーのニックネームをリセットしますか？")) return;

    const requestId = usersRequestIdRef.current;
    setActionError("");
    setPendingNicknameUserId(userId);
    setDoneMessageByUserId((current) => ({ ...current, [userId]: "" }));
    try {
      const updatedUser = await resetUserNickname({ userId, authMode });
      if (usersRequestIdRef.current === requestId) {
        updateUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === updatedUser.id ? { ...user, nickname: "" } : user
          )
        );
        setDoneMessageByUserId((current) => ({
          ...current,
          [userId]: "ニックネームをリセットしました。",
        }));
      }
    } catch {
      if (usersRequestIdRef.current === requestId) {
        setActionError("ニックネームをリセットできませんでした。もう一度お試しください。");
      }
    } finally {
      if (usersRequestIdRef.current === requestId) setPendingNicknameUserId("");
    }
  };

  if (isReady === false) {
    return (
      <main id="search-results-container">
        <div className="search-results-toolbar">
          <div>
            <h1>権限管理</h1>
            <div className="search-results-summary">admin 権限を確認しています。</div>
          </div>
        </div>
        <AsyncState
          status={ASYNC_STATUS.LOADING}
          loadingMessage="認証情報を読み込み中..."
        />
      </main>
    );
  }

  // 未ログインと「ログイン済みだが admin ではない」を同じ文面にすると、
  // 前者はログインすれば解決するのに手詰まりに見える。導線を分ける。
  if (!isAdmin) {
    return (
      <main id="search-results-container">
        <div className="search-results-toolbar">
          <div>
            <h1>権限管理</h1>
            <div className="search-results-summary">
              {isAuthenticated ? "admin 権限が必要です。" : "ログインが必要です。"}
            </div>
          </div>
        </div>
        {isAuthenticated ? (
          <div className="results-empty-state">
            このページを表示する権限がありません。admin 権限をお持ちの場合は運営者にご確認ください。
          </div>
        ) : (
          <div className="results-empty-state">
            <p>このページは admin 権限のあるアカウントでログインすると表示できます。</p>
            <Link to="/profile">ログイン画面へ</Link>
          </div>
        )}
      </main>
    );
  }

  return (
    <main id="search-results-container">
      <div className="search-results-toolbar">
        <div className={compact ? "search-results-heading-row" : undefined}>
          <h1>権限管理</h1>
          <div className="search-results-summary">ユーザーを検索してロールを変更します。</div>
        </div>
      </div>

      <form className="search-results-toolbar-actions" onSubmit={handleSubmit}>
        {/* プレースホルダーだけだと入力を始めた時点で目的が消える */}
        <label className="admin-user-search-field" htmlFor="admin-user-search">
          <span>ユーザー検索</span>
          <input
            id="admin-user-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="名前・メール・ID・権限で検索"
          />
        </label>
        <button
          className="results-link-button primary"
          type="submit"
          disabled={usersStatus === ASYNC_STATUS.LOADING}
        >
          検索
        </button>
      </form>

      {actionError ? (
        <div className="results-empty-state" role="alert">
          {actionError}
        </div>
      ) : null}

      <AsyncState
        status={usersStatus}
        error={usersError}
        idleMessage="ユーザー情報はまだ取得されていません。"
        loadingMessage="ユーザー情報を読み込み中..."
        emptyMessage={
          submittedQuery.trim()
            ? "検索条件に一致するユーザーはいません。"
            : "登録されているユーザーはいません。"
        }
        onRetry={() => loadUsers(submittedQuery)}
      >
        <div className="results-list">
          {users.map((user) => (
            <div className="card-item result-card" key={user.id}>
              <div className="result-card-content">
                <div className="result-card-header">
                  <div>
                    <strong className="card-model-name">{user.name}</strong>
                    {/* メールが無いとIDが同じ位置に裸で出て、何の文字列か分からない */}
                    <div className="card-text">
                      {user.email ? `メール: ${user.email}` : `ユーザーID: ${user.id}`}
                    </div>
                    <div className="card-text">ニックネーム: {user.nickname || "未設定"}</div>
                  </div>
                  <label className="card-actions">
                    <span className="search-results-summary">権限</span>
                    <select
                      value={user.role}
                      disabled={pendingRoleUserId === user.id}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                    >
                      {ROLES.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="results-link-button"
                    disabled={pendingNicknameUserId === user.id}
                    onClick={() => handleNicknameReset(user.id)}
                  >
                    ニックネームをリセット
                  </button>
                  <span className="admin-user-row-status" aria-live="polite">
                    {pendingRoleUserId === user.id || pendingNicknameUserId === user.id
                      ? "変更を反映中..."
                      : doneMessageByUserId[user.id] || ""}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AsyncState>
    </main>
  );
}
