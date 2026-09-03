import { fireEvent, render, screen } from "@testing-library/react";
import AsyncState from "./AsyncState";
import { ASYNC_STATUS } from "../hooks/useAsyncResource";

test.each([
  [ASYNC_STATUS.IDLE, "未実行です。"],
  [ASYNC_STATUS.LOADING, "取得しています。"],
  [ASYNC_STATUS.ERROR, "通信に失敗しました。"],
  [ASYNC_STATUS.EMPTY, "対象データはありません。"],
])("%s の内容だけを表示する", (status, expected) => {
  render(
    <AsyncState
      status={status}
      error="通信に失敗しました。"
      idleMessage="未実行です。"
      loadingMessage="取得しています。"
      emptyMessage="対象データはありません。"
    >
      <div>取得成功</div>
    </AsyncState>
  );

  expect(screen.getByText(expected)).toBeInTheDocument();
  expect(screen.queryByText("取得成功")).not.toBeInTheDocument();
});

test("成功時だけ取得内容を表示する", () => {
  render(
    <AsyncState status={ASYNC_STATUS.SUCCESS}>
      <div>取得成功</div>
    </AsyncState>
  );

  expect(screen.getByText("取得成功")).toBeInTheDocument();
  expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
});

test("エラー時に再試行できる", () => {
  const onRetry = jest.fn();
  render(
    <AsyncState
      status={ASYNC_STATUS.ERROR}
      error="取得できませんでした。"
      onRetry={onRetry}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

