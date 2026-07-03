import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInPanel from "./GoogleSignInPanel";
import "./AppHeader.css";

export default function AppHeader() {
  const location = useLocation();
  const { authMode, canUseGoogleAuth, displayNickname, isAuthenticated, signOut, user } =
    useAuth();

  const navItems = [
    { to: "/", matchPath: "/", label: "検索" },
    { to: "/deck", matchPath: "/deck", exact: true, label: "デッキ構築(β版)" },
    { to: "/decks", matchPath: "/decks", label: "公開デッキ" },
  ];

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-main">
          <div className="app-brand">
            <Link to="/" className="app-brand-link">
              Gundam War Database
            </Link>
          </div>

          <nav className="app-nav" aria-label="Primary">
            {navItems.map((item) => {
              const isActive =
                item.matchPath === "/"
                  ? location.pathname === "/"
                  : item.exact
                  ? location.pathname === item.matchPath
                  : location.pathname.startsWith(item.matchPath);

              return (
                <Link
                  key={item.matchPath}
                  to={item.to}
                  className={isActive ? "app-nav-link active" : "app-nav-link"}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="app-auth">
          {isAuthenticated ? (
            <>
              <div className="app-auth-status">
                <span className="app-auth-label">ログイン中</span>
                <strong>{displayNickname || user?.name || "-"}</strong>
              </div>
              <Link className="app-auth-button" to="/profile">
                プロフィール
              </Link>
              <button className="app-auth-button" onClick={signOut}>
                ログアウト
              </button>
            </>
          ) : authMode === "google" && canUseGoogleAuth ? (
            <>
              <div className="app-auth-status">
                <span className="app-auth-label">未ログイン</span>
                <strong>-</strong>
              </div>
              <GoogleSignInPanel variant="header" />
            </>
          ) : (
            <GoogleSignInPanel variant="header" />
          )}
        </div>
      </div>
    </header>
  );
}
