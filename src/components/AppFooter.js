import React from "react";
import { Link, useLocation } from "react-router-dom";
import { buildPathWithForcedMobileLayout } from "../utils/deviceLayout";
import "./AppFooter.css";

const AppFooter = () => {
  const location = useLocation();

  return (
    <footer className="app-footer">
      <div className="app-footer-row">
        <strong className="app-footer-brand">Gundam War Portal</strong>
        <nav className="app-footer-links" aria-label="サイト情報">
          <Link to={buildPathWithForcedMobileLayout("/terms", location.search)}>利用規約</Link>
          <Link to={buildPathWithForcedMobileLayout("/privacy", location.search)}>
            プライバシーポリシー
          </Link>
        </nav>
      </div>
      <p>本サイトは非公式ファンサイトです。ガンダムは創通・サンライズの登録商標です。</p>
    </footer>
  );
};

export default AppFooter;
