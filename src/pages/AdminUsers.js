import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, updateUserRole } from "../services/users";

const ROLES = ["user", "organizer", "admin"];

export default function AdminUsers({ compact = false }) {
  const { authMode, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(
    async (nextQuery = "") => {
      if (!isAdmin) return;
      setIsLoading(true);
      setError("");
      try {
        const payload = await fetchUsers({ query: nextQuery, authMode });
        setUsers(Array.isArray(payload.items) ? payload.items : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    },
    [authMode, isAdmin]
  );

  useEffect(() => {
    loadUsers("");
  }, [loadUsers]);

  const handleSubmit = (event) => {
    event.preventDefault();
    loadUsers(query);
  };

  const handleRoleChange = async (userId, role) => {
    setError("");
    try {
      const updatedUser = await updateUserRole({ userId, role, authMode });
      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
      );
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  if (!isAdmin) {
    return (
      <main id="search-results-container">
        <div className="search-results-toolbar">
          <div>
            <h1>権限管理</h1>
            <div className="search-results-summary">admin 権限が必要です。</div>
          </div>
        </div>
        <div className="results-empty-state">このページを表示する権限がありません。</div>
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
        <input
          aria-label="ユーザー検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="名前・メール・ID・ロールで検索"
        />
        <button className="results-link-button primary" type="submit" disabled={isLoading}>
          検索
        </button>
      </form>

      {error ? <div className="results-empty-state">{error}</div> : null}

      {isLoading ? (
        <div className="results-empty-state">読み込み中...</div>
      ) : users.length === 0 ? (
        <div className="results-empty-state">ユーザーが見つかりません。</div>
      ) : (
        <div className="results-list">
          {users.map((user) => (
            <div className="card-item result-card" key={user.id}>
              <div className="result-card-content">
                <div className="result-card-header">
                  <div>
                    <strong className="card-model-name">{user.name}</strong>
                    <div className="card-text">{user.email || user.id}</div>
                  </div>
                  <label className="card-actions">
                    <span className="search-results-summary">role</span>
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
