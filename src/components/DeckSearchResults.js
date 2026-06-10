import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchResultCard from "./SearchResultCard";
import { API_SEARCH_URL, parseSearchParams } from "../utils/searchResults";
import "../pages/SearchResults.css";

const DEFAULT_SAMPLE_PAGE_SIZE = 20;
const NON_FILTER_KEYS = new Set(["page", "pageSize"]);

function hasMeaningfulFilters(searchParams) {
  return Object.entries(searchParams).some(([key, value]) => {
    if (NON_FILTER_KEYS.has(key)) return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  });
}

const DeckSearchResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const resultsViewportRef = useRef(null);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_SAMPLE_PAGE_SIZE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState("detail");

  useEffect(() => {
    const parsedSearchParams = parseSearchParams(location.search);
    const requestedPage = Number(parsedSearchParams.page) || 1;
    const requestedPageSize = Number(parsedSearchParams.pageSize) || DEFAULT_SAMPLE_PAGE_SIZE;
    const useSampleOnly = !hasMeaningfulFilters(parsedSearchParams);

    if (useSampleOnly) {
      setResults([]);
      setTotal(0);
      setPage(1);
      setPageSize(requestedPageSize);
      setIsLoaded(true);
      return undefined;
    }

    setPage(requestedPage);
    setPageSize(requestedPageSize);
    setIsLoaded(false);

    const abortController = new AbortController();

    const loadResults = async () => {
      try {
        const response = await fetch(API_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parsedSearchParams),
          mode: "cors",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setResults(data.data || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setPageSize(data.pageSize || requestedPageSize);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Deck search API error:", error);
        setResults([]);
        setTotal(0);
        setPage(requestedPage);
        setPageSize(requestedPageSize);
      } finally {
        setIsLoaded(true);
      }
    };

    loadResults();
    return () => abortController.abort();
  }, [location.search]);

  useEffect(() => {
    resultsViewportRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.search]);

  const handlePageChange = useCallback(
    (nextPage) => {
      const params = new URLSearchParams(location.search);
      params.set("page", String(nextPage));
      navigate(`${location.pathname}?${params.toString()}`);
    },
    [location.pathname, location.search, navigate]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize || 1));

  const pagination = useMemo(() => {
    if (totalPages <= 1) return null;

    const buttons = [];
    const windowSize = 2;

    if (page > 1) {
      buttons.push(
        <button key="prev" type="button" onClick={() => handlePageChange(page - 1)}>
          前へ
        </button>
      );
    }

    if (page > windowSize + 2) {
      buttons.push(
        <button key={1} type="button" onClick={() => handlePageChange(1)}>
          1
        </button>,
        <span key="start-gap">...</span>
      );
    } else {
      for (let number = 1; number < Math.max(1, page - windowSize); number += 1) {
        buttons.push(
          <button key={number} type="button" onClick={() => handlePageChange(number)}>
            {number}
          </button>
        );
      }
    }

    for (
      let number = Math.max(1, page - windowSize);
      number <= Math.min(totalPages, page + windowSize);
      number += 1
    ) {
      buttons.push(
        <button
          key={number}
          type="button"
          onClick={() => handlePageChange(number)}
          disabled={number === page}
          className={number === page ? "pagination-current" : ""}
        >
          {number}
        </button>
      );
    }

    if (page < totalPages - windowSize - 1) {
      buttons.push(
        <span key="end-gap">...</span>,
        <button key={totalPages} type="button" onClick={() => handlePageChange(totalPages)}>
          {totalPages}
        </button>
      );
    } else {
      for (let number = page + windowSize + 1; number <= totalPages; number += 1) {
        buttons.push(
          <button key={number} type="button" onClick={() => handlePageChange(number)}>
            {number}
          </button>
        );
      }
    }

    if (page < totalPages) {
      buttons.push(
        <button key="next" type="button" onClick={() => handlePageChange(page + 1)}>
          次へ
        </button>
      );
    }

    return <div className="pagination pagination-inline">{buttons}</div>;
  }, [handlePageChange, page, totalPages]);

  return (
    <section className="deck-search-results-panel">
      <div className="deck-panel-header">
        <h2>検索結果</h2>
        <div className="deck-search-results-header-tools">
          <div className="search-results-summary">{`${total}件 / ${page} / ${totalPages}ページ`}</div>
          {pagination}
          <div className="search-results-view-toggle" aria-label="検索結果の表示切替">
            <button
              type="button"
              className={viewMode === "detail" ? "active" : ""}
              onClick={() => setViewMode("detail")}
            >
              詳細
            </button>
            <button
              type="button"
              className={viewMode === "image" ? "active" : ""}
              onClick={() => setViewMode("image")}
            >
              画像のみ
            </button>
          </div>
        </div>
      </div>

      <div ref={resultsViewportRef} className="deck-search-results-viewport">
        {!isLoaded ? (
          <div className="results-empty-state">Loading...</div>
        ) : results.length === 0 ? (
          <div className="results-empty-state">検索結果がありません。</div>
        ) : (
          <div className={viewMode === "image" ? "results-list results-image-grid" : "results-list"}>
            {results.map((card) => (
              <SearchResultCard key={card.cardId} card={card} viewMode={viewMode} showDeckActions />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default DeckSearchResults;
