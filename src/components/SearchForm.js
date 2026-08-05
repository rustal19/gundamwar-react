import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css';
import { trackEvent } from "../utils/analytics";
import { MULTI_SELECT_KEYS } from "../utils/searchResults";
import {
  buildPathWithForcedMobileLayout,
  preserveForcedMobileLayoutInParams,
} from "../utils/deviceLayout";
import {
  CARD_TYPE_OPTIONS,
  CHAR_FEATURE_OPTIONS,
  CHARACTER_EXTRA_OPTIONS,
  COLOR_EXCLUDE_OPTIONS,
  COLOR_INCLUDE_OPTIONS,
  COMBAT_NUMERIC_OPTIONS,
  COST_NUMERIC_OPTIONS,
  DECK_RANGE_PRESET_CUTOFFS,
  OTHER_FEATURE_OPTIONS,
  PAGE_SIZE_OPTIONS,
  SET_EXTRA_OPTIONS_BB,
  SET_EXTRA_OPTIONS_DB,
  SET_EXTRA_OPTIONS_EX,
  SET_EXTRA_OPTIONS_ST,
  SET_INCLUDED_OPTIONS,
  TENSAKU_OPTIONS,
  TERRAIN_OPTIONS,
  UNIT_EXTRA_OPTIONS,
  UNIT_FEATURE_OPTIONS,
} from "../data/searchOptions";
import { FORMAT_PRESETS } from "../data/formats";

const DECK_RANGE_VALUE_PREFIX = "range:";
const FORMAT_VALUE_PREFIX = "format:";

// 各入力項目の初期状態
const INITIAL_STATE = {
  // カード名検索
  name: "",
  name_forward: false,       // 前方一致チェックボックス

  // カードタイプ（複数選択）
  cardType: [],              // UNIT, CHARACTER, COMMAND, OPERATION, Generation, ACE

  // 色（含む側と「～でない」側）
  colorInclude: [],          // 青, 緑, 黒, 赤, 茶, 白, 紫
  colorExclude: [],          // 青でない, 緑でない, 黒でない, 赤でない, 茶でない, 白でない, 紫でない
  colorMulti: "able",        // セレクト： "多色を含んでもよい" / "多色を除く"

  // コスト
  spCostMin: "",
  spCostMax: "",
  totalCostMin: "",
  totalCostMax: "",
  resourceCostMin: "",
  resourceCostMax: "",
  includeUndecided: false,

  // カードテキスト検索（スペース区切りで AND 検索）
  text: "",

  // 格闘、射撃、防御（min～max）
  fightMin: "",
  fightMax: "",
  shootMin: "",
  shootMax: "",
  defenseMin: "",
  defenseMax: "",
  includeAltStats: true, // 変形状態のステータスを含めるかどうか

  // 地形適正
  terrain: [],               // 「宇宙」「地球」

  // UNIT特徴指定
  unitFeature: [],
  unitFeatureExtra: [],

  // CHARACTER特徴指定
  charFeature: [],
  charFeatureExtra: [],

  // その他特徴指定
  otherFeature: [],

  // 所属、系統特徴指定
  traitText: "",

  // 特徴系、AND/OR指定
  traits_logic: "and",

  // 専用機指定
  exclusivePilotText: [],

  // 構築範囲
  deckRangeType: "none",
  deckRangeDetail: "",
  formatName: "",

  // 禁止制限（ラジオボタン）
  exclude: "no",             // "banned", "restricted", "no"（すべて表示）

  // 収録弾
  setIncluded: [],
  setFeatureExtraBB: [],
  setFeatureExtraST: [],
  setFeatureExtraDB: [],
  setFeatureExtraEX: [],

  // 表示件数
  page: 1,
  pageSize: 50,

  // ソート方法
  sortMethod: "発行順",      // 発行順、カード名順、合計国力順
  sortOrder: "asc",          // "asc" or "desc"
};

