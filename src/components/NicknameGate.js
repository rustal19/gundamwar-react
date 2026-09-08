import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth, validateNickname } from "../context/AuthContext";
import "./NicknameGate.css";

function NicknameModal({ open, allowCancel = false, onCancel, onResolved }) {
  const { updateProfile, user } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setNickname(user?.nickname || "");
    setErrorMessage("");
  }, [open, user?.nickname]);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedElementRef.current = document.activeElement;
    inputRef.current?.focus();

    return () => {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const getFocusableElements = () => {
      const dialog = dialogRef.current;
      if (!dialog) return [];

      return Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
    };

    const focusInsideDialog = (preferLast = false) => {
      const focusableElements = getFocusableElements();
      const target = preferLast
        ? focusableElements[focusableElements.length - 1]
        : focusableElements[0];
      (target || dialogRef.current)?.focus();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        // 必須ゲートの迂回と、保存中のキャンセルを許可しない。
        event.preventDefault();
        event.stopPropagation();
        if (allowCancel && !isSaving) {
          onCancel?.();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        !dialogRef.current?.contains(activeElement) ||
        !focusableElements.includes(activeElement)
      ) {
        event.preventDefault();
        focusInsideDialog(event.shiftKey);
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const handleFocusIn = (event) => {
      if (!dialogRef.current?.contains(event.target)) {
        focusInsideDialog();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [allowCancel, isSaving, onCancel, open]);

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
        ref={dialogRef}
        className="nickname-gate-dialog"
        role="dialog"
        tabIndex={-1}
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
            ref={inputRef}
            id="nickname-gate-input"
            type="text"
            value={nickname}
            minLength={2}
            maxLength={20}
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
