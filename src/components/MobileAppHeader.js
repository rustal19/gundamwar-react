import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import Sidebar from "./Sidebar";
import "./AppHeader.css";

export default function MobileAppHeader() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const homePath = useMemo(
    () => buildPathWithForcedMobileLayout("/", location.search),
    [location.search]
  );

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  return (
    <>
      <header className="mobile-app-bar">
        <Link to={homePath} className="mobile-app-brand">
          Gundam War Portal
        </Link>
        <button
          type="button"
          className={drawerOpen ? "mobile-menu-toggle active" : "mobile-menu-toggle"}
          aria-label={drawerOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={drawerOpen}
          aria-controls="mobile-navigation-drawer"
          onClick={() => setDrawerOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      {drawerOpen ? (
        <div className="mobile-drawer-layer" id="mobile-navigation-drawer">
          <Sidebar drawer onNavigate={() => setDrawerOpen(false)} />
          <button
            type="button"
            className="mobile-drawer-backdrop"
            aria-label="メニューを閉じる"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
