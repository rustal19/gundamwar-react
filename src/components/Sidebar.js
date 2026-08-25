import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import GoogleSignInPanel from "./GoogleSignInPanel";
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
  const sidebarRef = useRef(null);
  const {
    displayNickname,
    isAdmin,
    isAuthenticated,
    isOrganizer,
    signOut,
    user,
  } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pointerExpansionActive, setPointerExpansionActive] = useState(false);
  const [focusExpansionActive, setFocusExpansionActive] = useState(false);

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
    collapsed && (pointerExpansionActive || focusExpansionActive)
      ? "gw-sidebar-temporarily-expanded"
      : "",
    drawer ? "gw-sidebar-drawer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleNavigate = () => {
    setUserMenuOpen(false);
    if (onNavigate) onNavigate();
  };

  useEffect(() => {
    if (isAuthenticated) {
      setUserMenuOpen(false);
    }
  }, [isAuthenticated]);

  useLayoutEffect(() => {
    setPointerExpansionActive(false);
    setFocusExpansionActive(false);
    if (!collapsed) return;

    // 縮小対象ページへの遷移時は、遷移元リンクに残るフォーカスを解除する。
    // ポインター展開も上で一度閉じるため、リンク上にカーソルが残っていても縮小される。
    const focusedElement = document.activeElement;
    if (
      sidebarRef.current?.contains(focusedElement) &&
      typeof focusedElement?.blur === "function"
    ) {
      focusedElement.blur();
    }
  }, [collapsed, location.pathname]);

  const handlePointerEnter = () => {
    if (collapsed) setPointerExpansionActive(true);
  };

  const handlePointerLeave = () => {
    if (collapsed) setPointerExpansionActive(false);
  };

  const handleFocus = () => {
    if (collapsed) setFocusExpansionActive(true);
  };

  const handleBlur = (event) => {
    if (collapsed && !event.currentTarget.contains(event.relatedTarget)) {
      setFocusExpansionActive(false);
    }
  };

  const handleSignOut = () => {
    setUserMenuOpen(false);
    signOut();
    if (onNavigate) onNavigate();
  };

  return (
    <aside
      ref={sidebarRef}
      className={rootClassName}
      aria-label="サイトナビゲーション"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
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
          <>
          <button
            type="button"
            className="gw-sidebar-login-button"
            aria-expanded={userMenuOpen}
            aria-haspopup="dialog"
            onClick={() => setUserMenuOpen((current) => !current)}
            title={collapsed ? "ログイン" : undefined}
          >
            <LoginIcon />
            <span className={collapsed ? "sr-only" : ""}>ログイン</span>
          </button>
          {userMenuOpen ? (
            <div className="gw-sidebar-user-menu gw-sidebar-login-menu" role="dialog">
              <GoogleSignInPanel variant="header" />
            </div>
          ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
