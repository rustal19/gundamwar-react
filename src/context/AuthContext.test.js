import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, normalizeUser, useAuth } from "./AuthContext";

const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";

function ProfileUpdater() {
  const { signInWithMock, updateProfile, user } = useAuth();

  return (
    <div>
      <div data-testid="nickname">{user?.nickname || ""}</div>
      <button type="button" onClick={() => signInWithMock("user")}>
        sign in
      </button>
      <button type="button" onClick={() => updateProfile({ nickname: "アムロ" })}>
        update
      </button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn(() => Promise.reject(new Error("network disabled in tests")));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("normalizeUser includes normalized nickname and displayNickname", () => {
  expect(
    normalizeUser({
      id: "user-1",
      email: "test@example.com",
      name: "Google Name",
      nickname: "  シャア  ",
      role: "organizer",
    })
  ).toEqual({
    id: "user-1",
    email: "test@example.com",
    name: "Google Name",
    avatarUrl: "",
    role: "organizer",
    nickname: "シャア",
    displayNickname: "シャア",
  });
});

test("normalizeUser defaults missing role to user", () => {
  expect(normalizeUser({ id: "u1", email: "u1@example.test" })).toEqual(
    expect.objectContaining({
      id: "u1",
      role: "user",
    })
  );
});

test("normalizeUser keeps supported roles", () => {
  expect(normalizeUser({ id: "u1", role: "organizer" }).role).toBe("organizer");
  expect(normalizeUser({ id: "u2", role: "admin" }).role).toBe("admin");
});

test("normalizeUser normalizes unknown role to user", () => {
  expect(normalizeUser({ id: "u1", role: "owner" }).role).toBe("user");
});

test("updateProfile updates mock user nickname in context and localStorage", async () => {
  render(
    <AuthProvider>
      <ProfileUpdater />
    </AuthProvider>
  );

  fireEvent.click(screen.getByText("sign in"));
  await waitFor(() => expect(screen.getByTestId("nickname")).toHaveTextContent(""));

  fireEvent.click(screen.getByText("update"));

  await waitFor(() => expect(screen.getByTestId("nickname")).toHaveTextContent("アムロ"));
  expect(JSON.parse(window.localStorage.getItem(MOCK_USER_KEY))).toMatchObject({
    id: "local-demo-user",
    nickname: "アムロ",
    displayNickname: "アムロ",
  });
});
