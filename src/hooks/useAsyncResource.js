import { useCallback, useRef, useState } from "react";

export const ASYNC_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  ERROR: "error",
  EMPTY: "empty",
  SUCCESS: "success",
});

export function isAsyncValueEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function normalizeAsyncError(error, localizedMessage = "") {
  if (typeof localizedMessage === "string" && localizedMessage.trim()) {
    return localizedMessage;
  }
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return "読み込みに失敗しました。";
}

/**
 * 非同期取得を idle / loading / error / empty / success のいずれか1つとして保持する。
 * 取得値と表示状態を同じ state にまとめ、失敗を空配列として扱うことを防ぐ。
 */
export function useAsyncResource(initialData = null, isEmpty = isAsyncValueEmpty) {
  const initialDataRef = useRef(initialData);
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;

  const [resource, setResource] = useState(() => ({
    status: ASYNC_STATUS.IDLE,
    data: initialData,
    error: "",
  }));

  const start = useCallback(({ retainData = false } = {}) => {
    setResource((current) => ({
      status: ASYNC_STATUS.LOADING,
      data: retainData ? current.data : initialDataRef.current,
      error: "",
    }));
  }, []);

  const succeed = useCallback((data) => {
    setResource({
      status: isEmptyRef.current(data) ? ASYNC_STATUS.EMPTY : ASYNC_STATUS.SUCCESS,
      data,
      error: "",
    });
    return data;
  }, []);

  const update = useCallback((updater) => {
    setResource((current) => {
      const data = typeof updater === "function" ? updater(current.data) : updater;
      return {
        status: isEmptyRef.current(data) ? ASYNC_STATUS.EMPTY : ASYNC_STATUS.SUCCESS,
        data,
        error: "",
      };
    });
  }, []);

  const fail = useCallback((error, localizedMessage) => {
    const message = normalizeAsyncError(error, localizedMessage);
    setResource({
      status: ASYNC_STATUS.ERROR,
      data: initialDataRef.current,
      error: message,
    });
    return message;
  }, []);

  const reset = useCallback((data = initialDataRef.current) => {
    setResource({
      status: ASYNC_STATUS.IDLE,
      data,
      error: "",
    });
  }, []);

  return {
    ...resource,
    start,
    succeed,
    update,
    fail,
    reset,
  };
}
