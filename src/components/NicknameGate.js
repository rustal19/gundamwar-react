import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth, validateNickname } from "../context/AuthContext";
import "./NicknameGate.css";

function NicknameModal({ open, allowCancel = false, onCancel, onResolved }) {
  const { updateProfile, user } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNickname(user?.nickname || "");
    setErrorMessage("");
  }, [open, user?.nickname]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateNickname(nickname);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      await updateProfile({ nickname });
      onResolved?.();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="nickname-gate-overlay" role="presentation">
      <form
        className="nickname-gate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-gate-title"
        onSubmit={handleSubmit}
      >
        <div className="nickname-gate-header">
          <h3 id="nickname-gate-title">ニックネーム登録</h3>
          <p>
            公開デッキや大会参加者一覧では、このニックネームだけが表示されます。
          </p>
        </div>

        <label className="nickname-gate-field" htmlFor="nickname-gate-input">
          <span>ニックネーム</span>
          <input
            id="nickname-gate-input"
            type="text"
            value={nickname}
            minLength={2}
            maxLength={20}
            autoFocus
            onChange={(event) => setNickname(event.target.value)}
            placeholder="2〜20文字"
          />
        </label>

        {errorMessage ? <p className="nickname-gate-error">{errorMessage}</p> : null}

        <div className="nickname-gate-actions">
          {allowCancel ? (
            <button
              type="button"
              className="deck-secondary-button"
              onClick={onCancel}
              disabled={isSaving}
            >
              キャンセル
            </button>
          ) : null}
          <button type="submit" className="deck-primary-button" disabled={isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function useNicknameGuard() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const needsNickname = Boolean(isAuthenticated && !user?.nickname);

  const guardNickname = useCallback(
    (next) => {
      if (needsNickname) {
        setOpen(true);
        return false;
      }
      if (typeof next === "function") {
        next();
      }
      return true;
    },
    [needsNickname]
  );

  const NicknameGuardDialog = useCallback(
    () => (
      <NicknameModal
        open={open}
        allowCancel
        onCancel={() => setOpen(false)}
        onResolved={() => setOpen(false)}
      />
    ),
    [open]
  );

  return {
    needsNickname,
    guardNickname,
    openNicknameGate: () => setOpen(true),
    NicknameGuardDialog,
  };
}

// 規約・ポリシーは「同意の前提として読めること」が必要なので、
// 閉じられないニックネーム登録で塞いではいけない。
const NICKNAME_GATE_EXEMPT_PATHS = ["/terms", "/privacy"];

export default function NicknameGate() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isExemptPath = NICKNAME_GATE_EXEMPT_PATHS.includes(location.pathname);
  const shouldOpen = Boolean(isAuthenticated && !user?.nickname && !isExemptPath);

  return <NicknameModal open={shouldOpen} allowCancel={false} />;
}
