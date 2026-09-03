import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AsyncState from "./AsyncState";
import SearchResultCard from "./SearchResultCard";
import { FORMAT_PRESETS } from "../data/formats";
import { ASYNC_STATUS, useAsyncResource } from "../hooks/useAsyncResource";
import {
  API_SEARCH_URL,
  formatSearchResultsSummary,
  getCardFormatStatus,
  getFormatSetCodes,
  hasSearchCriteria,
  parseSearchParams,
} from "../utils/searchResults";
import "../pages/SearchResults.css";

const DEFAULT_SAMPLE_PAGE_SIZE = 20;
const INITIAL_SEARCH_RESULTS = {
  results: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_SAMPLE_PAGE_SIZE,
};

const isSearchResultsEmpty = (value) => !value?.results?.length;

const DeckSearchResults = ({ compact = false, formatName }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const resultsViewportRef = useRef(null);
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
  const isFormatControlled = formatName !== undefined;
  const selectedFormat = useMemo(() => {
    const locationFormatName = new URLSearchParams(location.search).get("formatName") || "";
    const activeFormatName = isFormatControlled ? formatName : locationFormatName;
    return FORMAT_PRESETS.find(({ name }) => name === activeFormatName) || null;
  }, [formatName, isFormatControlled, location.search]);

  const searchRequest = useMemo(() => {
    const parsedSearchParams = parseSearchParams(location.search);
    const apiSearchParams = { ...parsedSearchParams };
    const criteriaSearchParams = { ...parsedSearchParams };
    delete apiSearchParams.formatName;
    delete criteriaSearchParams.formatName;

    if (isFormatControlled) {
      // DeckBuilder's explicit selection is authoritative. In particular, an empty
      // selection means unrestricted even if an old bookmarked URL has legacy range fields.
      delete apiSearchParams.deckRangeType;
      delete apiSearchParams.deckRangeDetail;
      delete criteriaSearchParams.deckRangeType;
      delete criteriaSearchParams.deckRangeDetail;
    }

    if (selectedFormat) {
      criteriaSearchParams.formatName = selectedFormat.name;
      apiSearchParams.deckRangeType = "none";
      delete apiSearchParams.deckRangeDetail;
      const setCodes = getFormatSetCodes(selectedFormat.regulation);
      if (setCodes) {
        apiSearchParams.setIncluded = setCodes;
      }
    }

    const requestedPage = Number(parsedSearchParams.page) || 1;
    const requestedPageSize = Number(parsedSearchParams.pageSize) || DEFAULT_SAMPLE_PAGE_SIZE;
    if (selectedFormat && apiSearchParams.pageSize === undefined) {
      apiSearchParams.pageSize = requestedPageSize;
    }
    const shouldSearch = hasSearchCriteria(criteriaSearchParams);

    return {
      apiSearchParams,
      requestedPage,
      requestedPageSize,
      shouldSearch,
    };
  }, [isFormatControlled, location.search, selectedFormat]);
  const currentRequestKey = useMemo(
    () => `${JSON.stringify(searchRequest)}\u0000${retryKey}`,
    [retryKey, searchRequest]
  );

  useEffect(() => {
    const {
      apiSearchParams,
      requestedPage,
      requestedPageSize,
      shouldSearch,
    } = searchRequest;

    if (!shouldSearch) {
      reset({
        results: [],
        total: 0,
        page: 1,
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
        console.error("Deck search API error:", error);
        fail("検索結果の読み込みに失敗しました。");
      }
    };

    loadResults();
    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [currentRequestKey, fail, reset, searchRequest, start, succeed]);

  const handleRetry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

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
  const displayStatus = !searchRequest.shouldSearch
    ? ASYNC_STATUS.IDLE
    : status === ASYNC_STATUS.IDLE || resourceRequestKey !== currentRequestKey
      ? ASYNC_STATUS.LOADING
      : status;
  const hasCompletedSearch =
    searchRequest.shouldSearch &&
    (displayStatus === ASYNC_STATUS.EMPTY || displayStatus === ASYNC_STATUS.SUCCESS);

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

  const summary = hasCompletedSearch ? (
    <div className="search-results-summary">
      {formatSearchResultsSummary(total, page, totalPages)}
    </div>
  ) : null;

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

  return (
    <section className="deck-search-results-panel">
      {compact ? (
        <div className="search-results-toolbar deck-search-results-toolbar">
          <div className="deck-search-results-heading-bar">
            <div className="search-results-heading-row">
              <h2 className="deck-search-results-title">検索結果</h2>
              {summary}
            </div>
            {viewToggle}
          </div>

          <div className="deck-search-results-controls">
            {hasCompletedSearch ? pagination : null}
          </div>
        </div>
      ) : (
        <div className="deck-panel-header">
          <h2>検索結果</h2>
          <div className="deck-search-results-header-tools">
            {summary}
            {hasCompletedSearch ? pagination : null}
            {viewToggle}
          </div>
        </div>
      )}

      <div ref={resultsViewportRef} className="deck-search-results-viewport">
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
                  showDeckActions
                  formatStatus={formatStatus}
                />
              );
            })}
          </div>
        </AsyncState>
      </div>
    </section>
  );
};

export default DeckSearchResults;
