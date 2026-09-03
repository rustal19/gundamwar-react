import { act, renderHook } from "@testing-library/react";
import {
  ASYNC_STATUS,
  normalizeAsyncError,
  useAsyncResource,
} from "./useAsyncResource";

test("非同期取得の5状態を排他的に遷移する", () => {
  const { result } = renderHook(() => useAsyncResource([]));

  expect(result.current).toMatchObject({
    status: ASYNC_STATUS.IDLE,
    data: [],
    error: "",
  });

  act(() => result.current.start());
  expect(result.current.status).toBe(ASYNC_STATUS.LOADING);

  act(() => result.current.succeed([]));
  expect(result.current.status).toBe(ASYNC_STATUS.EMPTY);

  act(() => result.current.succeed([{ id: "item-1" }]));
  expect(result.current).toMatchObject({
    status: ASYNC_STATUS.SUCCESS,
    data: [{ id: "item-1" }],
    error: "",
  });

  act(() =>
    result.current.update((items) => [...items, { id: "item-2" }])
  );
  expect(result.current).toMatchObject({
    status: ASYNC_STATUS.SUCCESS,
    data: [{ id: "item-1" }, { id: "item-2" }],
  });

  act(() => result.current.fail(new Error("取得できませんでした。")));
  expect(result.current).toMatchObject({
    status: ASYNC_STATUS.ERROR,
    data: [],
    error: "取得できませんでした。",
  });

  act(() => result.current.reset());
  expect(result.current.status).toBe(ASYNC_STATUS.IDLE);
});

test("独自の空判定を使える", () => {
  const { result } = renderHook(() =>
    useAsyncResource(
      { items: [] },
      (payload) => !Array.isArray(payload?.items) || payload.items.length === 0
    )
  );

  act(() => result.current.succeed({ items: [] }));
  expect(result.current.status).toBe(ASYNC_STATUS.EMPTY);

  act(() => result.current.succeed({ items: [{ id: "item-1" }] }));
  expect(result.current.status).toBe(ASYNC_STATUS.SUCCESS);
});

test("日本語の画面用メッセージを通信エラーの原文より優先する", () => {
  expect(
    normalizeAsyncError(
      new Error("Failed to fetch"),
      "データを読み込めませんでした。"
    )
  ).toBe("データを読み込めませんでした。");
});
