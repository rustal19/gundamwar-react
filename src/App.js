import React from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import MobileAppHeader from "./components/MobileAppHeader";
import NicknameGate from "./components/NicknameGate";
import RouteAnalyticsTracker from "./components/RouteAnalyticsTracker";
import SearchForm from "./components/SearchForm";
import { AuthProvider } from "./context/AuthContext";
import { DeckProvider } from "./context/DeckContext";
import AdminUsers from "./pages/AdminUsers";
import DeckBuilder from "./pages/DeckBuilder";
import PublicDeckDetail from "./pages/PublicDeckDetail";
import PublicDecks from "./pages/PublicDecks";
import Profile from "./pages/Profile";
import Privacy from "./pages/Privacy";
import PortalHome from "./pages/PortalHome";
import SearchResults from "./pages/SearchResults";
import Terms from "./pages/Terms";
import TournamentDetail from "./pages/TournamentDetail";
import TournamentList from "./pages/TournamentList";
import TournamentManage from "./pages/TournamentManage";
import { useLayoutTier } from "./utils/deviceLayout";
import "./mobile.css";

const AppContent = () => {
  const location = useLocation();
  const isDeckRoute = location.pathname.startsWith("/deck");
  const { isCompactDesktop, isCompactLayout, isMobileOs, isIos, isAndroid } =
    useLayoutTier(location.search);

  const shellClassName = [
    "app-shell",
    isDeckRoute ? "app-shell-deck" : "",
    isCompactLayout ? "app-shell-mobile" : "",
    isCompactDesktop ? "app-shell-compact-desktop" : "",
    isMobileOs ? "app-shell-mobile-os" : "",
    isIos ? "app-shell-ios" : "",
    isAndroid ? "app-shell-android" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const HeaderComponent = isCompactLayout ? MobileAppHeader : AppHeader;

  return (
    <>
      <div className={shellClassName}>
        <RouteAnalyticsTracker />
        <HeaderComponent />
        <NicknameGate />
        {location.pathname === "/search" ? <SearchForm compact={isCompactLayout} /> : null}
        <Routes>
          <Route path="/" element={<PortalHome compact={isCompactLayout} />} />
          <Route path="/search" element={<SearchResults compact={isCompactLayout} />} />
          <Route path="/deck" element={<DeckBuilder compact={isCompactLayout} />} />
          <Route path="/decks" element={<PublicDecks compact={isCompactLayout} />} />
          <Route path="/decks/:id" element={<PublicDeckDetail compact={isCompactLayout} />} />
          <Route path="/tournaments" element={<TournamentList compact={isCompactLayout} />} />
          <Route path="/tournaments/new" element={<TournamentManage compact={isCompactLayout} />} />
          <Route path="/tournaments/:id" element={<TournamentDetail compact={isCompactLayout} />} />
          <Route path="/tournaments/:id/manage" element={<TournamentManage compact={isCompactLayout} />} />
          <Route path="/admin/users" element={<AdminUsers compact={isCompactLayout} />} />
          <Route path="/profile" element={<Profile compact={isCompactLayout} />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
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
