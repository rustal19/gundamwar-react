import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-panel">
        <p className="not-found-eyebrow">404</p>
        <h1>ページが見つかりません</h1>
        <p>指定されたページは削除されたか、URL が間違っている可能性があります。</p>
        <div className="not-found-actions">
          <Link className="results-link-button primary" to="/">
            トップへ
          </Link>
          <Link className="results-link-button" to="/search">
            カード検索へ
          </Link>
        </div>
      </section>
    </main>
  );
}
