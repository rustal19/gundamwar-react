import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SearchResultCard from "../components/SearchResultCard";
import { FORMAT_PRESETS } from "../data/formats";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import {
  API_SEARCH_URL,
  getCardFormatStatus,
  getFormatSetCodes,
  parseSearchParams,
} from "../utils/searchResults";
import "./SearchResults.css";

const NON_CRITERIA_KEYS = new Set(["page", "pageSize", "mobileLayout", "sortMethod", "sortOrder"]);

const NON_CRITERIA_DEFAULTS = {
  colorMulti: "able",
  deckRangeType: "none",
  exclude: "no",
  includeAltStats: true,
  name_forward: false,
  traits_logic: "and",
};

function hasSearchCriteria(params) {
  return Object.entries(params).some(([key, value]) => {
    if (NON_CRITERIA_KEYS.has(key)) return false;
    if (Object.prototype.hasOwnProperty.call(NON_CRITERIA_DEFAULTS, key)) {
      return value !== NON_CRITERIA_DEFAULTS[key];
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim() !== "";
    if (typeof value === "boolean") return value;
    return value !== null && value !== undefined && value !== "";
  });
}

const SearchResults = ({ compact = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsCriteria, setNeedsCriteria] = useState(false);
  const [viewMode, setViewMode] = useState("detail");
  const selectedFormat = useMemo(() => {
    const formatName = new URLSearchParams(location.search).get("formatName");
    return FORMAT_PRESETS.find(({ name }) => name === formatName) || null;
  }, [location.search]);

  useEffect(() => {
    const parsedSearchParams = parseSearchParams(location.search);
    const apiSearchParams = { ...parsedSearchParams };
    delete apiSearchParams.formatName;
    const activeFormat = FORMAT_PRESETS.find(
      ({ name }) => name === parsedSearchParams.formatName
    );
    if (activeFormat) {
      // フォーマット選択時は使用可能収録弾でサーバー側フィルタし、範囲外カードを結果に出さない。
      apiSearchParams.deckRangeType = "none";
      delete apiSearchParams.deckRangeDetail;
      const setCodes = getFormatSetCodes(activeFormat.regulation);
      if (setCodes) {
        apiSearchParams.setIncluded = setCodes;
      }
    }
    setPage(Number(parsedSearchParams.page) || 1);
    setPageSize(Number(parsedSearchParams.pageSize) || 50);
    setIsLoaded(false);
    setNeedsCriteria(false);

    if (!hasSearchCriteria(parsedSearchParams)) {
      setResults([]);
      setTotal(0);
      setIsLoaded(true);
      setNeedsCriteria(true);
      return undefined;
    }

    const abortController = new AbortController();

    const loadResults = async () => {
      try {
        const response = await fetch(API_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiSearchParams),
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

  const viewToggle = (
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
  );

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
        <div className={compact ? "search-results-heading-row" : undefined}>
          <h1>検索結果</h1>
          <div className="search-results-summary">{`${total}件 / ${page} / ${totalPages}ページ`}</div>
          {compact ? viewToggle : null}
        </div>
        {!compact && (
          <div className="search-results-toolbar-actions">
            {viewToggle}
            <Link
              className="results-link-button"
              to={buildPathWithForcedMobileLayout("/search", location.search)}
            >
              検索に戻る
            </Link>
            <Link
              className="results-link-button primary"
              to={buildPathWithForcedMobileLayout("/deck", location.search)}
            >
              デッキ
            </Link>
          </div>
        )}
      </div>

      {!needsCriteria ? pagination : null}

      {!isLoaded ? (
        <div className="results-empty-state">読み込み中...</div>
      ) : needsCriteria ? (
        <div className="results-empty-state">検索条件を指定してください。</div>
      ) : results.length === 0 ? (
        <div className="results-empty-state">検索結果がありません。</div>
      ) : (
        <div className={viewMode === "image" ? "results-list results-image-grid" : "results-list"}>
          {results.map((card) => {
            const formatStatus = selectedFormat
              ? getCardFormatStatus(card, selectedFormat.regulation)
              : undefined;
            return (
              <SearchResultCard
                key={card.cardId}
                card={card}
                viewMode={viewMode}
                showDeckActions={false}
                compactDetailLayout={compact}
                enableImagePreview={compact || viewMode === "image"}
                formatStatus={formatStatus}
              />
            );
          })}
        </div>
      )}

      {!needsCriteria ? pagination : null}
    </div>
  );
};

export default SearchResults;
