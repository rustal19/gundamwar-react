import { normalizeUser } from "./AuthContext";

describe("normalizeUser", () => {
  it("defaults missing role to user", () => {
    expect(normalizeUser({ id: "u1", email: "u1@example.test" })).toEqual(
      expect.objectContaining({
        id: "u1",
        role: "user",
      })
    );
  });

  it("keeps supported roles", () => {
    expect(normalizeUser({ id: "u1", role: "organizer" }).role).toBe("organizer");
    expect(normalizeUser({ id: "u2", role: "admin" }).role).toBe("admin");
  });

  it("normalizes unknown role to user", () => {
    expect(normalizeUser({ id: "u1", role: "owner" }).role).toBe("user");
  });
});
