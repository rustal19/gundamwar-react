import React from "react";
import { Link } from "react-router-dom";
import "./AppFooter.css";

const AppFooter = () => {
  return (
    <footer className="app-footer">
      <nav className="app-footer-links" aria-label="サイト情報">
        <Link to="/terms">利用規約</Link>
        <Link to="/privacy">プライバシーポリシー</Link>
      </nav>
      <p>本サイトは非公式ファンサイトです。ガンダムは創通・サンライズの登録商標です。</p>
    </footer>
  );
};

export default AppFooter;
