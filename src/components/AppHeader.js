import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInPanel from "./GoogleSignInPanel";
import "./AppHeader.css";

export default function AppHeader() {
  const location = useLocation();
  const { authMode, canUseGoogleAuth, isAuthenticated, signOut, user } = useAuth();

  const navItems = [
    { to: "/", label: "検索" },
    { to: "/deck", label: "デッキ構築(β版)" },
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
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
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
                <strong>{user?.name || "-"}</strong>
              </div>
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
