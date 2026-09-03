import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AsyncState from "../components/AsyncState";
import SearchResultCard from "../components/SearchResultCard";
import { FORMAT_PRESETS } from "../data/formats";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import {
  API_SEARCH_URL,
  buildSearchCriteriaSummary,
  formatSearchResultsSummary,
  getCardFormatStatus,
  getFormatSetCodes,
  hasSearchCriteria,
  parseSearchParams,
} from "../utils/searchResults";
import "./SearchResults.css";

const INITIAL_SEARCH_RESULTS = {
  results: [],
  total: 0,
  page: 1,
  pageSize: 50,
};

const isSearchResultsEmpty = (value) => !value?.results?.length;

const SearchResults = ({ compact = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    status,
    data: { results, total, page, pageSize },
    error,
    start,
    succeed,
    fail,
    reset,
  } = useAsyncResource(INITIAL_SEARCH_RESULTS, isSearchResultsEmpty);
  const [retryKey, setRetryKey] = useState(0);
  const [resourceRequestKey, setResourceRequestKey] = useState("");
  const [viewMode, setViewMode] = useState("detail");
  const parsedSearchParams = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );
  const hasCriteria = hasSearchCriteria(parsedSearchParams);
  const currentRequestKey = `${location.search}\u0000${retryKey}`;
  const selectedFormat = useMemo(() => {
    const formatName = parsedSearchParams.formatName;
    return FORMAT_PRESETS.find(({ name }) => name === formatName) || null;
  }, [parsedSearchParams]);
  const appliedCriteria = useMemo(
    () => buildSearchCriteriaSummary(parsedSearchParams),
    [parsedSearchParams]
  );
  const editSearchTarget = {
    pathname: "/search",
    search: location.search,
  };

  useEffect(() => {
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
    const requestedPage = Number(parsedSearchParams.page) || 1;
    const requestedPageSize = Number(parsedSearchParams.pageSize) || 50;

    if (!hasCriteria) {
      reset({
        results: [],
        total: 0,
        page: requestedPage,
        pageSize: requestedPageSize,
      });
      return undefined;
    }

    const abortController = new AbortController();
    let isActive = true;
    setResourceRequestKey(currentRequestKey);
    start();

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
        if (!isActive || abortController.signal.aborted) return;
        succeed({
          results: Array.isArray(data.data) ? data.data : [],
          total: data.total || 0,
          page: data.page || 1,
          pageSize: data.pageSize || requestedPageSize,
        });
      } catch (error) {
        if (!isActive || abortController.signal.aborted || error.name === "AbortError") return;
        console.error("Search API error:", error);
        fail("検索結果の読み込みに失敗しました。");
      }
    };

    loadResults();
    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [currentRequestKey, fail, hasCriteria, parsedSearchParams, reset, start, succeed]);

  const handleRetry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

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
  const displayStatus = !hasCriteria
    ? ASYNC_STATUS.IDLE
    : status === ASYNC_STATUS.IDLE || resourceRequestKey !== currentRequestKey
      ? ASYNC_STATUS.LOADING
      : status;
  const hasCompletedSearch =
    hasCriteria &&
    (displayStatus === ASYNC_STATUS.EMPTY || displayStatus === ASYNC_STATUS.SUCCESS);

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

  // デスクトップでは検索条件が無いときフォームを表示するため、結果パネルは出さない
  // (フォームと結果を排他表示。本番と同じ挙動)。モバイルは従来どおり縦積み。
  if (!compact && !hasCriteria) {
    return null;
  }

  return (
    <div id="search-results-container">
      <div className="search-results-toolbar">
        <div className={compact ? "search-results-heading-row" : undefined}>
          <h1>検索結果</h1>
          {hasCompletedSearch ? (
            <div className="search-results-summary">
              {formatSearchResultsSummary(total, page, totalPages)}
            </div>
          ) : null}
          {compact ? viewToggle : null}
        </div>
        {!compact && (
          <div className="search-results-toolbar-actions">
            {viewToggle}
            <Link
              className="results-link-button primary"
              to={buildPathWithForcedMobileLayout("/deck", location.search)}
            >
              デッキ
            </Link>
          </div>
        )}
      </div>

      <section className="search-criteria-panel" aria-labelledby="search-criteria-title">
        <div className="search-criteria-panel-heading">
          <h2 id="search-criteria-title">現在の検索条件</h2>
          <Link
            className="results-link-button search-criteria-edit-link"
            to={editSearchTarget}
            state={{ searchEditing: true }}
          >
            検索に戻る
          </Link>
        </div>
        <ul className="search-criteria-list">
          {appliedCriteria.map(({ key, label, value }) => (
            <li key={key} className="search-criteria-chip">
              {label}: {value}
            </li>
          ))}
        </ul>
      </section>

      {hasCompletedSearch ? pagination : null}

      <AsyncState
        status={displayStatus}
        error={error}
        idleMessage="検索条件を指定してください。"
        emptyMessage={
          total > 0
            ? "指定したページに表示できるカードはありません。検索条件またはページを変更してください。"
            : "検索条件に一致するカードはありません。"
        }
        errorMessage="検索結果の読み込みに失敗しました。"
        onRetry={handleRetry}
      >
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
      </AsyncState>

      {hasCompletedSearch ? pagination : null}
    </div>
  );
};

export default SearchResults;