// checkbox で配列として管理する項目
const CHECKBOX_ARRAY_NAMES = [
  "cardType", "colorInclude", "colorExclude",
  "terrain", "unitFeature", "charFeature",
  "otherFeature", "setIncluded",
];

const SearchForm = ({ onSearch, compact = false }) => {
  const [formValues, setFormValues] = useState(INITIAL_STATE);
  const navigate = useNavigate();
  const location = useLocation();
  const [openAccordions, setOpenAccordions] = useState({
    basic: true,
    numeric: false,
    features: false,
    build: false,
  });

  // URL のクエリパラメータがある場合、フォームの state を更新する
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newState = { ...INITIAL_STATE };
    for (const [key, value] of params.entries()) {
      if (MULTI_SELECT_KEYS.includes(key)) {
        try {
          // 1つだけ値がある場合、JSON 文字列と仮定してパースする
          newState[key] = JSON.parse(value);
        } catch (e) {
          newState[key] = [];
        }
      } else if (typeof INITIAL_STATE[key] === "boolean") {
        newState[key] = value === "true";
      } else {
        newState[key] = value;
      }
    }
    setFormValues(newState);
  }, [location.search]);

  // 共通の onChange ハンドラ
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && CHECKBOX_ARRAY_NAMES.includes(name)) {
      setFormValues(prev => ({
        ...prev,
        [name]: checked
          ? [...prev[name], value]
          : prev[name].filter(v => v !== value)
      }));
    } else if (name === "deckRangeType") {
      setFormValues(prev => ({
        ...prev,
        deckRangeType: value,
        formatName: "",
        deckRangeDetail:
          DECK_RANGE_PRESET_CUTOFFS[value]
            ? DECK_RANGE_PRESET_CUTOFFS[value]
            : value === "tensaku" && prev.deckRangeType === "tensaku"
              ? prev.deckRangeDetail
              : ""
      }));
    } else if (type === "checkbox") {
      // 単一のチェックボックス（例：name_forward）
      setFormValues(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormValues(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDeckRangeSelectionChange = (e) => {
    const { value } = e.target;

    if (value.startsWith(FORMAT_VALUE_PREFIX)) {
      setFormValues(prev => ({
        ...prev,
        deckRangeType: "none",
        deckRangeDetail: "",
        formatName: value.slice(FORMAT_VALUE_PREFIX.length),
      }));
      return;
    }

    const deckRangeType = value.startsWith(DECK_RANGE_VALUE_PREFIX)
      ? value.slice(DECK_RANGE_VALUE_PREFIX.length)
      : "none";
    setFormValues(prev => ({
      ...prev,
      deckRangeType,
      formatName: "",
      deckRangeDetail:
        DECK_RANGE_PRESET_CUTOFFS[deckRangeType]
          ? DECK_RANGE_PRESET_CUTOFFS[deckRangeType]
          : deckRangeType === "tensaku" && prev.deckRangeType === "tensaku"
            ? prev.deckRangeDetail
            : "",
    }));
  };

  // react-select 用 onChange ハンドラ
  const handleSelectChange = (name, selectedOptions) => {
    setFormValues(prev => ({
      ...prev,
      [name]: selectedOptions || []
    }));
  };

  const toggleAccordion = (key) => (event) => {
    if (!compact) return;
    event.preventDefault();
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const buildQueryString = (params) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      // 値が null, undefined, 空文字の場合はスキップ
      if (value === null || value === undefined || value === "") return;

      if (MULTI_SELECT_KEYS.includes(key)) {
        // 配列でなければ配列に変換する
        const arr = Array.isArray(value) ? value : [value];
        // react-select のオブジェクトの場合は value プロパティだけを抽出
        const mapped = arr.map(item => {
          if (typeof item === "object" && item !== null && item.value !== undefined) {
            return item.value;
          }
          return item;
        });
        // 配列全体を JSON.stringify して1つの値としてセットする
        query.set(key, JSON.stringify(mapped));
      } else {
        query.set(key, value);
      }
    });
    preserveForcedMobileLayoutInParams(query, location.search);
    return query.toString();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = {
      ...formValues,
      page: 1,
    };
    trackEvent("search_submit", {
      search_context: "main",
      has_name: Boolean(params.name),
      has_text: Boolean(params.text),
      card_type_count: Array.isArray(params.cardType) ? params.cardType.length : 0,
      include_color_count: Array.isArray(params.colorInclude) ? params.colorInclude.length : 0,
      exclude_color_count: Array.isArray(params.colorExclude) ? params.colorExclude.length : 0,
      deck_range_type: params.deckRangeType || "none",
      format_name: params.formatName || "",
      page_size: Number(params.pageSize || 0),
    });
    const queryString = buildQueryString(params);
    if (typeof onSearch === "function") {
      onSearch({ params, queryString });
      return;
    }
    navigate(`/search?${queryString}`);
  };

  // リセット処理
  const handleReset = () => {
    setFormValues(INITIAL_STATE);
    if (typeof onSearch === "function") {
      onSearch({ params: INITIAL_STATE, queryString: "" });
      return;
    }
    // クエリパラメータを含まない URL に置き換える（強制モバイル指定のみ保持）
    navigate(buildPathWithForcedMobileLayout("/search", location.search), { replace: true });
  };

  // compact 時はアコーディオン（details）で包み、デスクトップではそのまま並べる
  const renderSection = (key, title, children) => {
    if (!compact) return children;
    return (
      <details className="search-accordion" open={openAccordions[key]}>
        <summary className="search-accordion-summary" onClick={toggleAccordion(key)}>
          {title}
        </summary>
        <div className="search-accordion-panel">{children}</div>
      </details>
    );
  };

  const renderCostSelectPair = (minName, maxName, centerLabel, options) => (
    <div className="inline-group">
      <select
        name={minName}
        className="nselect number-select"
        value={formValues[minName]}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {options.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>{centerLabel}</span>
      <select
        name={maxName}
        className="nselect number-select"
        value={formValues[maxName]}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {options.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
  );

  const selectedFormat = FORMAT_PRESETS.find(({ name }) => name === formValues.formatName) || null;
  const deckRangeSelection = selectedFormat
    ? `${FORMAT_VALUE_PREFIX}${selectedFormat.name}`
    : `${DECK_RANGE_VALUE_PREFIX}${formValues.deckRangeType}`;

  return (
    <form onSubmit={handleSubmit} className="grid-form">
      {/* カード名検索 */}
      <div className="form-row">
        <label className="form-th" htmlFor="name">カード名</label>
        <div className="input-group">
          <input
            type="text"
            name="name"
            id="name"
            className="ntext"
            value={formValues.name}
            onChange={handleChange}
            size="50"
          />
          <div className="checkbox-inline">
            <input
              type="checkbox"
              name="name_forward"
              id="box_name_forward"
              value="forward"
              checked={formValues.name_forward}
              onChange={handleChange}
            />
            <label htmlFor="box_name_forward">前方一致</label>
          </div>
        </div>
      </div>

      {renderSection("basic", "基本条件", (
        <>
          {/* カードタイプ */}
          <div className="form-row">
            <span className="form-th">カードタイプ</span>
            <div className="checkbox-group">
              {CARD_TYPE_OPTIONS.map(({ label, value }) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name="cardType"
                    value={value}
                    checked={formValues.cardType.includes(String(value))}
                    onChange={handleChange}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 色 */}
          <div className="form-row">
            <span className="form-th">色</span>
            <div className="c1">
              <div className={compact ? "grid-2row-8col mobile-color-grid" : "grid-2row-8col"}>
                {compact ? (
                  COLOR_INCLUDE_OPTIONS.map(({ label, value }, index) => (
                    <div className="mobile-color-pair" key={`mobile-color-pair-${value}`}>
                      <label className="color-cell mobile-color-pair-option">
                        <input
                          type="checkbox"
                          name="colorInclude"
                          value={value}
                          checked={formValues.colorInclude.includes(String(value))}
                          onChange={handleChange}
                        />
                        {label}
                      </label>
                      <label className="color-cell mobile-color-pair-option">
                        <input
                          type="checkbox"
                          name="colorExclude"
                          value={value}
                          checked={formValues.colorExclude.includes(String(value))}
                          onChange={handleChange}
                        />
                        {COLOR_EXCLUDE_OPTIONS[index].label}
                      </label>
                    </div>
                  ))
                ) : (
                  <>
                    {COLOR_INCLUDE_OPTIONS.map(({ label, value }, idx) => (
                      <label
                        key={`include-${value}`}
                        className="color-cell"
                        style={{ gridColumn: idx + 1, gridRow: 1 }}
                      >
                        <input
                          type="checkbox"
                          name="colorInclude"
                          value={value}
                          checked={formValues.colorInclude.includes(String(value))}
                          onChange={handleChange}
                        />
                        {label}
                      </label>
                    ))}
                    {COLOR_EXCLUDE_OPTIONS.map(({ label, value }, idx) => (
                      <label
                        key={`exclude-${value}`}
                        className="color-cell"
                        style={{ gridColumn: idx + 1, gridRow: 2 }}
                      >
                        <input
                          type="checkbox"
                          name="colorExclude"
                          value={value}
                          checked={formValues.colorExclude.includes(String(value))}
                          onChange={handleChange}
                        />
                        {label}
                      </label>
                    ))}
                  </>
                )}
                <div className="dropdown-cell" style={{ gridColumn: 8, gridRow: '1 / span 2' }}>
                  <select
                    name="colorMulti"
                    className="nselect"
                    value={formValues.colorMulti}
                    onChange={handleChange}
                  >
                    <option value="able">多色を含んでもよい</option>
                    <option value="not">多色を除く</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* カードテキスト検索 */}
          <div className="form-row">
            <span className="form-th">カード<br />テキスト</span>
            <input
              type="text"
              name="text"
              className="ntext"
              placeholder="スペース区切りでAND検索"
              value={formValues.text}
              onChange={handleChange}
            />
          </div>
        </>
      ))}

      {renderSection("numeric", "数値・地形条件", (
        <>
          {/* 国力 */}
          <div className="form-row">
            <span className="form-th">国力</span>
            <div className="inline-container four-col">
              {renderCostSelectPair("spCostMin", "spCostMax", "≦ 指定 ≦", COST_NUMERIC_OPTIONS)}
              {renderCostSelectPair("totalCostMin", "totalCostMax", "≦ 合計 ≦", COST_NUMERIC_OPTIONS)}
              {renderCostSelectPair("resourceCostMin", "resourceCostMax", "≦ 資源 ≦", COST_NUMERIC_OPTIONS)}
              <div className="inline-group">
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    name="includeUndecided"
                    checked={formValues.includeUndecided}
                    onChange={handleChange}
                  />
                  Xも含む
                </label>
              </div>
            </div>
          </div>

          {/* 格闘、射撃、防御 */}
          <div className="form-row">
            <span className="form-th">戦闘修正</span>
            <div className="inline-container four-col">
              {renderCostSelectPair("fightMin", "fightMax", "≦ 格闘 ≦", COMBAT_NUMERIC_OPTIONS)}
              {renderCostSelectPair("shootMin", "shootMax", "≦ 射撃 ≦", COMBAT_NUMERIC_OPTIONS)}
              {renderCostSelectPair("defenseMin", "defenseMax", "≦ 防御 ≦", COMBAT_NUMERIC_OPTIONS)}
              <div className="inline-group">
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    name="includeAltStats"
                    checked={formValues.includeAltStats}
                    onChange={handleChange}
                  />
                  変形状態を含める
                </label>
              </div>
            </div>
          </div>

          {/* 地形適正 */}
          <div className="form-row">
            <span className="form-th">地形適正</span>
            <div className="checkbox-group">
              {TERRAIN_OPTIONS.map((terrain) => (
                <label key={terrain}>
                  <input
                    type="checkbox"
                    name="terrain"
                    value={terrain}
                    checked={formValues.terrain.includes(terrain)}
                    onChange={handleChange}
                  />
                  {terrain}
                </label>
              ))}
            </div>
          </div>
        </>
      ))}

      {renderSection("features", "特徴条件", (
        <>
          {/* UNIT特徴指定 */}
          <div className="form-row">
            <span className="form-th">UNIT<br />特徴指定</span>
            <div
              className="c1"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1em' // チェックボックス行とセレクトボックス行の余白
              }}
            >
              <div className="checkbox-group">
                {UNIT_FEATURE_OPTIONS.map(({ label, value }) => (
                  <label key={value} style={{ marginRight: "1em" }}>
                    <input
                      type="checkbox"
                      name="unitFeature"
                      value={value}
                      checked={formValues.unitFeature.includes(String(value))}
                      onChange={handleChange}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="select-group">
                <Select
                  isMulti
                  name="unitFeatureExtra"
                  options={UNIT_EXTRA_OPTIONS}
                  value={formValues.unitFeatureExtra}
                  onChange={(selectedOptions) => handleSelectChange("unitFeatureExtra", selectedOptions)}
                  placeholder="追加特徴を選択"
                />
              </div>
            </div>
          </div>

          {/* CHARACTER特徴指定 */}
          <div className="form-row">
            <span className="form-th">CHARACTER<br />特徴指定</span>
            <div
              className="c1"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1em' // チェックボックス行とセレクトボックス行の余白
              }}
            >
              <div className="checkbox-group">
                {CHAR_FEATURE_OPTIONS.map(({ label, value }) => (
                  <label key={value} style={{ marginRight: "1em" }}>
                    <input
                      type="checkbox"
                      name="charFeature"
                      value={value}
                      checked={formValues.charFeature.includes(String(value))}
                      onChange={handleChange}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="select-group">
                <Select
                  isMulti
                  name="charFeatureExtra"
                  options={CHARACTER_EXTRA_OPTIONS}
                  value={formValues.charFeatureExtra}
                  onChange={(selectedOptions) => handleSelectChange("charFeatureExtra", selectedOptions)}
                  placeholder="追加特徴を選択"
                />
              </div>
            </div>
          </div>

          {/* その他特徴指定 */}
          <div className="form-row">
            <span className="form-th">その他<br />特徴指定</span>
            <div className="checkbox-group">
              {OTHER_FEATURE_OPTIONS.map(({ label, value }) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name="otherFeature"
                    value={value}
                    checked={formValues.otherFeature.includes(String(value))}
                    onChange={handleChange}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 所属/系統指定 */}
          <div className="form-row">
            <span className="form-th">所属/系統</span>
            <input
              type="text"
              name="traitText"
              className="ntext"
              placeholder="スペース区切りでAND検索（例：〇〇系 ジオン）"
              value={formValues.traitText}
              onChange={handleChange}
            />
          </div>

          {/* 特徴の一致条件 */}
          <div className="form-row">
            <span className="form-th">特徴の<br />一致条件</span>
            <select
              name="traits_logic"
              className="nselect"
              value={formValues.traits_logic}
              onChange={handleChange}
            >
              <option value="and">すべての特徴を含む</option>
              <option value="or">いずれかの特徴を含む</option>
            </select>
          </div>

          {/* 専用検索 */}
          <div className="form-row">
            <span className="form-th">専用</span>
            <input
              type="text"
              name="exclusivePilotText"
              className="ntext"
              placeholder="パイロット名"
              value={formValues.exclusivePilotText}
              onChange={handleChange}
            />
          </div>
        </>
      ))}

      {renderSection("build", "収録・構築条件", (
        <>
          {/* 構築範囲 */}
          <div className="form-row">
            <label className="form-th" htmlFor="deckRangeSelection">構築範囲</label>
            <div className="deck-range-group">
              <div className="deck-range-select-row">
                <select
                  id="deckRangeSelection"
                  className="ntext deck-range-select"
                  value={deckRangeSelection}
                  onChange={handleDeckRangeSelectionChange}
                >
                  <optgroup label="収録日による範囲">
                    <option value={`${DECK_RANGE_VALUE_PREFIX}none`}>指定なし</option>
                    <option value={`${DECK_RANGE_VALUE_PREFIX}tensaku`}>添削杯</option>
                    <option value={`${DECK_RANGE_VALUE_PREFIX}classic`}>クラシック</option>
                    <option value={`${DECK_RANGE_VALUE_PREFIX}rising`}>ライジング</option>
                  </optgroup>
                  <optgroup label="大会フォーマット">
                    {FORMAT_PRESETS.map(({ name }) => (
                      <option key={name} value={`${FORMAT_VALUE_PREFIX}${name}`}>{name}</option>
                    ))}
                  </optgroup>
                </select>

                {/* ドロップダウンは「添削杯」が選ばれているときのみ表示 */}
                {formValues.deckRangeType === 'tensaku' && !selectedFormat && (
                  <select
                    name="deckRangeDetail"
                    className="ntext deck-range-detail-select"
                    value={formValues.deckRangeDetail}
                    onChange={handleChange}
                    aria-label="添削杯の開催回"
                  >
                    <option value="">回を選択してください</option>
                    {TENSAKU_OPTIONS.map(({ label, value }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedFormat ? (
                <p className="deck-range-format-note">
                  <strong>大会フォーマット: {selectedFormat.name}</strong>
                  {selectedFormat.note ? <span>{selectedFormat.note}</span> : null}
                </p>
              ) : null}
            </div>
          </div>

          {/* 収録弾 */}
          <div className="form-row">
            <span className="form-th">収録弾</span>
            <div>
              <div className="checkbox-grid6">
                {SET_INCLUDED_OPTIONS.map(({ label, value }) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      name="setIncluded"
                      value={value}
                      checked={formValues.setIncluded.includes(String(value))}
                      onChange={handleChange}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="select-row">
                <Select
                  isMulti
                  name="setFeatureExtraBB"
                  options={SET_EXTRA_OPTIONS_BB}
                  value={formValues.setFeatureExtraBB}
                  onChange={(selectedOptions) => handleSelectChange("setFeatureExtraBB", selectedOptions)}
                  placeholder="BB/EB"
                />
                <Select
                  isMulti
                  name="setFeatureExtraST"
                  options={SET_EXTRA_OPTIONS_ST}
                  value={formValues.setFeatureExtraST}
                  onChange={(selectedOptions) => handleSelectChange("setFeatureExtraST", selectedOptions)}
                  placeholder="スターター"
                />
                <Select
                  isMulti
                  name="setFeatureExtraDB"
                  options={SET_EXTRA_OPTIONS_DB}
                  value={formValues.setFeatureExtraDB}
                  onChange={(selectedOptions) => handleSelectChange("setFeatureExtraDB", selectedOptions)}
                  placeholder="特殊ブースター"
                />
                <Select
                  isMulti
                  name="setFeatureExtraEX"
                  options={SET_EXTRA_OPTIONS_EX}
                  value={formValues.setFeatureExtraEX}
                  onChange={(selectedOptions) => handleSelectChange("setFeatureExtraEX", selectedOptions)}
                  placeholder="その他"
                />
              </div>
            </div>
          </div>
        </>
      ))}

      {/* 表示件数 */}
      <div className="form-row">
        <span className="form-th">表示件数</span>
        <select
          name="pageSize"
          className="nselect"
          value={formValues.pageSize}
          onChange={handleChange}
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size}件</option>
          ))}
        </select>
      </div>

      {/* 送信／リセット ボタン */}
      <div className="form-row">
        <label></label>{" "}
        <div className="button-cell">
          <div className="button-group">
            <button type="submit" className="search">
              <span className="owl-sprite-16-black icon-search"></span>検索
            </button>
            <button type="reset" className="reset" onClick={handleReset}>
              <span className="owl-sprite-16-black icon-delete"></span>リセット
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default SearchForm;
