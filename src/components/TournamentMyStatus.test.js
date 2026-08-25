import { render, screen } from "@testing-library/react";
import TournamentMyStatus, {
  getMyStatusPhase,
  getRoundCountdown,
  isSelfCheckinOpen,
} from "./TournamentMyStatus";

const entry = { id: "entry-1", status: "registered" };

describe("getMyStatusPhase", () => {
  it("returns before_start for an entered registration tournament before the start date", () => {
    const phase = getMyStatusPhase(
      { status: "registration", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      entry,
      [],
      new Date(2026, 6, 11, 23, 59)
    );

    expect(phase).toBe("before_start");
  });

  it("returns checkin on the start date before rounds are generated", () => {
    const phase = getMyStatusPhase(
      { status: "registration", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      entry,
      [],
      new Date(2026, 6, 12, 8, 0)
    );

    expect(phase).toBe("checkin");
  });

  it("returns checkin after a configured opening time even on the previous day", () => {
    const phase = getMyStatusPhase(
      {
        status: "registration",
        startsAt: new Date(2026, 6, 12, 10, 0).toISOString(),
        checkinOpensAt: new Date(2026, 6, 11, 18, 0).toISOString(),
      },
      entry,
      [],
      new Date(2026, 6, 11, 18, 0)
    );

    expect(phase).toBe("checkin");
  });

  it("returns round once at least one round exists", () => {
    const phase = getMyStatusPhase(
      { status: "in_progress", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      entry,
      [{ id: "round-1", number: 1, matches: [] }],
      new Date(2026, 6, 12, 10, 30)
    );

    expect(phase).toBe("round");
  });

  it("returns not_entered without my entry", () => {
    const phase = getMyStatusPhase(
      { status: "registration", startsAt: new Date(2026, 6, 12, 10, 0).toISOString() },
      null,
      [],
      new Date(2026, 6, 11, 10, 0)
    );

    expect(phase).toBe("not_entered");
  });
});

describe("isSelfCheckinOpen", () => {
  it("uses the configured timestamp inclusively instead of the tournament date", () => {
    const tournament = {
      startsAt: new Date(2026, 6, 12, 10, 0).toISOString(),
      checkinOpensAt: new Date(2026, 6, 11, 18, 0).toISOString(),
    };

    expect(isSelfCheckinOpen(tournament, new Date(2026, 6, 11, 17, 59))).toBe(false);
    expect(isSelfCheckinOpen(tournament, new Date(2026, 6, 11, 18, 0))).toBe(true);
  });
});

describe("getRoundCountdown", () => {
  it("returns a remaining time label from the timer start and round minutes", () => {
    const countdown = getRoundCountdown(
      "2026-07-08T10:00:00.000Z",
      50,
      new Date("2026-07-08T10:12:34.000Z")
    );

    expect(countdown).toMatchObject({
      label: "残り 37:26",
      expired: false,
    });
  });

  it("returns time up after the round time has elapsed", () => {
    const countdown = getRoundCountdown(
      "2026-07-08T10:00:00.000Z",
      50,
      new Date("2026-07-08T10:50:01.000Z")
    );

    expect(countdown).toEqual({
      remainingMs: 0,
      label: "時間切れ",
      expired: true,
    });
  });

  it("returns null when timer data is incomplete", () => {
    expect(getRoundCountdown(null, 50, new Date("2026-07-08T10:00:00.000Z"))).toBeNull();
    expect(getRoundCountdown("2026-07-08T10:00:00.000Z", null, new Date("2026-07-08T10:00:00.000Z"))).toBeNull();
  });
});

function statusProps(overrides = {}) {
  return {
    tournament: {
      status: "registration",
      startsAt: new Date(2099, 0, 1, 10, 0).toISOString(),
      decklistRequired: true,
    },
    myEntry: {
      ...entry,
      decklistState: "submitted",
      decklistSubmittedAt: new Date().toISOString(),
      deckLockedAt: null,
    },
    entries: [entry],
    rounds: [],
    isAuthenticated: true,
    canRegister: true,
    canUpdateDeck: true,
    canLateEntry: false,
    canCancel: true,
    deckSource: "current",
    onDeckSourceChange: jest.fn(),
    selectedDeckId: "",
    onSelectedDeckChange: jest.fn(),
    savedDecks: [],
    submittedItems: [
      { id: "main-1", zone: "main", count: 2 },
      { id: "side-1", zone: "side", count: 1 },
    ],
    deckViolations: [],
    onSubmitEntry: jest.fn(),
    onRequestLateEntry: jest.fn(),
    onCancelEntry: jest.fn(),
    onCheckIn: jest.fn(),
    submitDisabled: false,
    isSubmitting: false,
    ...overrides,
  };
}

afterEach(() => {
  jest.useRealTimers();
});

test("チェックイン開始前はボタンを無効化し、開始時刻を理由として表示する", () => {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date(2026, 7, 26, 10, 0));
  const tournament = {
    ...statusProps().tournament,
    startsAt: new Date(2026, 7, 27, 10, 0).toISOString(),
    checkinOpensAt: new Date(2026, 7, 26, 11, 0).toISOString(),
    selfCheckin: true,
  };

  render(<TournamentMyStatus {...statusProps({ tournament })} />);

  const checkInButton = screen.getByRole("button", { name: "チェックインする" });
  expect(checkInButton).toBeDisabled();
  expect(checkInButton).toHaveAttribute(
    "title",
    "セルフチェックインは8月26日 11:00から利用できます。"
  );
  expect(
    screen.getByText("セルフチェックインは8月26日 11:00から利用できます。")
  ).toBeInTheDocument();
});

test("チェックイン開始時刻以降は前日でもボタンを有効化する", () => {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date(2026, 7, 26, 11, 0));
  const tournament = {
    ...statusProps().tournament,
    startsAt: new Date(2026, 7, 27, 10, 0).toISOString(),
    checkinOpensAt: new Date(2026, 7, 26, 11, 0).toISOString(),
    selfCheckin: true,
  };

  render(<TournamentMyStatus {...statusProps({ tournament })} />);

  expect(screen.getByRole("button", { name: "チェックインする" })).toBeEnabled();
  expect(
    screen.queryByText("セルフチェックインは8月26日 11:00から利用できます。")
  ).not.toBeInTheDocument();
});

test("デッキ枚数は提出デッキ行だけに表示し、開始前は対戦履歴を表示しない", () => {
  render(<TournamentMyStatus {...statusProps()} />);

  expect(screen.getAllByText("メイン 2 / サイド 1")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "対戦履歴" })).not.toBeInTheDocument();
});

