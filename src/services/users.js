const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
export const USERS_STORAGE_KEY = "gundamwar.users.v1";

const VALID_ROLES = new Set(["user", "organizer", "admin"]);
const DEFAULT_USERS = [
  {
    id: "local-demo-user",
    email: "local-demo@gundamwar.test",
    name: "ローカル確認ユーザー",
    role: "user",
  },
];

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function normalizeRole(role) {
  return VALID_ROLES.has(role) ? role : "user";
}

function normalizeUser(rawUser) {
  if (!rawUser?.id) return null;
  return {
    id: String(rawUser.id),
    email: rawUser.email || "",
    name: rawUser.name || rawUser.displayName || rawUser.email || "User",
    nickname: String(rawUser.nickname || "").trim(),
    role: normalizeRole(rawUser.role),
  };
}

function readMockUsers() {
  if (typeof window === "undefined") return DEFAULT_USERS;
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return DEFAULT_USERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_USERS;
    const users = parsed.map(normalizeUser).filter(Boolean);
    return users.length > 0 ? users : DEFAULT_USERS;
  } catch (error) {
    console.warn("Failed to read users from localStorage.", error);
    return DEFAULT_USERS;
  }
}

function writeMockUsers(users) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

async function requestJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response
    .json()
    .catch(() => ({ error: `Request failed with status ${response.status}` }));

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

export async function fetchUsers({ query = "", authMode = "mock" } = {}) {
  if (authMode === "mock") {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const users = readMockUsers();
    const items = normalizedQuery
      ? users.filter((user) =>
          [user.name, user.email, user.id, user.role]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : users;
    return { items, total: items.length, page: 1, pageSize: items.length };
  }

  const params = new URLSearchParams();
  if (query) params.set("query", query);
  return requestJson(`/api/users${params.toString() ? `?${params.toString()}` : ""}`, {
    method: "GET",
  });
}

export async function updateUserRole({ userId, role, authMode = "mock" }) {
  const normalizedRole = normalizeRole(role);
  if (!userId) {
    throw new Error("userId は必須です。");
  }

  if (authMode === "mock") {
    const users = readMockUsers();
    const userExists = users.some((user) => user.id === String(userId));
    const nextUsers = userExists
      ? users.map((user) =>
          user.id === String(userId) ? { ...user, role: normalizedRole } : user
        )
      : [
          ...users,
          {
            id: String(userId),
            email: "",
            name: String(userId),
            role: normalizedRole,
          },
        ];
    writeMockUsers(nextUsers);
    return nextUsers.find((user) => user.id === String(userId));
  }

  const payload = await requestJson(`/api/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role: normalizedRole }),
  });
  return normalizeUser(payload.user || payload);
}

export async function resetUserNickname({ userId, authMode = "mock" }) {
  if (!userId) {
    throw new Error("userId は必須です。");
  }

  if (authMode === "mock") {
    const users = readMockUsers();
    const userExists = users.some((user) => user.id === String(userId));
    if (!userExists) {
      throw new Error("ユーザーが見つかりません。");
    }

    const nextUsers = users.map((user) =>
      user.id === String(userId) ? { ...user, nickname: "" } : user
    );
    writeMockUsers(nextUsers);
    return nextUsers.find((user) => user.id === String(userId));
  }

  const payload = await requestJson(`/api/users/${encodeURIComponent(userId)}/nickname`, {
    method: "DELETE",
  });
  return normalizeUser(payload.user || payload) || { id: String(userId), nickname: "" };
}
