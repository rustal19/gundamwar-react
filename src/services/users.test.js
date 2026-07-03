import { fetchUsers, resetUserNickname, updateUserRole, USERS_STORAGE_KEY } from "./users";

describe("users service mock storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("fetches and filters mock users", async () => {
    window.localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify([
        { id: "u1", email: "alice@example.test", name: "Alice", role: "user" },
        { id: "u2", email: "bob@example.test", name: "Bob", role: "organizer" },
      ])
    );

    const result = await fetchUsers({ query: "bob" });

    expect(result.items).toEqual([
      { id: "u2", email: "bob@example.test", name: "Bob", nickname: "", role: "organizer" },
    ]);
    expect(result.total).toBe(1);
  });

  it("updates a mock user role", async () => {
    window.localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify([{ id: "u1", email: "alice@example.test", name: "Alice", role: "user" }])
    );

    const updatedUser = await updateUserRole({ userId: "u1", role: "admin" });
    const result = await fetchUsers({ query: "" });

    expect(updatedUser.role).toBe("admin");
    expect(result.items[0].role).toBe("admin");
  });

  it("resets a mock user nickname", async () => {
    window.localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "u1",
          email: "alice@example.test",
          name: "Alice",
          nickname: "アリス",
          role: "user",
        },
      ])
    );

    const updatedUser = await resetUserNickname({ userId: "u1" });
    const result = await fetchUsers({ query: "" });

    expect(updatedUser.nickname).toBe("");
    expect(result.items[0].nickname).toBe("");
  });

  it("normalizes unsupported roles to user", async () => {
    const updatedUser = await updateUserRole({ userId: "u1", role: "owner" });

    expect(updatedUser.role).toBe("user");
  });
});