test("ラウンド生成後は対戦履歴を表示する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        rounds: [{ id: "round-1", number: 1, status: "in_progress", matches: [] }],
      })}
    />
  );

  expect(screen.getByRole("button", { name: "対戦履歴" })).toBeInTheDocument();
});

test("ラウンド中でもロック解除後は再提出UIを表示する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        myEntry: {
          ...entry,
          decklistState: "submitted",
          decklistSubmittedAt: new Date().toISOString(),
          deckLockedAt: null,
          deckUnlockedAt: new Date().toISOString(),
        },
        rounds: [{ id: "round-1", number: 1, status: "in_progress", matches: [] }],
        canUpdateDeck: true,
      })}
    />
  );

  expect(screen.getByText("デッキリストは提出済みです。差し替えできます。")).toBeInTheDocument();
  expect(
    screen.getByText(
      "主催者がロックを解除しています。再提出するとデッキリストは再びロックされます。"
    )
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "提出を更新" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "デッキを選ぶ" })).toBeInTheDocument();
});

test("エントリー済みで提出デッキが空なら更新を無効化して理由を表示する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        submittedItems: [],
        deckViolations: [{ code: "main_count", message: "メインデッキが不足しています。" }],
        submitDisabled: true,
      })}
    />
  );

  expect(screen.getByRole("button", { name: "提出を更新" })).toBeDisabled();
  expect(
    screen.getByText("提出するデッキがありません。完成したデッキを選択してください。")
  ).toBeInTheDocument();
});

