import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import "./SearchResults.css";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function countDeckItems(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Number(item?.count || 0),
    0
  );
}

export default function PublicDecks({ compact = false }) {
  const { authMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const page = Number(params.get("page") || 1);
  const query = params.get("query") || "";
  const [searchText, setSearchText] = useState(query);
  const [result, setResult] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    let isActive = true;
    setIsLoaded(false);
    setErrorMessage("");

    fetchPublicDecks({ page, query, authMode })
      .then((payload) => {
        if (!isActive) return;
        setResult(payload);
      })
      .catch((error) => {
        if (!isActive) return;
        setErrorMessage(error.message);
        setResult({ items: [], total: 0, page, pageSize: 20 });
      })
      .finally(() => {
        if (isActive) setIsLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [authMode, page, query]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize || 1));

  const navigateToPage = useCallback(
    (nextPage) => {
      const nextParams = new URLSearchParams(location.search);
      nextParams.set("page", String(nextPage));
      if (!nextParams.get("query")) nextParams.delete("query");
      navigate(`/decks?${nextParams.toString()}`);
      window.scrollTo(0, 0);
    },
    [location.search, navigate]
  );

  const handleSearch = (event) => {
    event.preventDefault();
    const nextParams = new URLSearchParams();
    if (searchText.trim()) nextParams.set("query", searchText.trim());
    nextParams.set("page", "1");
    navigate(`/decks?${nextParams.toString()}`);
  };

  const pagination = totalPages > 1 && (
    <div className="pagination">
      <button type="button" onClick={() => navigateToPage(page - 1)} disabled={page <= 1}>
        前へ
      </button>
      <span>{`${page} / ${totalPages}`}</span>
      <button type="button" onClick={() => navigateToPage(page + 1)} disabled={page >= totalPages}>
        次へ
      </button>
    </div>
  );

  return (
    <main id="search-results-container" className={compact ? "public-decks compact" : "public-decks"}>
      <div className="search-results-toolbar">
        <div className={compact ? "search-results-heading-row" : undefined}>
          <h1>公開デッキ</h1>
          <div className="search-results-summary">{`${result.total}件 / 新着順`}</div>
        </div>
        <Link className="results-link-button primary" to="/deck">
          デッキ作成
        </Link>
      </div>

      <form className="public-decks-search" onSubmit={handleSearch}>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="デッキ名・説明・ユーザー名で検索"
        />
        <button type="submit" className="deck-action-button primary">
          検索
        </button>
      </form>

      {pagination}

      {!isLoaded ? (
        <div className="results-empty-state">Loading...</div>
      ) : errorMessage ? (
        <div className="results-empty-state">{errorMessage}</div>
      ) : result.items.length === 0 ? (
        <div className="results-empty-state">公開デッキはありません。</div>
      ) : (
        <div className="results-list">
          {result.items.map((deck) => (
            <article key={deck.id} className="public-deck-card">
              <div>
                <h2>
                  <Link to={`/decks/${deck.id}`}>{deck.title}</Link>
                </h2>
                <p>{deck.description || "説明はありません。"}</p>
              </div>
              <div className="public-deck-meta">
                <span>{deck.owner?.name || "-"}</span>
                <span>{`${countDeckItems(deck.items)}枚`}</span>
                <span>{formatDate(deck.publishedAt || deck.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination}
    </main>
  );
}
