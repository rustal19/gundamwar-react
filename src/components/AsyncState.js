import React from "react";
import { ASYNC_STATUS, normalizeAsyncError } from "../hooks/useAsyncResource";

/**
 * 取得状態に対応する内容だけを排他的に描画する。
 */
export default function AsyncState({
  status,
  error,
  idleMessage = "まだ実行されていません。",
  loadingMessage = "読み込み中...",
  emptyMessage = "表示する内容がありません。",
  errorMessage = "",
  onRetry,
  retryLabel = "再試行",
  className = "results-empty-state",
  retryButtonClassName = "results-link-button",
  children,
}) {
  if (status === ASYNC_STATUS.SUCCESS) return <>{children}</>;

  let message = idleMessage;
  if (status === ASYNC_STATUS.LOADING) message = loadingMessage;
  if (status === ASYNC_STATUS.EMPTY) message = emptyMessage;
  if (status === ASYNC_STATUS.ERROR) {
    message = normalizeAsyncError(error, errorMessage);
  }

  return (
    <div
      className={className}
      role={status === ASYNC_STATUS.ERROR ? "alert" : "status"}
    >
      <span>{message}</span>
      {status === ASYNC_STATUS.ERROR && onRetry ? (
        <>
          {" "}
          <button
            type="button"
            className={retryButtonClassName}
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        </>
      ) : null}
    </div>
  );
}
