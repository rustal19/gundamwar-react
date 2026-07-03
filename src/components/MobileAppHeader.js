import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import GoogleSignInPanel from "./GoogleSignInPanel";
import "./AppHeader.css";

export default function MobileAppHeader() {
  const location = useLocation();
  const { authMode, canUseGoogleAuth, displayNickname, isAuthenticated, signOut, user } =
    useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const paths = useMemo(
    () => ({
      home: buildPathWithForcedMobileLayout("/", location.search),
      search: buildPathWithForcedMobileLayout("/search", location.search),
      decks: buildPathWithForcedMobileLayout("/decks", location.search),
      tournaments: buildPathWithForcedMobileLayout("/tournaments", location.search),
      deck: buildPathWithForcedMobileLayout("/deck", location.search),
      profile: buildPathWithForcedMobileLayout("/profile", location.search),
    }),
    [location.search]
  );

  const navItems = [
    { to: paths.search, matchPath: "/search", exact: true, label: "検索" },
    { to: paths.decks, matchPath: "/decks", label: "公開デッキ" },
    { to: paths.tournaments, matchPath: "/tournaments", label: "大会" },
    { to: paths.deck, matchPath: "/deck", exact: true, label: "デッキ構築(β版)" },
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
            <Link to={paths.home} className="app-brand-link">
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
              const isActive = item.exact
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
                  <strong>{displayNickname || user?.name || "-"}</strong>
                </div>
                <Link className="app-auth-button" to={paths.profile}>
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
      </div>
    </header>
  );
}
