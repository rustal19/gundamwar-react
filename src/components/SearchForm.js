import React, { useState, useEffect, useMemo  } from 'react';
import Select from 'react-select';
import { useNavigate, useLocation  } from 'react-router-dom';
import '../App.css';
import { trackEvent } from "../utils/analytics";

const DECK_RANGE_PRESET_CUTOFFS = {
  classic: "2006-01-01",
  rising: "2009-11-20",
};

const SearchForm = ({ onSearch }) => {
  // 各入力項目の初期状態を定義
  const initialState = useMemo(() => ({
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
    includeAltStats: true, // ← 変形状態のステータスを含めるかどうか

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

    // 構築範囲（内容は後で記載）
    deckRangeType: "none",
    deckRangeDetail: "",

    // 禁止制限（ラジオボタン）
    exclude: "no",             // "banned", "restricted", "no"（すべて表示）

    // 収録弾（後で指定：例として dummy 項目）
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
    sortOrder: "asc"           // "asc" or "desc"
  }), []); // 依存配列を空にすることで、一度だけ生成される

  const [formValues, setFormValues] = useState(initialState);
  const navigate = useNavigate();  // navigate を useNavigate で初期化
  const location = useLocation();

  // URL のクエリパラメータがある場合、フォームの state を更新する
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const multiSelectKeys = [
      "cardType",
      "colorInclude",
      "colorExclude",
      "terrain",
      "unitFeature",
      "unitFeatureExtra",
      "charFeature",
      "charFeatureExtra",
      "otherFeature",
      "setIncluded",
      "setFeatureExtraBB",
      "setFeatureExtraST",
      "setFeatureExtraDB",
      "setFeatureExtraEX"
    ];
    const newState = { ...initialState };
    for (const [key, value] of params.entries()) {
      if (multiSelectKeys.includes(key)) {
        try {
          // 1つだけ値がある場合、JSON 文字列と仮定してパースする
          newState[key] = JSON.parse(value);
        } catch (e) {
          newState[key] = [];
        }
      } else {
        newState[key] = value;
      }
    }
    // 必要に応じて数値や boolean への変換を追加することも可能
    setFormValues(newState);
  }, [location.search, initialState]);

  // 共通の onChange ハンドラ
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // 複数選択用（配列で管理）の場合
    const multiSelectNames = [
      "cardType", "colorInclude", "colorExclude",
      "terrain", "unitFeature", "charFeature",
      "otherFeature", "setIncluded"
    ];
    if (type === "checkbox" && multiSelectNames.includes(name)) {
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

  // react-select 用 onChange ハンドラ
  const handleSelectChange = (name, selectedOptions) => {
    setFormValues(prev => ({
      ...prev,
      [name]: selectedOptions || []
    }));
  };

  const buildQueryString = (params) => {
    const query = new URLSearchParams();
    const multiSelectKeys = [
      "cardType",
      "colorInclude",
      "colorExclude",
      "terrain",
      "unitFeature",
      "unitFeatureExtra",
      "charFeature",
      "charFeatureExtra",
      "otherFeature",
      "setIncluded",
      "setFeatureExtraBB",
      "setFeatureExtraST",
      "setFeatureExtraDB",
      "setFeatureExtraEX",
    ];
    
    Object.entries(params).forEach(([key, value]) => {
      // 値が null, undefined, 空文字の場合はスキップ
      if (value === null || value === undefined || value === "") return;
      
      if (multiSelectKeys.includes(key)) {
        // multiSelectKeys に含まれるキーは、配列でなければ配列に変換する
        const arr = Array.isArray(value) ? value : [value];
        // オブジェクトの場合はその value プロパティだけを抽出（なければそのまま）
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
    console.log("Resetting to:", initialState);
    setFormValues(initialState);
    if (typeof onSearch === "function") {
      onSearch({ params: initialState, queryString: "" });
      return;
    }
    // クエリパラメータを含まない URL に置き換える
    navigate("/", { replace: true });
  };

  // 検索フォームの選択肢
  const numericOptions = [
    { label: "*", value: "*" },
    { label: "-2", value: -2 },
    { label: "-1", value: -1 },
    { label: "0", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
    { label: "8", value: 8 },
    { label: "9", value: 9 },
    { label: "10", value: 10 }
  ];

  const numericOptions1 = [
    { label: "0", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
    { label: "8", value: 8 },
    { label: "9", value: 9 },
    { label: "10", value: 10 }
  ];

  const numericOptions2 = [
    { label: "0", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
    { label: "8", value: 8 },
    { label: "9", value: 9 },
    { label: "10", value: 10 }
  ];

  const numericOptions3 = [
    { label: "0", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
    { label: "8", value: 8 },
    { label: "9", value: 9 },
    { label: "10", value: 10 }
  ];

  const characterExtraOptions = [
    { value: "boostedMan", label: "ブーステッドマン" },
    { value: "extended", label: "エクステンデッド" },
    { value: "innovator", label: "イノベイター" },
    { value: "superSoldier", label: "超兵" },
    { value: "observer", label: "監視者" }
  ];
  
  const unitExtraOptions = [
    { value: "mobileDoll", label: "MD" },
    { value: "superDeformed", label: "SD" },
    { value: "bike", label: "バイク" },
    { value: "mobileHorse", label: "モビルホース" },
    { value: "tank", label: "戦車" },
    { value: "flagship", label: "旗艦" },
    { value: "supplyShip", label: "補給艦" },
    { value: "transportShip", label: "輸送艦" },
    { value: "dockShip", label: "ドッグ艦" },
    { value: "fighter", label: "戦闘機" },
    { value: "recon", label: "偵察機" },
    { value: "transport", label: "輸送機" },
    { value: "airship", label: "飛行船" },
    { value: "orbitalElevator", label: "軌道エレベーター" }
  ];

  const setIncludeExtraOptionsBB = [
    { label: "ベースドブースター", value: "BB1" },
    { label: "ベースドブースター2", value: "BB2" },
    { label: "ベースドブースター3", value: "BB3" },
    { label: "エクステンションブースター", value: "EB1" },
    { label: "エクステンションブースター2", value: "EB2" },
    { label: "エクステンションブースター3", value: "EB3" }
  ];

  const setIncludeExtraOptionsST = [
    { label: "決戦！星一号作戦", value: "DS1_1" },
    { label: "宇宙要塞ア・バオア・クー", value: "DS1_2" },
    { label: "正義の創痕", value: "DS2_1" },
    { label: "黒い覇道", value: "DS2_2" },
    { label: "赤き脅威", value: "DS2_3" },
    { label: "ギレンの野望編", value: "DS3" },
    { label: "ガンダムSEED編「栄光のザフト」", value: "DS4" },
    { label: "ガンダムSEED DESTINY編「閃光のミネルバ」", value: "DS5" },
    { label: "疾風の砲火", value: "TS1_1" },
    { label: "戦乱の兇刃", value: "TS1_2" },
    { label: "爆炎の決闘場", value: "TS2" },
    { label: "知略の猛将", value: "TS3_1" },
    { label: "迅雷の騎兵", value: "TS3_2" },
    { label: "破壊と再生の剣", value: "TS4_1" },
    { label: "異世界からの使者", value: "TS4_2" },
    { label: "白き光芒", value: "TR1_1" },
    { label: "猛き濁流", value: "TR1_2" },
    { label: "蒼空の覇者", value: "WS1" },
    { label: "純白の鋼翼", value: "WS2" }
  ];

  const setIncludeExtraOptionsDB = [
    { label: "一年戦争編", value: "DB1" },
    { label: "ウイング", value: "DB2" },
    { label: "ガンダムSEED編", value: "DB3" },
    { label: "戦場の女神", value: "DB4" },
    { label: "ガンダムSEED DESTINY編", value: "DB5" },
    { label: "機動戦士ZガンダムTHE Movie", value: "DB6" },
    { label: "ガンダム・ザ・ガンダム編", value: "DB7" },
    { label: "前線のフォトグラフ", value: "DB8" },
    { label: "戦場の女神2", value: "DB9" },
    { label: "乱世に生きる漢たち", value: "DB10" },
    { label: "戦場の女神ADVENT", value: "DB11" },
    { label: "ウィナーズブースター01", value: "WB" },
    { label: "赤い彗星シャア編", value: "SB" },
    { label: "ガンダムエース編", value: "CB1" },
    { label: "ガンプラ30thメモリアルエディション", value: "CB2" }
  ];

  const setIncludeExtraOptionsEX = [
    { label: "拡張シート", value: "EX1" },
    { label: "拡張シートVer.2", value: "EX2" },
    { label: "覇王の紋章 ジャンボカードダスVer.", value: "EX3" },
    { label: "入門用スターター", value: "BS" },
    { label: "オールウェイズビギニングセット", value: "EV" },
    { label: "BIGガンスリンガーカード", value: "BG" },
    { label: "コラボカード", value: "joke" }
  ];

  return (
    <form onSubmit={handleSubmit} className="grid-form">
      {/* ① カード名検索 */}
      <div className="form-row">
        <th htmlFor="name">カード名</th>
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

      {/* ② カードタイプ */}
      <div className="form-row">
        <th>カードタイプ</th>
        <div className="checkbox-group">
          {[
            { label: "UNIT", value: 1 },
            { label: "CHARACTER", value: 2 },
            { label: "COMMAND", value: 3 },
            { label: "OPERATION", value: 4 },
            { label: "Generation", value: 10 },
            { label: "ACE", value: 11 },
          ].map(({ label, value }) => (
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

{/* ③ 色 */}
<div className="form-row">
  <th>色</th>
  <td className="c1">
    <div className="grid-2row-8col">
      {/* --- 上段（colorInclude 7個） --- */}
      {[
        { label: "青", value: 1 },
        { label: "緑", value: 2 },
        { label: "黒", value: 3 },
        { label: "赤", value: 4 },
        { label: "茶", value: 5 },
        { label: "白", value: 6 },
        { label: "紫", value: 7 },
      ].map(({ label, value }, idx) => (
        <label key={`include-${value}`} className="color-cell" 
          style={{ gridColumn: (idx + 1), gridRow: 1 }}
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

      {/* --- 下段（colorExclude 7個） --- */}
      {[
        { label: "青でない", value: 1 },
        { label: "緑でない", value: 2 },
        { label: "黒でない", value: 3 },
        { label: "赤でない", value: 4 },
        { label: "茶でない", value: 5 },
        { label: "白でない", value: 6 },
        { label: "紫でない", value: 7 },
      ].map(({ label, value }, idx) => (
        <label key={`exclude-${value}`} className="color-cell" 
          style={{ gridColumn: (idx + 1), gridRow: 2 }}
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

      {/* --- 右側：ドロップダウンを column 8 に配置 --- */}
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
  </td>
</div>

      {/* ④ カードテキスト検索 */}
      <div className="form-row">
        <th>カード<br />テキスト</th>
        <input 
          type="text" 
          name="text" 
          className="ntext" 
          placeholder="スペース区切りでAND検索"
          value={formValues.text}
          onChange={handleChange}
        />
      </div>

{/* ⑤ 国力 */}
<div className="form-row">
  <th>国力</th>
  <div className="inline-container four-col">
    <div className="inline-group">
      <select 
        name="spCostMin" 
        className="nselect number-select" 
        value={formValues.spCostMin}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions1.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>≦ 指定 ≦</span>
      <select 
        name="spCostMax" 
        className="nselect number-select" 
        value={formValues.spCostMax}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions1.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
    <div className="inline-group">
      <select 
        name="totalCostMin" 
        className="nselect number-select" 
        value={formValues.totalCostMin}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions2.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>≦ 合計 ≦</span>
      <select 
        name="totalCostMax" 
        className="nselect number-select" 
        value={formValues.totalCostMax}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions2.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
    <div className="inline-group">
      <select 
        name="resourceCostMin" 
        className="nselect number-select" 
        value={formValues.resourceCostMin}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions3.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>≦ 資源 ≦</span>
      <select 
        name="resourceCostMax" 
        className="nselect number-select" 
        value={formValues.resourceCostMax}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions3.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
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

{/* ⑤ 格闘、射撃、防御 */}
<div className="form-row">
  <th>戦闘修正</th>
  <div className="inline-container four-col">
    <div className="inline-group">
      <select 
        name="fightMin" 
        className="nselect number-select" 
        value={formValues.fightMin}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>≦ 格闘 ≦</span>
      <select 
        name="fightMax" 
        className="nselect number-select" 
        value={formValues.fightMax}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
    <div className="inline-group">
      <select 
        name="shootMin" 
        className="nselect number-select" 
        value={formValues.shootMin}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>≦ 射撃 ≦</span>
      <select 
        name="shootMax" 
        className="nselect number-select" 
        value={formValues.shootMax}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
    <div className="inline-group">
      <select 
        name="defenseMin" 
        className="nselect number-select" 
        value={formValues.defenseMin}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
      <span>≦ 防御 ≦</span>
      <select 
        name="defenseMax" 
        className="nselect number-select" 
        value={formValues.defenseMax}
        onChange={handleChange}
      >
        <option value="">指定なし</option>
        {numericOptions.map(n => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
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

      {/* ⑦ 地形適正 */}
      <div className="form-row">
        <th>地形適正</th>
        <div className="checkbox-group">
          {["宇宙", "地球"].map((terrain) => (
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

{/* ⑦ UNIT特徴指定 */}
      <div className="form-row">
  <th>UNIT<br />特徴指定</th>
  <td
    className="c1"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1em' // チェックボックス行とセレクトボックス行の余白
    }}
  >
    {/* 1行目: チェックボックス群 */}
    <div className="checkbox-group">
      {[{ label: "MS", value: "mobileSuits" },
        { label: "MA", value: "mobileArmor" },
        { label: "MF", value: "mobileFighter" },
        { label: "コンビ", value: "combi" },
        { label: "Lサイズ", value: "largeSize" },
        { label: "艦艇", value: "warship" }
      ].map(({ label, value }) => (
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

    {/* 2行目: 複数選択ボックス（react-select） */}
    <div className="select-group">
      <Select
        isMulti
        name="unitFeatureExtra"
        options={unitExtraOptions}
        value={formValues.unitFeatureExtra}
        onChange={(selectedOptions) =>
          setFormValues(prev => ({ ...prev, unitFeatureExtra: selectedOptions || [] }))
        }
        placeholder="追加特徴を選択"
      />
    </div>
  </td>
</div>
      {/* ⑨ CHARACTER特徴指定 */}
      <div className="form-row">
        <th>CHARACTER<br />特徴指定</th>
        <td
          className="c1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1em' // チェックボックス行とセレクトボックス行の余白
          }}
          >
        <div className="checkbox-group">
          {[
            { label: "男性", value: "male" },
            { label: "女性", value: "female" },
            { label: "大人", value: "adult" },
            { label: "子供", value: "child" },
            { label: "NT", value: "newType" },
            { label: "CO", value: "coordinator" },
            { label: "GF", value: "gundamFighter" }
          ].map(({ label, value }) => (
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
            options={characterExtraOptions}
            value={formValues.charFeatureExtra}
            onChange={(selectedOptions) => handleSelectChange("charFeatureExtra", selectedOptions)}
            placeholder="追加特徴を選択"
          />
        </div>
        </td>
      </div>

      {/* ⑩ その他特徴指定 */}
      <div className="form-row">
        <th>その他<br />特徴指定</th>
        <div className="checkbox-group">
          {[
            { label: "移動", value: "move" },
            { label: "回復", value: "recover" },
            { label: "強化", value: "enhance" },
            { label: "再生", value: "regenerate" },
            { label: "支配", value: "control" },
            { label: "束縛", value: "bind" },
            { label: "対抗", value: "counter" },
            { label: "展開", value: "deploy" },
            { label: "破壊", value: "destroy" },
            { label: "補強", value: "reinforce" },
            { label: "兵装", value: "equipment" }
          ].map(({ label, value }) => (
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

      {/* ⑪ 所属/系統指定 */}
      <div className="form-row">
        <th>所属/系統</th>
        <input 
          type="text" 
          name="traitText" 
          className="ntext" 
          placeholder="スペース区切りでAND検索（例：〇〇系 ジオン）"
          value={formValues.traitText}
          onChange={handleChange}
        />
      </div>

      {/* ⑫ 特徴の一致条件 */}
      <div className="form-row">
        <th>特徴の<br />一致条件</th>
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

      {/* ⑬ 専用検索 */}
      <div className="form-row">
        <th>専用</th>
        <input 
          type="text" 
          name="exclusivePilotText" 
          className="ntext" 
          placeholder="パイロット名"
          value={formValues.exclusivePilotText}
          onChange={handleChange}
        />
      </div>

      {/* ⑭ 構築範囲（placeholder） */}
      <div className="form-row">
        <th>構築範囲</th>
        <div className="inline-group deck-range-group">
          <label>
            <input
              type="radio"
              name="deckRangeType"
              value="none"
              checked={formValues.deckRangeType === 'none'}
              onChange={handleChange}
            />
            指定なし
          </label>

          <label>
            <input
              type="radio"
              name="deckRangeType"
              value="tensaku"
              checked={formValues.deckRangeType === 'tensaku'}
              onChange={handleChange}
            />
            添削杯
          </label>

          {/* ドロップダウンは「添削杯」が選ばれているときのみ表示 */}
          <label>
            <input
              type="radio"
              name="deckRangeType"
              value="classic"
              checked={formValues.deckRangeType === 'classic'}
              onChange={handleChange}
            />
            クラシック
          </label>

          <label>
            <input
              type="radio"
              name="deckRangeType"
              value="rising"
              checked={formValues.deckRangeType === 'rising'}
              onChange={handleChange}
            />
            ライジング
          </label>

          {formValues.deckRangeType === 'tensaku' && (
            <select
              name="deckRangeDetail"
              className="ntext"
              value={formValues.deckRangeDetail}
              onChange={handleChange}
              style={{ marginLeft: '8px' }}
            >
              <option value="">選択してください</option>
                  <option value="2010-03-09">第9回 添削杯</option>
                  <option value="2009-08-09">第8回 添削杯</option>
                  <option value="2009-02-19">第7回 添削杯</option>
                  <option value="2008-02-28">第6回 添削杯</option>
                  <option value="2007-08-31">第5回 添削杯</option>
                  <option value="2007-02-28">第4回 添削杯</option>
                  <option value="2006-08-31">第3回 添削杯</option>
              <option value="2006-02-28">第2回 添削杯</option>
              <option value="2005-08-31">第1回 添削杯</option>
            </select>
          )}
        </div>
      </div>

      {/* ⑪ 禁止制限 
      <div className="form-row">
        <label>禁止制限</label>
        <div className="checkbox-group">
          <label>
            <input 
              type="radio" 
              name="exclude" 
              value="banned"
              checked={formValues.exclude === "banned"}
              onChange={handleChange}
            />
            禁止カードは除く
          </label>
          <label>
            <input 
              type="radio" 
              name="exclude" 
              value="restricted"
              checked={formValues.exclude === "restricted"}
              onChange={handleChange}
            />
            制限カードは除く
          </label>
          <label>
            <input 
              type="radio" 
              name="exclude" 
              value="no"
              checked={formValues.exclude === "no"}
              onChange={handleChange}
            />
            すべて表示
          </label>
        </div>
      </div> */}

      {/* ⑫ 収録弾（placeholder） */}
      <div className="form-row">
        <th>収録弾</th>
        <div>
        {/* 8×4でチェックボックスを並べる */}
        <div className="checkbox-grid6">
          {[
            { label: "GUNDAM WAR", value: "1st" },
            { label: "撃墜王出撃", value: "2nd" },
            { label: "宇宙の記憶", value: "3rd" },
            { label: "新しき翼", value: "4th" },
            { label: "永久の絆", value: "5th" },
            { label: "新世紀の鼓動", value: "6th" },
            { label: "革新の波濤", value: "7th" },
            { label: "月下の戦塵", value: "8th" },
            { label: "相剋の軌跡", value: "9th" },
            { label: "刻の末裔", value: "10th" },
            { label: "蒼海の死闘", value: "11th" },
            { label: "宿命の螺旋", value: "12th" },
            { label: "烈火の咆哮", value: "13th" },
            { label: "果てなき運命", value: "14th" },
            { label: "禁忌の胎動", value: "15th" },
            { label: "覇王の紋章", value: "16th" },
            { label: "不敗の流派", value: "17th" },
            { label: "戦慄の兵威", value: "18th" },
            { label: "変革の叛旗", value: "19th" },
            { label: "流転する世界", value: "20th" },
            { label: "放たれた刃", value: "21st" },
            { label: "武神降臨", value: "22nd" },
            { label: "栄光の戦史", value: "23rd" },
            { label: "宇宙を駆逐する光", value: "24th" },
            { label: "双極の閃光", value: "25th" },
            { label: "戦いという名の対話", value: "26th" },
            { label: "雷鳴の使徒", value: "27th" },
            { label: "絶対戦力", value: "28th" },
            { label: "プロモカード", value: "PR" }
          ].map(({ label, value }) => (
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
          
          {/* セレクトボックスを一列で並べる */}
          <div className="select-row">
            <Select
              isMulti
              name="setFeatureExtraBB"
              options={setIncludeExtraOptionsBB}
              value={formValues.setFeatureExtraBB}
              onChange={(selectedOptions) => handleSelectChange("setFeatureExtraBB", selectedOptions)}
              placeholder="BB/EB"
            />
            <Select
              isMulti
              name="setFeatureExtraST"
              options={setIncludeExtraOptionsST}
              value={formValues.setFeatureExtraST}
              onChange={(selectedOptions) => handleSelectChange("setFeatureExtraST", selectedOptions)}
              placeholder="スターター"
            />
            <Select
              isMulti
              name="setFeatureExtraDB"
              options={setIncludeExtraOptionsDB}
              value={formValues.setFeatureExtraDB}
              onChange={(selectedOptions) => handleSelectChange("setFeatureExtraDB", selectedOptions)}
              placeholder="特殊ブースター"
            />
            <Select
              isMulti
              name="setFeatureExtraEX"
              options={setIncludeExtraOptionsEX}
              value={formValues.setFeatureExtraEX}
              onChange={(selectedOptions) => handleSelectChange("setFeatureExtraEX", selectedOptions)}
              placeholder="その他"
            />
          </div>
        </div>
      </div>

      {/* ⑯ 表示件数 */}
      <div className="form-row">
        <th>表示件数</th>
        <select
          name="pageSize"
          className="nselect"
          value={formValues.pageSize}
          onChange={handleChange}
        >
          {[10, 20, 50, 100, 200].map(size => (
            <option key={size} value={size}>{size}件</option>
          ))}
        </select>
      </div>

{/* ⑰ 送信／リセット ボタン */}
<div className="form-row">
  {/* 左カラム */}
  <label></label> {/* ここは空か、何かラベルを置いてもよい */}
  {/* 右カラム */}
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
