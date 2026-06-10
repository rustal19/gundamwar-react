import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchResultCard from "../components/SearchResultCard";
import { API_SEARCH_URL, parseSearchParams } from "../utils/searchResults";
import "./SearchResults.css";

const MobileSearchResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const parsedSearchParams = parseSearchParams(location.search);
    setPage(Number(parsedSearchParams.page) || 1);
    setPageSize(Number(parsedSearchParams.pageSize) || 50);
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
        setPageSize(data.pageSize || 50);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Search API error:", error);
        window.alert(`Failed to load search results: ${error.message}`);
      } finally {
        setIsLoaded(true);
      }
    };

    loadResults();
    return () => abortController.abort();
  }, [location.search]);

  const handlePageChange = useCallback(
    (nextPage) => {
      const params = new URLSearchParams(location.search);
      params.set("page", String(nextPage));
      navigate(`/search?${params.toString()}`);
      window.scrollTo(0, 0);
    },
    [location.search, navigate]
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

    return <div className="pagination">{buttons}</div>;
  }, [handlePageChange, page, totalPages]);

  return (
    <div id="search-results-container">
      <div className="search-results-toolbar">
        <div className="search-results-heading-row">
          <h1>検索結果</h1>
          <div className="search-results-summary">{`${total}件 / ${page} / ${totalPages}ページ`}</div>
        </div>
      </div>

      {pagination}

      {!isLoaded ? (
        <div className="results-empty-state">Loading...</div>
      ) : results.length === 0 ? (
        <div className="results-empty-state">検索結果がありません。</div>
      ) : (
        <div className="results-list">
          {results.map((card) => (
            <SearchResultCard
              key={card.cardId}
              card={card}
              showDeckActions={false}
              compactDetailLayout
              enableImagePreview
            />
          ))}
        </div>
      )}

      {pagination}
    </div>
  );
};

export default MobileSearchResults;
