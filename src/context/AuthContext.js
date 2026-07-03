import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { trackEvent } from "../utils/analytics";

const ENV_GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const IS_LOCALHOST =
  typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
const MOCK_ENABLED =
  process.env.REACT_APP_ENABLE_LOCAL_AUTH_MOCK === "true" ||
  (typeof window !== "undefined" && !ENV_GOOGLE_CLIENT_ID && IS_LOCALHOST);

const AuthContext = createContext(null);
const VALID_ROLES = new Set(["user", "organizer", "admin"]);
const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 20;

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function normalizeUser(rawUser) {
  if (!rawUser) return null;
  const id = rawUser.googleSub || rawUser.sub || rawUser.id || rawUser.userId;
  if (!id) return null;
  const role = VALID_ROLES.has(rawUser.role) ? rawUser.role : "user";
  const nickname = String(rawUser.nickname || "").trim();

  return {
    id: String(id),
    email: rawUser.email || "",
    name: rawUser.name || rawUser.displayName || rawUser.email || "Google User",
    avatarUrl: rawUser.avatarUrl || rawUser.picture || "",
    role,
    nickname,
    displayNickname: nickname,
  };
}

export function normalizeNickname(value) {
  return String(value || "").trim();
}

export function validateNickname(value) {
  const nickname = normalizeNickname(value);
  if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
    return `ニックネームは${NICKNAME_MIN_LENGTH}〜${NICKNAME_MAX_LENGTH}文字で入力してください。`;
  }
  return "";
}

function readMockUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_USER_KEY);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to read mock auth state.", error);
    return null;
  }
}

function writeMockUser(user) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(MOCK_USER_KEY);
    return;
  }
  window.localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
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

export function AuthProvider({ children }) {
  const [googleClientId, setGoogleClientId] = useState(() => ENV_GOOGLE_CLIENT_ID);
  const [user, setUser] = useState(() => (MOCK_ENABLED ? readMockUser() : null));
  const [isReady, setIsReady] = useState(MOCK_ENABLED && !ENV_GOOGLE_CLIENT_ID);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");

  const authMode = googleClientId ? "google" : MOCK_ENABLED ? "mock" : "disabled";
  const canUseGoogleAuth = authMode === "google";
  const authConfigState =
    authMode === "mock" ? "mock" : canUseGoogleAuth ? "ready" : "missing_google_client_id";

  const loadAuthConfig = useCallback(async () => {
    if (ENV_GOOGLE_CLIENT_ID) {
      setGoogleClientId(ENV_GOOGLE_CLIENT_ID);
      return ENV_GOOGLE_CLIENT_ID;
    }

    try {
      const payload = await requestJson("/api/auth/config", { method: "GET" });
      const nextGoogleClientId = String(payload?.googleClientId || "").trim();
      setGoogleClientId(nextGoogleClientId);
      return nextGoogleClientId;
    } catch (error) {
      setGoogleClientId("");
      return "";
    }
  }, []);

  const loadSession = useCallback(async () => {
    setIsReady(false);

    const configuredGoogleClientId = await loadAuthConfig();
    const effectiveAuthMode = configuredGoogleClientId
      ? "google"
      : MOCK_ENABLED
        ? "mock"
        : "disabled";

    if (effectiveAuthMode === "mock") {
      setUser(readMockUser());
      setAuthError("");
      setIsReady(true);
      return;
    }

    if (effectiveAuthMode !== "google") {
      setUser(null);
      setAuthError("");
      setIsReady(true);
      return;
    }

    try {
      const payload = await requestJson("/api/auth/session", {
        method: "GET",
      });
      setUser(normalizeUser(payload.user));
      setAuthError("");
    } catch (error) {
      setUser(null);
      setAuthError("");
    } finally {
      setIsReady(true);
    }
  }, [loadAuthConfig]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signInWithGoogleCredential = useCallback(
    async (credential) => {
      if (authMode !== "google" || !canUseGoogleAuth) {
        throw new Error("現在この環境では Google ログインを利用できません。");
      }

      setIsAuthenticating(true);
      setAuthError("");
      try {
        const payload = await requestJson("/api/auth/google", {
          method: "POST",
          body: JSON.stringify({ credential }),
        });
        setUser(normalizeUser(payload.user));
        trackEvent("login", {
          method: "google",
        });
      } catch (error) {
        setAuthError(error.message);
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [authMode, canUseGoogleAuth]
  );

  const signInWithMock = useCallback(async (role = "user") => {
    const mockUser = normalizeUser({
      id: "local-demo-user",
      email: "local-demo@gundamwar.test",
      name: "ローカル確認ユーザー",
      avatarUrl: "",
      role,
    });
    writeMockUser(mockUser);
    setUser(mockUser);
    setAuthError("");
    setIsReady(true);
    trackEvent("login", {
      method: "local_mock",
    });
  }, []);

  const signOut = useCallback(async () => {
    if (authMode === "mock") {
      writeMockUser(null);
      setUser(null);
      trackEvent("logout", {
        method: "local_mock",
      });
      return;
    }

    if (authMode !== "google") return;

    try {
      await requestJson("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      trackEvent("logout", {
        method: "google",
      });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setUser(null);
    }
  }, [authMode]);

  const updateProfile = useCallback(
    async ({ nickname }) => {
      if (!user?.id) {
        throw new Error("ログインしてからプロフィールを変更してください。");
      }

      const nextNickname = normalizeNickname(nickname);
      const validationError = validateNickname(nextNickname);
      if (validationError) {
        throw new Error(validationError);
      }

      if (authMode === "mock") {
        const nextUser = normalizeUser({
          ...user,
          nickname: nextNickname,
        });
        writeMockUser(nextUser);
        setUser(nextUser);
        return nextUser;
      }

      const payload = await requestJson("/api/users/me/profile", {
        method: "PUT",
        body: JSON.stringify({ nickname: nextNickname }),
      });
      const nextUser = normalizeUser(payload.user || payload);
      setUser(nextUser);
      return nextUser;
    },
    [authMode, user]
  );

  const value = useMemo(
    () => ({
      user,
      isReady,
      isAuthenticating,
      isAuthenticated: Boolean(user),
      isOrganizer: user?.role === "organizer" || user?.role === "admin",
      isAdmin: user?.role === "admin",
      displayNickname: user?.displayNickname || user?.nickname || "",
      authError,
      authMode,
      authConfigState,
      canUseGoogleAuth,
      googleClientId,
      apiBaseUrl: API_BASE_URL,
      signInWithGoogleCredential,
      signInWithMock,
      signOut,
      updateProfile,
      refreshSession: loadSession,
    }),
    [
      user,
      isReady,
      isAuthenticating,
      authError,
      authMode,
      authConfigState,
      canUseGoogleAuth,
      googleClientId,
      signInWithGoogleCredential,
      signInWithMock,
      signOut,
      updateProfile,
      loadSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
