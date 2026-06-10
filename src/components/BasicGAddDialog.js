import React, { useEffect, useMemo, useState } from "react";
import {
  BASIC_G_COLORS,
  getBasicGDefaultSelection,
  getBasicGImageOption,
  getBasicGImageOptions,
} from "../utils/basicG";
import { getThumbnailPath } from "../utils/cardImages";
import "./BasicGAddDialog.css";

function buildEmptyCounts() {
  return BASIC_G_COLORS.reduce((state, color) => {
    state[color.key] = 0;
    return state;
  }, {});
}

function clampCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(99, Math.floor(parsed));
}

function normalizeSelection(selection) {
  const defaults = getBasicGDefaultSelection();
  return BASIC_G_COLORS.reduce((state, color) => {
    const selectedOption = getBasicGImageOption(color.key, selection?.[color.key]);
    state[color.key] = selectedOption?.index || defaults[color.key] || 1;
    return state;
  }, {});
}

function buildDialogClassName(baseClassName, mobile) {
  return mobile ? `${baseClassName} ${baseClassName}-mobile` : baseClassName;
}

export default function BasicGAddDialog({ open, onClose, onAdd, mobile = false }) {
  const defaultSelection = useMemo(() => normalizeSelection(getBasicGDefaultSelection()), []);
  const [counts, setCounts] = useState(buildEmptyCounts);
  const [selectedArtByColor, setSelectedArtByColor] = useState(defaultSelection);
  const [isArtDialogOpen, setIsArtDialogOpen] = useState(false);
  const [activeArtTab, setActiveArtTab] = useState(BASIC_G_COLORS[0].key);
  const [draftArtByColor, setDraftArtByColor] = useState(defaultSelection);

  useEffect(() => {
    if (open) {
      setCounts(buildEmptyCounts());
      setActiveArtTab(BASIC_G_COLORS[0].key);
    } else {
      setIsArtDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (isArtDialogOpen) {
        setIsArtDialogOpen(false);
        return;
      }
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isArtDialogOpen, onClose, open]);

  const hasSelectedCounts = useMemo(
    () => BASIC_G_COLORS.some((color) => Number(counts[color.key] || 0) > 0),
    [counts]
  );

  const activeArtOptions = useMemo(() => getBasicGImageOptions(activeArtTab), [activeArtTab]);

  const handleAdjustCount = (colorKey, delta) => {
    setCounts((current) => ({
      ...current,
      [colorKey]: clampCount((current[colorKey] || 0) + delta),
    }));
  };

  const handleOpenArtDialog = () => {
    setDraftArtByColor(normalizeSelection(selectedArtByColor));
    setActiveArtTab(BASIC_G_COLORS[0].key);
    setIsArtDialogOpen(true);
  };

  const handleConfirmArtSelection = () => {
    const normalized = normalizeSelection(draftArtByColor);
    setSelectedArtByColor(normalized);
    setDraftArtByColor(normalized);
    setIsArtDialogOpen(false);
  };

  const handleAdd = () => {
    const entries = BASIC_G_COLORS.map((color) => ({
      colorKey: color.key,
      count: Number(counts[color.key] || 0),
      imageIndex: Number(selectedArtByColor[color.key] || 1),
    })).filter((entry) => entry.count > 0);

    if (entries.length === 0) return;

    onAdd(entries);
    setCounts(buildEmptyCounts());
  };

  if (!open) return null;

  return (
    <>
      <div className="basic-g-dialog-overlay" role="presentation" onClick={onClose}>
        <div
          className={buildDialogClassName("basic-g-dialog", mobile)}
          role="dialog"
          aria-modal="true"
          aria-label="基本G追加"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="basic-g-dialog-header">
            <div>
              <h3>基本G追加</h3>
              <p className="basic-g-dialog-note">色ごとに枚数を指定してメインデッキへ追加します。</p>
            </div>
          </div>

          <div className="basic-g-dialog-scroll">
            <div className={mobile ? "basic-g-color-grid basic-g-color-grid-mobile" : "basic-g-color-grid"}>
              {BASIC_G_COLORS.map((color) => {
                const selectedOption = getBasicGImageOption(color.key, selectedArtByColor[color.key]);

                return (
                  <div key={color.key} className={mobile ? "basic-g-color-card basic-g-color-card-mobile" : "basic-g-color-card"}>
                    <div className="basic-g-color-label">{color.label}</div>
                    <div className="basic-g-color-preview">
                      {selectedOption?.path ? (
                        <img
                          src={getThumbnailPath(selectedOption.path)}
                          alt={`${color.label}の基本G`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="basic-g-color-preview-empty" />
                      )}
                    </div>
                    <div className="basic-g-stepper">
                      <button
                        type="button"
                        className="basic-g-stepper-button"
                        onClick={() => handleAdjustCount(color.key, -1)}
                        disabled={!counts[color.key]}
                        aria-label={`${color.label}を1枚減らす`}
                      >
                        -
                      </button>
                      <div className="basic-g-stepper-value">{counts[color.key] || 0}</div>
                      <button
                        type="button"
                        className="basic-g-stepper-button"
                        onClick={() => handleAdjustCount(color.key, 1)}
                        aria-label={`${color.label}を1枚増やす`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={mobile ? "basic-g-dialog-actions basic-g-dialog-actions-mobile" : "basic-g-dialog-actions"}>
            <button type="button" className="deck-secondary-button" onClick={handleOpenArtDialog}>
              イラスト選択
            </button>
            <button type="button" className="deck-secondary-button" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="deck-primary-button"
              onClick={handleAdd}
              disabled={!hasSelectedCounts}
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {isArtDialogOpen ? (
        <div
          className="basic-g-dialog-overlay"
          role="presentation"
          onClick={() => setIsArtDialogOpen(false)}
        >
          <div
            className={buildDialogClassName("basic-g-art-dialog", mobile)}
            role="dialog"
            aria-modal="true"
            aria-label="基本Gイラスト選択"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="basic-g-art-dialog-header">
              <div>
                <h3>基本Gイラスト選択</h3>
                <p className="basic-g-art-dialog-note">色ごとに任意のイラストを選択できます。</p>
              </div>
            </div>

            <div className="basic-g-art-tabs">
              {BASIC_G_COLORS.map((color) => (
                <button
                  key={color.key}
                  type="button"
                  className={activeArtTab === color.key ? "basic-g-art-tab active" : "basic-g-art-tab"}
                  onClick={() => setActiveArtTab(color.key)}
                >
                  {color.label}
                </button>
              ))}
            </div>

            <div className="basic-g-art-grid-scroll">
              <div className={mobile ? "basic-g-art-grid basic-g-art-grid-mobile" : "basic-g-art-grid"}>
                {activeArtOptions.map((option) => {
                  const isSelected = Number(draftArtByColor[activeArtTab]) === Number(option.index);

                  return (
                    <button
                      key={`${activeArtTab}-${option.index}`}
                      type="button"
                      className={isSelected ? "basic-g-art-tile selected" : "basic-g-art-tile"}
                      onClick={() =>
                        setDraftArtByColor((current) => ({
                          ...current,
                          [activeArtTab]: Number(option.index),
                        }))
                      }
                      aria-pressed={isSelected}
                    >
                      <img
                        src={getThumbnailPath(option.path)}
                        alt={`${BASIC_G_COLORS.find((color) => color.key === activeArtTab)?.label || ""}の基本G`}
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={mobile ? "basic-g-art-dialog-actions basic-g-dialog-actions-mobile" : "basic-g-art-dialog-actions"}>
              <button
                type="button"
                className="deck-secondary-button"
                onClick={() => setIsArtDialogOpen(false)}
              >
                キャンセル
              </button>
              <button type="button" className="deck-primary-button" onClick={handleConfirmArtSelection}>
                決定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
