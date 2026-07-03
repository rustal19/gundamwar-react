import React, { useEffect, useState } from "react";
import GoogleSignInPanel from "../components/GoogleSignInPanel";
import { useAuth, validateNickname } from "../context/AuthContext";
import "./Profile.css";

export default function Profile({ compact = false }) {
  const { isAuthenticated, isReady, updateProfile, user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname || "");
    setMessage("");
    setErrorMessage("");
  }, [user?.nickname]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateNickname(nickname);
    if (validationError) {
      setErrorMessage(validationError);
      setMessage("");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      await updateProfile({ nickname });
      setMessage("プロフィールを更新しました。");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
    return (
      <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
        <div className="profile-panel">読み込み中...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
        <section className="profile-panel">
          <h1>プロフィール</h1>
          <p className="profile-note">ログインするとニックネームを設定できます。</p>
          <GoogleSignInPanel />
        </section>
      </main>
    );
  }

  return (
    <main className={compact ? "profile-page profile-page-compact" : "profile-page"}>
      <section className="profile-panel">
        <div className="profile-heading">
          <div>
            <h1>プロフィール</h1>
            <p className="profile-note">公開表示に使うニックネームを変更できます。</p>
          </div>
          <div className="profile-current">
            <span>現在の表示名</span>
            <strong>{user?.nickname || "未設定"}</strong>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="profile-field" htmlFor="profile-nickname">
            <span>ニックネーム</span>
            <input
              id="profile-nickname"
              type="text"
              value={nickname}
              minLength={2}
              maxLength={20}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="2〜20文字"
            />
          </label>

          <div className="profile-private-info">
            <span>Googleアカウント名</span>
            <strong>{user?.name || "-"}</strong>
            <p>本人確認用です。公開デッキや大会参加者一覧には表示されません。</p>
          </div>

          {errorMessage ? <p className="profile-error">{errorMessage}</p> : null}
          {message ? <p className="profile-message">{message}</p> : null}

          <div className="profile-actions">
            <button type="submit" className="deck-primary-button" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