test("任意大会の未エントリー状態ではデッキなしエントリーを案内する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        tournament: {
          status: "registration",
          startsAt: new Date(2099, 0, 1, 10, 0).toISOString(),
          decklistRequired: false,
        },
        myEntry: null,
        submittedItems: [],
        deckViolations: [{ code: "main_count", message: "メインデッキが不足しています。" }],
      })}
    />
  );

  expect(screen.getByRole("button", { name: "エントリー" })).toBeEnabled();
  expect(screen.getByText("デッキリストを添付せずにエントリーします。")).toBeInTheDocument();
  expect(screen.queryByText("デッキリストを提出できません。")).not.toBeInTheDocument();
});

test("受付中の未エントリー状態ではエントリーフォームを表示する", () => {
  render(<TournamentMyStatus {...statusProps({ myEntry: null })} />);

  expect(screen.getByRole("button", { name: "エントリー" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "デッキを選ぶ" })).toBeInTheDocument();
  expect(screen.queryByText("受付が終了しました。")).not.toBeInTheDocument();
});

test("受付終了後の未エントリー状態ではフォームを隠して終了メッセージだけを表示する", () => {
  render(<TournamentMyStatus {...statusProps({ myEntry: null, canRegister: false })} />);

  expect(screen.getByText("受付が終了しました。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "エントリー" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
  expect(screen.queryByText("保存デッキまたは現在のデッキを選んで提出してください。")).not.toBeInTheDocument();
});

test("エントリー済みなら通常受付終了後も提出更新UIを表示する", () => {
  render(<TournamentMyStatus {...statusProps({ canRegister: false })} />);

  expect(screen.getByRole("heading", { name: "エントリー済み" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "提出を更新" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "取り消し" })).toBeInTheDocument();
  expect(screen.queryByText("受付が終了しました。")).not.toBeInTheDocument();
});

test("ロック中は変更不可を案内し提出UIを描画しない", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        myEntry: {
          ...entry,
          decklistState: "locked",
          decklistSubmittedAt: new Date().toISOString(),
          deckLockedAt: new Date().toISOString(),
        },
        canUpdateDeck: true,
      })}
    />
  );

  expect(
    screen.getByText(
      "チェックイン済みのためデッキリストは変更できません(修正が必要な場合は主催者へ)"
    )
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出を更新" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("公開中は差し替え不可を案内し提出UIを描画しない", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        tournament: { ...statusProps().tournament, status: "completed", decklistsPublic: true },
        myEntry: {
          ...entry,
          decklistState: "revealed",
          decklistSubmittedAt: new Date().toISOString(),
          deckLockedAt: new Date().toISOString(),
        },
        canUpdateDeck: true,
        canCancel: false,
      })}
    />
  );

  expect(screen.getByText("デッキリストは公開中のため差し替えできません。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出を更新" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("進行中で途中参加可能なら受付終了表示ではなく途中参加申請UIを表示する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        tournament: { ...statusProps().tournament, status: "in_progress", lateEntry: true },
        myEntry: null,
        canRegister: false,
        canLateEntry: true,
      })}
    />
  );

  expect(screen.getByRole("heading", { name: "途中参加申請" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "参加申請" })).toBeInTheDocument();
  expect(screen.queryByText("受付が終了しました。")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("進行中で途中参加不可なら受付終了だけを表示する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        tournament: { ...statusProps().tournament, status: "in_progress", lateEntry: false },
        myEntry: null,
        canRegister: false,
        canLateEntry: false,
      })}
    />
  );

  expect(screen.getByText("受付が終了しました。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "参加申請" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("完了済み大会の未エントリー状態では受付終了だけを表示する", () => {
  render(
    <TournamentMyStatus
      {...statusProps({
        tournament: { ...statusProps().tournament, status: "completed" },
        myEntry: null,
        canRegister: false,
      })}
    />
  );

  expect(screen.getByText("受付が終了しました。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "エントリー" })).not.toBeInTheDocument();
});
