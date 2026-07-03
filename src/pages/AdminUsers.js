import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUsers, updateUserRole } from "../services/users";
import "./SearchResults.css";

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
            <h1>Role Admin</h1>
            <div className="search-results-summary">Admin role required.</div>
          </div>
        </div>
        <div className="results-empty-state">You do not have permission to view this page.</div>
      </main>
    );
  }

  return (
    <main id="search-results-container">
      <div className="search-results-toolbar">
        <div className={compact ? "search-results-heading-row" : undefined}>
          <h1>Role Admin</h1>
          <div className="search-results-summary">Search users and update roles.</div>
        </div>
      </div>

      <form className="search-results-toolbar-actions" onSubmit={handleSubmit}>
        <input
          aria-label="User search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, email, ID, or role"
        />
        <button className="results-link-button primary" type="submit" disabled={isLoading}>
          Search
        </button>
      </form>

      {error ? <div className="results-empty-state">{error}</div> : null}

      {isLoading ? (
        <div className="results-empty-state">Loading...</div>
      ) : users.length === 0 ? (
        <div className="results-empty-state">No users found.</div>
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
