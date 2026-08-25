import { createTournamentParticipantNameFormatter } from "./participantDisplayName";

function entry(id, userId, name) {
  return { id, user: { id: userId, name } };
}

test("重複しない参加者名には識別子を付けない", () => {
  const entries = [entry("entry-1", "user-1", "山田"), entry("entry-2", "user-2", "佐藤")];
  const formatParticipantName = createTournamentParticipantNameFormatter(entries);

  expect(formatParticipantName(entries[0])).toBe("山田");
  expect(formatParticipantName(entries[1])).toBe("佐藤");
});

test("同じ表示名の参加者だけに異なる短い識別子を付ける", () => {
  const entries = [
    entry("entry-1", "user-1", "山田"),
    entry("entry-2", "user-2", "山田"),
    entry("entry-3", "user-3", "佐藤"),
  ];
  const formatParticipantName = createTournamentParticipantNameFormatter(entries);
  const first = formatParticipantName(entries[0]);
  const second = formatParticipantName(entries[1]);

  expect(first).toMatch(/^山田 #[0-9a-z]{4,}$/);
  expect(second).toMatch(/^山田 #[0-9a-z]{4,}$/);
  expect(first).not.toBe(second);
  expect(formatParticipantName(entries[2])).toBe("佐藤");
});

test("同名のゲスト参加者はエントリーIDで区別する", () => {
  const entries = [
    entry("guest-entry-1", null, "ゲスト"),
    entry("guest-entry-2", null, "ゲスト"),
  ];
  const formatParticipantName = createTournamentParticipantNameFormatter(entries);

  expect(formatParticipantName(entries[0])).toMatch(/^ゲスト #[0-9a-z]{4,}$/);
  expect(formatParticipantName(entries[1])).toMatch(/^ゲスト #[0-9a-z]{4,}$/);
  expect(formatParticipantName(entries[0])).not.toBe(formatParticipantName(entries[1]));
});

test("同じユーザーの識別子はエントリーIDや並び順が変わっても安定する", () => {
  const firstEntries = [
    entry("old-entry", "stable-user", "山田"),
    entry("other-entry", "other-user", "山田"),
  ];
  const secondEntries = [
    entry("other-entry-2", "other-user", "山田"),
    entry("new-entry", "stable-user", "山田"),
  ];
  const firstFormatter = createTournamentParticipantNameFormatter(firstEntries);
  const secondFormatter = createTournamentParticipantNameFormatter(secondEntries);

  expect(firstFormatter(firstEntries[0])).toBe(secondFormatter(secondEntries[1]));
  expect(firstFormatter({ ...firstEntries[0], id: "cloned-entry" })).toBe(
    firstFormatter(firstEntries[0])
  );
});
