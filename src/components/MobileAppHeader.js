import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import GoogleSignInPanel from "./GoogleSignInPanel";
import "./AppHeader.css";

export default function MobileAppHeader() {
  const location = useLocation();
  const { authMode, canUseGoogleAuth, isAuthenticated, signOut, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const homePath = useMemo(
    () => buildPathWithForcedMobileLayout("/", location.search),
    [location.search]
  );
  const decksPath = useMemo(
    () => buildPathWithForcedMobileLayout("/decks", location.search),
    [location.search]
  );
  const tournamentsPath = useMemo(
    () => buildPathWithForcedMobileLayout("/tournaments", location.search),
    [location.search]
  );
  const deckPath = useMemo(
    () => buildPathWithForcedMobileLayout("/deck", location.search),
    [location.search]
  );

  const navItems = [
    { to: homePath, matchPath: "/", label: "検索" },
    { to: decksPath, matchPath: "/decks", label: "公開デッキ" },
    { to: tournamentsPath, matchPath: "/tournaments", label: "大会" },
    { to: deckPath, matchPath: "/deck", exact: true, label: "デッキ構築(β版)" },
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const headerClassName = menuOpen ? "app-header app-header-menu-active" : "app-header";
  const menuClassName = menuOpen ? "app-header-menu app-header-menu-open" : "app-header-menu";

  return (
    <header className={headerClassName}>
      <div className="app-header-inner">
        <div className="app-header-topbar">
          <div className="app-brand">
            <Link to={homePath} className="app-brand-link">
              Gundam War Database
            </Link>
          </div>

          <button
            type="button"
            className={menuOpen ? "app-mobile-menu-toggle active" : "app-mobile-menu-toggle"}
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={menuClassName}>
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
      </div>
    </header>
  );
}
