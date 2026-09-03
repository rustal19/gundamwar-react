import React from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AppFooter from "./components/AppFooter";
import MobileAppHeader from "./components/MobileAppHeader";
import NicknameGate from "./components/NicknameGate";
import RouteAnalyticsTracker from "./components/RouteAnalyticsTracker";
import SearchForm from "./components/SearchForm";
import Sidebar from "./components/Sidebar";
import { hasSearchCriteria, parseSearchParams } from "./utils/searchResults";
import { AuthProvider } from "./context/AuthContext";
import { DeckProvider } from "./context/DeckContext";
import AdminUsers from "./pages/AdminUsers";
import DeckBuilder from "./pages/DeckBuilder";
import NotFound from "./pages/NotFound";
import PublicDeckDetail from "./pages/PublicDeckDetail";
import PublicDecks from "./pages/PublicDecks";
import Profile from "./pages/Profile";
import Privacy from "./pages/Privacy";
import PortalHome from "./pages/PortalHome";
import SearchResults from "./pages/SearchResults";
import Terms from "./pages/Terms";
import TournamentDetail from "./pages/TournamentDetail";
import TournamentDisplay from "./pages/TournamentDisplay";
import TournamentList from "./pages/TournamentList";
import TournamentManage from "./pages/TournamentManage";
import UserProfile from "./pages/UserProfile";
import { useLayoutTier } from "./utils/deviceLayout";
import "./mobile.css";

const AppContent = () => {
  const location = useLocation();
  // /deck(デッキ構築)だけに二カラム固定レイアウトを適用。
  // /decks(公開デッキ一覧)・/decks/:id(詳細)は通常のスクロールするレイアウトにする。
  const isDeckRoute = location.pathname === "/deck";
  const isDisplayRoute = /^\/tournaments\/[^/]+\/display$/.test(location.pathname);
  const isNarrowSidebarRoute = location.pathname === "/search" || location.pathname === "/deck";
  const { isCompactDesktop, isCompactLayout, isMobileOs, isIos, isAndroid } =
    useLayoutTier(location.search);
  // /search はフォームと結果を排他表示する。条件編集中はURLのクエリを保ったまま
  // フォームへ戻し、検索後は画面幅にかかわらず結果を先に表示する。
  const isSearchActive =
    location.pathname === "/search" &&
    hasSearchCriteria(parseSearchParams(location.search));
  const isSearchEditing = location.state?.searchEditing === true;
  const showSearchForm =
    location.pathname === "/search" && (!isSearchActive || isSearchEditing);

  if (isDisplayRoute) {
    return (
      <>
        <RouteAnalyticsTracker />
        <Routes>
          <Route path="/tournaments/:id/display" element={<TournamentDisplay />} />
        </Routes>
      </>
    );
  }

  const shellClassName = [
    "app-shell",
    isDeckRoute ? "app-shell-deck" : "",
    isNarrowSidebarRoute && !isCompactLayout ? "app-shell-sidebar-collapsed" : "",
    isCompactLayout ? "app-shell-mobile" : "",
    isCompactDesktop ? "app-shell-compact-desktop" : "",
    isMobileOs ? "app-shell-mobile-os" : "",
    isIos ? "app-shell-ios" : "",
    isAndroid ? "app-shell-android" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={shellClassName}>
        <RouteAnalyticsTracker />
        {isCompactLayout ? <MobileAppHeader /> : <Sidebar collapsed={isNarrowSidebarRoute} />}
        <main className="app-main">
          <NicknameGate />
          {showSearchForm ? (
            <SearchForm compact={isCompactLayout} />
          ) : null}
          <Routes>
            <Route path="/" element={<PortalHome compact={isCompactLayout} />} />
            <Route
              path="/search"
              element={showSearchForm ? null : <SearchResults compact={isCompactLayout} />}
            />
            <Route path="/deck" element={<DeckBuilder compact={isCompactLayout} />} />
            <Route path="/decks" element={<PublicDecks compact={isCompactLayout} />} />
            <Route path="/decks/:id" element={<PublicDeckDetail compact={isCompactLayout} />} />
            <Route path="/tournaments" element={<TournamentList compact={isCompactLayout} />} />
            <Route path="/tournaments/new" element={<TournamentManage compact={isCompactLayout} />} />
            <Route path="/tournaments/:id" element={<TournamentDetail compact={isCompactLayout} />} />
            <Route path="/tournaments/:id/display" element={<TournamentDisplay />} />
            <Route path="/tournaments/:id/manage" element={<TournamentManage compact={isCompactLayout} />} />
            <Route path="/admin/users" element={<AdminUsers compact={isCompactLayout} />} />
            <Route path="/profile" element={<Profile compact={isCompactLayout} />} />
            <Route path="/users/:id" element={<UserProfile compact={isCompactLayout} />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <AppFooter />
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <DeckProvider>
        <AppContent />
      </DeckProvider>
    </AuthProvider>
  );
};

export default App;
