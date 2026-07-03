import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./GoogleSignInPanel.css";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Browser environment is unavailable."));
      return;
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing && window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google script failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Google script failed to load."));
    document.body.appendChild(script);
  });
}

export default function GoogleSignInPanel({ variant = "default" }) {
  const buttonRef = useRef(null);
  const [loadError, setLoadError] = useState("");
  const [mockRole, setMockRole] = useState("user");
  const {
    authMode,
    authConfigState,
    authError,
    canUseGoogleAuth,
    googleClientId,
    isAuthenticating,
    signInWithGoogleCredential,
    signInWithMock,
  } = useAuth();

  const isHeaderVariant = variant === "header";
  const rootClassName = isHeaderVariant
    ? "google-signin-panel google-signin-panel-header"
    : "google-signin-panel";
  const headerButtonWidth =
    isHeaderVariant && typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches
      ? 156
      : 184;

  useEffect(() => {
    const buttonElement = buttonRef.current;

    if (authMode !== "google" || !canUseGoogleAuth || !googleClientId || !buttonElement) {
      return undefined;
    }

    let cancelled = false;
    buttonElement.innerHTML = "";
    setLoadError("");

    loadGoogleScript()
      .then((google) => {
        if (cancelled || !buttonElement || !google?.accounts?.id) return;

        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response?.credential) return;
            try {
              await signInWithGoogleCredential(response.credential);
            } catch (error) {
              console.error("Google sign-in failed.", error);
            }
          },
        });

        google.accounts.id.renderButton(buttonElement, {
          theme: "outline",
          size: isHeaderVariant ? "medium" : "large",
          shape: "rectangular",
          text: "signin_with",
          logo_alignment: "left",
          width: isHeaderVariant ? headerButtonWidth : 260,
        });
      })
      .catch((error) => {
        setLoadError(error.message);
      });

    return () => {
      cancelled = true;
      if (buttonElement) {
        buttonElement.innerHTML = "";
      }
    };
  }, [
    authMode,
    canUseGoogleAuth,
    googleClientId,
    headerButtonWidth,
    isHeaderVariant,
    signInWithGoogleCredential,
  ]);

  if (authMode === "mock") {
    return (
      <div className={rootClassName}>
        <label className="google-mock-role-field">
          <span>Role</span>
          <select value={mockRole} onChange={(event) => setMockRole(event.target.value)}>
            <option value="user">user</option>
            <option value="organizer">organizer</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button className="google-mock-button" onClick={() => signInWithMock(mockRole)}>
          ローカルログイン
        </button>
        {!isHeaderVariant ? (
          <p className="google-signin-note">
            localhost ではモック認証で保存フローを確認できます。
          </p>
        ) : null}
      </div>
    );
  }

  if (authMode === "disabled" || !canUseGoogleAuth) {
    return (
      <div className={rootClassName}>
        <p className="google-signin-status">
          {authConfigState === "missing_google_client_id"
            ? "Google ログインは準備中です。"
            : "ログイン設定を確認しています。"}
        </p>
        {!isHeaderVariant ? (
          <p className="google-signin-note">設定が整い次第、この画面からログインできます。</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div ref={buttonRef} />
      {!isHeaderVariant && !isAuthenticating && !loadError && !authError ? (
        <p className="google-signin-note">Google ログインでデッキの保存と読み込みを利用できます。</p>
      ) : null}
      {!isHeaderVariant && isAuthenticating ? (
        <p className="google-signin-note">ログイン処理中です...</p>
      ) : null}
      {loadError || authError ? <p className="google-signin-error">{loadError || authError}</p> : null}
    </div>
  );
}
