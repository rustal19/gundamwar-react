import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import {
  CardsIcon,
  CirclePlusIcon,
  HomeIcon,
  LoginIcon,
  LogoutIcon,
  SearchIcon,
  StackIcon,
  TrophyIcon,
  UserCogIcon,
  UserIcon,
} from "./icons";
import "./AppHeader.css";

const NAV_ITEMS = [
  { key: "home", path: "/", matchPath: "/", exact: true, label: "ホーム", Icon: HomeIcon },
  { key: "search", path: "/search", matchPath: "/search", exact: true, label: "カード検索", Icon: SearchIcon },
  { key: "deck", path: "/deck", matchPath: "/deck", exact: true, label: "デッキ構築", Icon: StackIcon },
  { key: "decks", path: "/decks", matchPath: "/decks", label: "公開デッキ", Icon: CardsIcon },
  { key: "tournaments", path: "/tournaments", matchPath: "/tournaments", label: "大会", Icon: TrophyIcon },
];

function isActivePath(locationPath, item) {
  return item.exact ? locationPath === item.matchPath : locationPath.startsWith(item.matchPath);
}

function getInitial(name) {
  const source = String(name || "").trim();
  return source ? source.slice(0, 1).toUpperCase() : "U";
}

export default function Sidebar({ collapsed = false, drawer = false, onNavigate }) {
  const location = useLocation();
  const {
    authMode,
    canUseGoogleAuth,
    displayNickname,
    isAdmin,
    isAuthenticated,
    isOrganizer,
    signInWithMock,
    signOut,
    user,
  } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const paths = useMemo(
    () => ({
      home: buildPathWithForcedMobileLayout("/", location.search),
      search: buildPathWithForcedMobileLayout("/search", location.search),
      deck: buildPathWithForcedMobileLayout("/deck", location.search),
      decks: buildPathWithForcedMobileLayout("/decks", location.search),
      tournaments: buildPathWithForcedMobileLayout("/tournaments", location.search),
      newTournament: buildPathWithForcedMobileLayout("/tournaments/new", location.search),
      adminUsers: buildPathWithForcedMobileLayout("/admin/users", location.search),
      profile: buildPathWithForcedMobileLayout("/profile", location.search),
    }),
    [location.search]
  );

  const nickname = displayNickname || user?.nickname || user?.name || "ユーザー";
  const showOrganizerMenu = isAuthenticated && isOrganizer;
  const rootClassName = [
    "gw-sidebar",
    collapsed ? "gw-sidebar-collapsed" : "",
    drawer ? "gw-sidebar-drawer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleNavigate = () => {
    setUserMenuOpen(false);
    if (onNavigate) onNavigate();
  };

  const handleLogin = () => {
    if (authMode === "mock") {
      signInWithMock("user");
    }
  };

  const handleSignOut = () => {
    setUserMenuOpen(false);
    signOut();
    if (onNavigate) onNavigate();
  };

  return (
    <aside className={rootClassName} aria-label="サイトナビゲーション">
      <Link to={paths.home} className="gw-sidebar-brand" onClick={handleNavigate}>
        <span className="gw-sidebar-brand-title">Gundam War Portal</span>
        <span className="gw-sidebar-brand-subtitle">ガンダムウォー非公式ポータル</span>
      </Link>

      <nav className="gw-sidebar-nav" aria-label="メインナビゲーション">
        {NAV_ITEMS.map(({ key, path, label, Icon, ...item }) => {
          const isActive = isActivePath(location.pathname, item);
          return (
            <Link
              key={key}
              to={paths[key] || buildPathWithForcedMobileLayout(path, location.search)}
              className={isActive ? "gw-sidebar-link active" : "gw-sidebar-link"}
              title={collapsed ? label : undefined}
              onClick={handleNavigate}
            >
              <Icon />
              <span className={collapsed ? "gw-sidebar-link-label sr-only" : "gw-sidebar-link-label"}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {showOrganizerMenu ? (
        <section className="gw-sidebar-section" aria-label="運営メニュー">
          <h2 className="gw-sidebar-section-title">運営メニュー</h2>
          <Link
            to={paths.newTournament}
            className={
              location.pathname === "/tournaments/new"
                ? "gw-sidebar-link gw-sidebar-link-secondary active"
                : "gw-sidebar-link gw-sidebar-link-secondary"
            }
            title={collapsed ? "大会を作成" : undefined}
            onClick={handleNavigate}
          >
            <CirclePlusIcon />
            <span className={collapsed ? "gw-sidebar-link-label sr-only" : "gw-sidebar-link-label"}>
              大会を作成
            </span>
          </Link>
          {isAdmin ? (
            <Link
              to={paths.adminUsers}
              className={
                location.pathname.startsWith("/admin/users")
                  ? "gw-sidebar-link gw-sidebar-link-secondary active"
                  : "gw-sidebar-link gw-sidebar-link-secondary"
              }
              title={collapsed ? "権限管理" : undefined}
              onClick={handleNavigate}
            >
              <UserCogIcon />
              <span className={collapsed ? "gw-sidebar-link-label sr-only" : "gw-sidebar-link-label"}>
                権限管理
              </span>
            </Link>
          ) : null}
        </section>
      ) : null}

      <div className="gw-sidebar-user">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              className="gw-sidebar-user-button"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              onClick={() => setUserMenuOpen((current) => !current)}
            >
              <span className="gw-sidebar-avatar" aria-hidden="true">
                {getInitial(nickname)}
              </span>
              <span className={collapsed ? "gw-sidebar-user-name sr-only" : "gw-sidebar-user-name"}>
                {nickname}
              </span>
            </button>
            {userMenuOpen ? (
              <div className="gw-sidebar-user-menu" role="menu">
                <Link to={paths.profile} role="menuitem" onClick={handleNavigate}>
                  <UserIcon />
                  プロフィール
                </Link>
                <button type="button" role="menuitem" onClick={handleSignOut}>
                  <LogoutIcon />
                  ログアウト
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="gw-sidebar-login-button"
            onClick={handleLogin}
            disabled={authMode !== "mock" && !canUseGoogleAuth}
            title={collapsed ? "ログイン" : undefined}
          >
            <LoginIcon />
            <span className={collapsed ? "sr-only" : ""}>ログイン</span>
          </button>
        )}
      </div>
    </aside>
  );
}
