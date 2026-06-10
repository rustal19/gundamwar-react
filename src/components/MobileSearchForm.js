import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css';
import { trackEvent } from "../utils/analytics";
import { buildPathWithForcedMobileLayout, preserveForcedMobileLayoutInParams } from "../utils/deviceLayout";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const DECK_RANGE_PRESET_CUTOFFS = {
  classic: "2006-01-01",
  rising: "2009-11-20"
};
const SearchForm = _ref => {
  let {
    onSearch
  } = _ref; // 各入力項目の初期状態を定義
  const initialState = useMemo(() => ({
    // カード名検索
    name: "",
    name_forward: false,
    // 前方一致チェックボックス
    // カードタイプ（複数選択）
    cardType: [],
    // UNIT, CHARACTER, COMMAND, OPERATION, Generation, ACE
    // 色（含む側と「～でない」側）
    colorInclude: [],
    // 青, 緑, 黒, 赤, 茶, 白, 紫
    colorExclude: [],
    // 青でない, 緑でない, 黒でない, 赤でない, 茶でない, 白でない, 紫でない
    colorMulti: "able",
    // セレクト： "多色を含んでもよい" / "多色を除く"
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
    includeAltStats: true,
    // ← 変形状態のステータスを含めるかどうか
    // 地形適正
    terrain: [],
    // 「宇宙」「地球」
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
    exclude: "no",
    // "banned", "restricted", "no"（すべて表示）
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
    sortMethod: "発行順",
    // 発行順、カード名順、合計国力順
    sortOrder: "asc" // "asc" or "desc"
  }), []); // 依存配列を空にすることで、一度だけ生成される
  const [formValues, setFormValues] = useState(initialState);
  const navigate = useNavigate(); /* navigate を useNavigate で初期化 */
  const location = useLocation();
  const isCompactMobileSearch = true;
  const [openAccordions, setOpenAccordions] = useState({
    basic: true,
    numeric: false,
    features: false,
    build: false
  }); // URL のクエリパラメータがある場合、フォームの state を更新する
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const multiSelectKeys = ["cardType", "colorInclude", "colorExclude", "terrain", "unitFeature", "unitFeatureExtra", "charFeature", "charFeatureExtra", "otherFeature", "setIncluded", "setFeatureExtraBB", "setFeatureExtraST", "setFeatureExtraDB", "setFeatureExtraEX"];
    const newState = {
      ...initialState
    };
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
    } // 必要に応じて数値や boolean への変換を追加することも可能
    setFormValues(newState);
  }, [location.search, initialState]); // 共通の onChange ハンドラ
  const handleChange = e => {
    const {
      name,
      value,
      type,
      checked
    } = e.target; // 複数選択用（配列で管理）の場合
    const multiSelectNames = ["cardType", "colorInclude", "colorExclude", "terrain", "unitFeature", "charFeature", "otherFeature", "setIncluded"];
    if (type === "checkbox" && multiSelectNames.includes(name)) {
      setFormValues(prev => ({
        ...prev,
        [name]: checked ? [...prev[name], value] : prev[name].filter(v => v !== value)
      }));
    } else if (name === "deckRangeType") {
      setFormValues(prev => ({
        ...prev,
        deckRangeType: value,
        deckRangeDetail: DECK_RANGE_PRESET_CUTOFFS[value] ? DECK_RANGE_PRESET_CUTOFFS[value] : value === "tensaku" && prev.deckRangeType === "tensaku" ? prev.deckRangeDetail : ""
      }));
    } else if (type === "checkbox") {
      // 単一のチェックボックス（例：name_forward）
      setFormValues(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormValues(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }; // react-select 用 onChange ハンドラ
  const handleSelectChange = (name, selectedOptions) => {
    setFormValues(prev => ({
      ...prev,
      [name]: selectedOptions || []
    }));
  };
  const toggleAccordion = key => event => {
    if (!isCompactMobileSearch) return;
    event.preventDefault();
    setOpenAccordions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  const buildQueryString = params => {
    const query = new URLSearchParams();
    const multiSelectKeys = ["cardType", "colorInclude", "colorExclude", "terrain", "unitFeature", "unitFeatureExtra", "charFeature", "charFeatureExtra", "otherFeature", "setIncluded", "setFeatureExtraBB", "setFeatureExtraST", "setFeatureExtraDB", "setFeatureExtraEX"];
    Object.entries(params).forEach(_ref2 => {
      let [key, value] = _ref2; // 値が null, undefined, 空文字の場合はスキップ
      if (value === null || value === undefined || value === "") return;
      if (multiSelectKeys.includes(key)) {
        // multiSelectKeys に含まれるキーは、配列でなければ配列に変換する
        const arr = Array.isArray(value) ? value : [value]; // オブジェクトの場合はその value プロパティだけを抽出（なければそのまま）
        const mapped = arr.map(item => {
          if (typeof item === "object" && item !== null && item.value !== undefined) {
            return item.value;
          }
          return item;
        }); // 配列全体を JSON.stringify して1つの値としてセットする
        query.set(key, JSON.stringify(mapped));
      } else {
        query.set(key, value);
      }
    });
    preserveForcedMobileLayoutInParams(query, location.search);
    return query.toString();
  };
  const handleSubmit = e => {
    e.preventDefault();
    const params = {
      ...formValues,
      page: 1
    };
    trackEvent("search_submit", {
      search_context: "main",
      has_name: Boolean(params.name),
      has_text: Boolean(params.text),
      card_type_count: Array.isArray(params.cardType) ? params.cardType.length : 0,
      include_color_count: Array.isArray(params.colorInclude) ? params.colorInclude.length : 0,
      exclude_color_count: Array.isArray(params.colorExclude) ? params.colorExclude.length : 0,
      deck_range_type: params.deckRangeType || "none",
      page_size: Number(params.pageSize || 0)
    });
    const queryString = buildQueryString(params);
    if (typeof onSearch === "function") {
      onSearch({
        params,
        queryString
      });
      return;
    }
    navigate(`/search?${queryString}`);
  }; // リセット処理
  const handleReset = () => {
    console.log("Resetting to:", initialState);
    setFormValues(initialState);
    if (typeof onSearch === "function") {
      onSearch({
        params: initialState,
        queryString: ""
      });
      return;
    } // クエリパラメータを含まない URL に置き換える
    navigate(buildPathWithForcedMobileLayout("/", location.search), {
      replace: true
    });
  }; // 検索フォームの選択肢
  const numericOptions = [{
    label: "*",
    value: "*"
  }, {
    label: "-2",
    value: -2
  }, {
    label: "-1",
    value: -1
  }, {
    label: "0",
    value: 0
  }, {
    label: "1",
    value: 1
  }, {
    label: "2",
    value: 2
  }, {
    label: "3",
    value: 3
  }, {
    label: "4",
    value: 4
  }, {
    label: "5",
    value: 5
  }, {
    label: "6",
    value: 6
  }, {
    label: "7",
    value: 7
  }, {
    label: "8",
    value: 8
  }, {
    label: "9",
    value: 9
  }, {
    label: "10",
    value: 10
  }];
  const numericOptions1 = [{
    label: "0",
    value: 0
  }, {
    label: "1",
    value: 1
  }, {
    label: "2",
    value: 2
  }, {
    label: "3",
    value: 3
  }, {
    label: "4",
    value: 4
  }, {
    label: "5",
    value: 5
  }, {
    label: "6",
    value: 6
  }, {
    label: "7",
    value: 7
  }, {
    label: "8",
    value: 8
  }, {
    label: "9",
    value: 9
  }, {
    label: "10",
    value: 10
  }];
  const numericOptions2 = [{
    label: "0",
    value: 0
  }, {
    label: "1",
    value: 1
  }, {
    label: "2",
    value: 2
  }, {
    label: "3",
    value: 3
  }, {
    label: "4",
    value: 4
  }, {
    label: "5",
    value: 5
  }, {
    label: "6",
    value: 6
  }, {
    label: "7",
    value: 7
  }, {
    label: "8",
    value: 8
  }, {
    label: "9",
    value: 9
  }, {
    label: "10",
    value: 10
  }];
  const numericOptions3 = [{
    label: "0",
    value: 0
  }, {
    label: "1",
    value: 1
  }, {
    label: "2",
    value: 2
  }, {
    label: "3",
    value: 3
  }, {
    label: "4",
    value: 4
  }, {
    label: "5",
    value: 5
  }, {
    label: "6",
    value: 6
  }, {
    label: "7",
    value: 7
  }, {
    label: "8",
    value: 8
  }, {
    label: "9",
    value: 9
  }, {
    label: "10",
    value: 10
  }];
  const characterExtraOptions = [{
    value: "boostedMan",
    label: "ブーステッドマン"
  }, {
    value: "extended",
    label: "エクステンデッド"
  }, {
    value: "innovator",
    label: "イノベイター"
  }, {
    value: "superSoldier",
    label: "超兵"
  }, {
    value: "observer",
    label: "監視者"
  }];
  const unitExtraOptions = [{
    value: "mobileDoll",
    label: "MD"
  }, {
    value: "superDeformed",
    label: "SD"
  }, {
    value: "bike",
    label: "バイク"
  }, {
    value: "mobileHorse",
    label: "モビルホース"
  }, {
    value: "tank",
    label: "戦車"
  }, {
    value: "flagship",
    label: "旗艦"
  }, {
    value: "supplyShip",
    label: "補給艦"
  }, {
    value: "transportShip",
    label: "輸送艦"
  }, {
    value: "dockShip",
    label: "ドッグ艦"
  }, {
    value: "fighter",
    label: "戦闘機"
  }, {
    value: "recon",
    label: "偵察機"
  }, {
    value: "transport",
    label: "輸送機"
  }, {
    value: "airship",
    label: "飛行船"
  }, {
    value: "orbitalElevator",
    label: "軌道エレベーター"
  }];
  const setIncludeExtraOptionsBB = [{
    label: "ベースドブースター",
    value: "BB1"
  }, {
    label: "ベースドブースター2",
    value: "BB2"
  }, {
    label: "ベースドブースター3",
    value: "BB3"
  }, {
    label: "エクステンションブースター",
    value: "EB1"
  }, {
    label: "エクステンションブースター2",
    value: "EB2"
  }, {
    label: "エクステンションブースター3",
    value: "EB3"
  }];
  const setIncludeExtraOptionsST = [{
    label: "決戦！星一号作戦",
    value: "DS1_1"
  }, {
    label: "宇宙要塞ア・バオア・クー",
    value: "DS1_2"
  }, {
    label: "正義の創痕",
    value: "DS2_1"
  }, {
    label: "黒い覇道",
    value: "DS2_2"
  }, {
    label: "赤き脅威",
    value: "DS2_3"
  }, {
    label: "ギレンの野望編",
    value: "DS3"
  }, {
    label: "ガンダムSEED編「栄光のザフト」",
    value: "DS4"
  }, {
    label: "ガンダムSEED DESTINY編「閃光のミネルバ」",
    value: "DS5"
  }, {
    label: "疾風の砲火",
    value: "TS1_1"
  }, {
    label: "戦乱の兇刃",
    value: "TS1_2"
  }, {
    label: "爆炎の決闘場",
    value: "TS2"
  }, {
    label: "知略の猛将",
    value: "TS3_1"
  }, {
    label: "迅雷の騎兵",
    value: "TS3_2"
  }, {
    label: "破壊と再生の剣",
    value: "TS4_1"
  }, {
    label: "異世界からの使者",
    value: "TS4_2"
  }, {
    label: "白き光芒",
    value: "TR1_1"
  }, {
    label: "猛き濁流",
    value: "TR1_2"
  }, {
    label: "蒼空の覇者",
    value: "WS1"
  }, {
    label: "純白の鋼翼",
    value: "WS2"
  }];
  const setIncludeExtraOptionsDB = [{
    label: "一年戦争編",
    value: "DB1"
  }, {
    label: "ウイング",
    value: "DB2"
  }, {
    label: "ガンダムSEED編",
    value: "DB3"
  }, {
    label: "戦場の女神",
    value: "DB4"
  }, {
    label: "ガンダムSEED DESTINY編",
    value: "DB5"
  }, {
    label: "機動戦士ZガンダムTHE Movie",
    value: "DB6"
  }, {
    label: "ガンダム・ザ・ガンダム編",
    value: "DB7"
  }, {
    label: "前線のフォトグラフ",
    value: "DB8"
  }, {
    label: "戦場の女神2",
    value: "DB9"
  }, {
    label: "乱世に生きる漢たち",
    value: "DB10"
  }, {
    label: "戦場の女神ADVENT",
    value: "DB11"
  }, {
    label: "ウィナーズブースター01",
    value: "WB"
  }, {
    label: "赤い彗星シャア編",
    value: "SB"
  }, {
    label: "ガンダムエース編",
    value: "CB1"
  }, {
    label: "ガンプラ30thメモリアルエディション",
    value: "CB2"
  }];
  const setIncludeExtraOptionsEX = [{
    label: "拡張シート",
    value: "EX1"
  }, {
    label: "拡張シートVer.2",
    value: "EX2"
  }, {
    label: "覇王の紋章 ジャンボカードダスVer.",
    value: "EX3"
  }, {
    label: "入門用スターター",
    value: "BS"
  }, {
    label: "オールウェイズビギニングセット",
    value: "EV"
  }, {
    label: "BIGガンスリンガーカード",
    value: "BG"
  }, {
    label: "コラボカード",
    value: "joke"
  }];
  const colorIncludeOptions = [{
    label: "青",
    value: 1
  }, {
    label: "緑",
    value: 2
  }, {
    label: "黒",
    value: 3
  }, {
    label: "赤",
    value: 4
  }, {
    label: "茶",
    value: 5
  }, {
    label: "白",
    value: 6
  }, {
    label: "紫",
    value: 7
  }];
  const colorExcludeOptions = [{
    label: "青でない",
    value: 1
  }, {
    label: "緑でない",
    value: 2
  }, {
    label: "黒でない",
    value: 3
  }, {
    label: "赤でない",
    value: 4
  }, {
    label: "茶でない",
    value: 5
  }, {
    label: "白でない",
    value: 6
  }, {
    label: "紫でない",
    value: 7
  }];
  return /*#__PURE__*/_jsxs("form", {
    onSubmit: handleSubmit,
    className: "grid-form",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "form-row",
      children: [/*#__PURE__*/_jsx("th", {
        htmlFor: "name",
        children: "\u30AB\u30FC\u30C9\u540D"
      }), /*#__PURE__*/_jsxs("div", {
        className: "input-group",
        children: [/*#__PURE__*/_jsx("input", {
          type: "text",
          name: "name",
          id: "name",
          className: "ntext",
          value: formValues.name,
          onChange: handleChange,
          size: "50"
        }), /*#__PURE__*/_jsxs("div", {
          className: "checkbox-inline",
          children: [/*#__PURE__*/_jsx("input", {
            type: "checkbox",
            name: "name_forward",
            id: "box_name_forward",
            value: "forward",
            checked: formValues.name_forward,
            onChange: handleChange
          }), /*#__PURE__*/_jsx("label", {
            htmlFor: "box_name_forward",
            children: "\u524D\u65B9\u4E00\u81F4"
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("details", {
      className: "search-accordion",
      open: !isCompactMobileSearch || openAccordions.basic,
      children: [/*#__PURE__*/_jsx("summary", {
        className: "search-accordion-summary",
        onClick: toggleAccordion("basic"),
        children: "\u57FA\u672C\u6761\u4EF6"
      }), /*#__PURE__*/_jsxs("div", {
        className: "search-accordion-panel",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u30AB\u30FC\u30C9\u30BF\u30A4\u30D7"
          }), /*#__PURE__*/_jsx("div", {
            className: "checkbox-group",
            children: [{
              label: "UNIT",
              value: 1
            }, {
              label: "CHARACTER",
              value: 2
            }, {
              label: "COMMAND",
              value: 3
            }, {
              label: "OPERATION",
              value: 4
            }, {
              label: "Generation",
              value: 10
            }, {
              label: "ACE",
              value: 11
            }].map(_ref3 => {
              let {
                label,
                value
              } = _ref3;
              return /*#__PURE__*/_jsxs("label", {
                children: [/*#__PURE__*/_jsx("input", {
                  type: "checkbox",
                  name: "cardType",
                  value: value,
                  checked: formValues.cardType.includes(String(value)),
                  onChange: handleChange
                }), label]
              }, value);
            })
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u8272"
          }), /*#__PURE__*/_jsx("td", {
            className: "c1",
            children: /*#__PURE__*/_jsxs("div", {
              className: isCompactMobileSearch ? "grid-2row-8col mobile-color-grid" : "grid-2row-8col",
              children: [isCompactMobileSearch ? colorIncludeOptions.map((_ref4, index) => {
                let {
                  label,
                  value
                } = _ref4;
                return /*#__PURE__*/_jsxs("div", {
                  className: "mobile-color-pair",
                  children: [/*#__PURE__*/_jsxs("label", {
                    className: "color-cell mobile-color-pair-option",
                    children: [/*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      name: "colorInclude",
                      value: value,
                      checked: formValues.colorInclude.includes(String(value)),
                      onChange: handleChange
                    }), label]
                  }), /*#__PURE__*/_jsxs("label", {
                    className: "color-cell mobile-color-pair-option",
                    children: [/*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      name: "colorExclude",
                      value: value,
                      checked: formValues.colorExclude.includes(String(value)),
                      onChange: handleChange
                    }), colorExcludeOptions[index].label]
                  })]
                }, `mobile-color-pair-${value}`);
              }) : /*#__PURE__*/_jsxs(_Fragment, {
                children: [colorIncludeOptions.map((_ref5, idx) => {
                  let {
                    label,
                    value
                  } = _ref5;
                  return /*#__PURE__*/_jsxs("label", {
                    className: "color-cell",
                    style: {
                      gridColumn: idx + 1,
                      gridRow: 1
                    },
                    children: [/*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      name: "colorInclude",
                      value: value,
                      checked: formValues.colorInclude.includes(String(value)),
                      onChange: handleChange
                    }), label]
                  }, `include-${value}`);
                }), colorExcludeOptions.map((_ref6, idx) => {
                  let {
                    label,
                    value
                  } = _ref6;
                  return /*#__PURE__*/_jsxs("label", {
                    className: "color-cell",
                    style: {
                      gridColumn: idx + 1,
                      gridRow: 2
                    },
                    children: [/*#__PURE__*/_jsx("input", {
                      type: "checkbox",
                      name: "colorExclude",
                      value: value,
                      checked: formValues.colorExclude.includes(String(value)),
                      onChange: handleChange
                    }), label]
                  }, `exclude-${value}`);
                })]
              }), /*#__PURE__*/_jsx("div", {
                className: "dropdown-cell",
                style: {
                  gridColumn: 8,
                  gridRow: '1 / span 2'
                },
                children: /*#__PURE__*/_jsxs("select", {
                  name: "colorMulti",
                  className: "nselect",
                  value: formValues.colorMulti,
                  onChange: handleChange,
                  children: [/*#__PURE__*/_jsx("option", {
                    value: "able",
                    children: "\u591A\u8272\u3092\u542B\u3093\u3067\u3082\u3088\u3044"
                  }), /*#__PURE__*/_jsx("option", {
                    value: "not",
                    children: "\u591A\u8272\u3092\u9664\u304F"
                  })]
                })
              })]
            })
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsxs("th", {
            children: ["\u30AB\u30FC\u30C9", /*#__PURE__*/_jsx("br", {}), "\u30C6\u30AD\u30B9\u30C8"]
          }), /*#__PURE__*/_jsx("input", {
            type: "text",
            name: "text",
            className: "ntext",
            placeholder: "\u30B9\u30DA\u30FC\u30B9\u533A\u5207\u308A\u3067AND\u691C\u7D22",
            value: formValues.text,
            onChange: handleChange
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("details", {
      className: "search-accordion",
      open: !isCompactMobileSearch || openAccordions.numeric,
      children: [/*#__PURE__*/_jsx("summary", {
        className: "search-accordion-summary",
        onClick: toggleAccordion("numeric"),
        children: "\u6570\u5024\u30FB\u5730\u5F62\u6761\u4EF6"
      }), /*#__PURE__*/_jsxs("div", {
        className: "search-accordion-panel",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u56FD\u529B"
          }), /*#__PURE__*/_jsxs("div", {
            className: "inline-container four-col",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "inline-group",
              children: [/*#__PURE__*/_jsxs("select", {
                name: "spCostMin",
                className: "nselect number-select",
                value: formValues.spCostMin,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions1.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              }), /*#__PURE__*/_jsx("span", {
                children: "\u2266 \u6307\u5B9A \u2266"
              }), /*#__PURE__*/_jsxs("select", {
                name: "spCostMax",
                className: "nselect number-select",
                value: formValues.spCostMax,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions1.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "inline-group",
              children: [/*#__PURE__*/_jsxs("select", {
                name: "totalCostMin",
                className: "nselect number-select",
                value: formValues.totalCostMin,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions2.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              }), /*#__PURE__*/_jsx("span", {
                children: "\u2266 \u5408\u8A08 \u2266"
              }), /*#__PURE__*/_jsxs("select", {
                name: "totalCostMax",
                className: "nselect number-select",
                value: formValues.totalCostMax,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions2.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "inline-group",
              children: [/*#__PURE__*/_jsxs("select", {
                name: "resourceCostMin",
                className: "nselect number-select",
                value: formValues.resourceCostMin,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions3.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              }), /*#__PURE__*/_jsx("span", {
                children: "\u2266 \u8CC7\u6E90 \u2266"
              }), /*#__PURE__*/_jsxs("select", {
                name: "resourceCostMax",
                className: "nselect number-select",
                value: formValues.resourceCostMax,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions3.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              })]
            }), /*#__PURE__*/_jsx("div", {
              className: "inline-group",
              children: /*#__PURE__*/_jsxs("label", {
                className: "checkbox-inline",
                children: [/*#__PURE__*/_jsx("input", {
                  type: "checkbox",
                  name: "includeUndecided",
                  checked: formValues.includeUndecided,
                  onChange: handleChange
                }), "X\u3082\u542B\u3080"]
              })
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u6226\u95D8\u4FEE\u6B63"
          }), /*#__PURE__*/_jsxs("div", {
            className: "inline-container four-col",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "inline-group",
              children: [/*#__PURE__*/_jsxs("select", {
                name: "fightMin",
                className: "nselect number-select",
                value: formValues.fightMin,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              }), /*#__PURE__*/_jsx("span", {
                children: "\u2266 \u683C\u95D8 \u2266"
              }), /*#__PURE__*/_jsxs("select", {
                name: "fightMax",
                className: "nselect number-select",
                value: formValues.fightMax,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "inline-group",
              children: [/*#__PURE__*/_jsxs("select", {
                name: "shootMin",
                className: "nselect number-select",
                value: formValues.shootMin,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              }), /*#__PURE__*/_jsx("span", {
                children: "\u2266 \u5C04\u6483 \u2266"
              }), /*#__PURE__*/_jsxs("select", {
                name: "shootMax",
                className: "nselect number-select",
                value: formValues.shootMax,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "inline-group",
              children: [/*#__PURE__*/_jsxs("select", {
                name: "defenseMin",
                className: "nselect number-select",
                value: formValues.defenseMin,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              }), /*#__PURE__*/_jsx("span", {
                children: "\u2266 \u9632\u5FA1 \u2266"
              }), /*#__PURE__*/_jsxs("select", {
                name: "defenseMax",
                className: "nselect number-select",
                value: formValues.defenseMax,
                onChange: handleChange,
                children: [/*#__PURE__*/_jsx("option", {
                  value: "",
                  children: "\u6307\u5B9A\u306A\u3057"
                }), numericOptions.map(n => /*#__PURE__*/_jsx("option", {
                  value: n.value,
                  children: n.label
                }, n.value))]
              })]
            }), /*#__PURE__*/_jsx("div", {
              className: "inline-group",
              children: /*#__PURE__*/_jsxs("label", {
                className: "checkbox-inline",
                children: [/*#__PURE__*/_jsx("input", {
                  type: "checkbox",
                  name: "includeAltStats",
                  checked: formValues.includeAltStats,
                  onChange: handleChange
                }), "\u5909\u5F62\u72B6\u614B\u3092\u542B\u3081\u308B"]
              })
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u5730\u5F62\u9069\u6B63"
          }), /*#__PURE__*/_jsx("div", {
            className: "checkbox-group",
            children: ["宇宙", "地球"].map(terrain => /*#__PURE__*/_jsxs("label", {
              children: [/*#__PURE__*/_jsx("input", {
                type: "checkbox",
                name: "terrain",
                value: terrain,
                checked: formValues.terrain.includes(terrain),
                onChange: handleChange
              }), terrain]
            }, terrain))
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("details", {
      className: "search-accordion",
      open: !isCompactMobileSearch || openAccordions.features,
      children: [/*#__PURE__*/_jsx("summary", {
        className: "search-accordion-summary",
        onClick: toggleAccordion("features"),
        children: "\u7279\u5FB4\u6761\u4EF6"
      }), /*#__PURE__*/_jsxs("div", {
        className: "search-accordion-panel",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsxs("th", {
            children: ["UNIT", /*#__PURE__*/_jsx("br", {}), "\u7279\u5FB4\u6307\u5B9A"]
          }), /*#__PURE__*/_jsxs("td", {
            className: "c1",
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '1em' // チェックボックス行とセレクトボックス行の余白
            },
            children: [/*#__PURE__*/_jsx("div", {
              className: "checkbox-group",
              children: [{
                label: "MS",
                value: "mobileSuits"
              }, {
                label: "MA",
                value: "mobileArmor"
              }, {
                label: "MF",
                value: "mobileFighter"
              }, {
                label: "コンビ",
                value: "combi"
              }, {
                label: "Lサイズ",
                value: "largeSize"
              }, {
                label: "艦艇",
                value: "warship"
              }].map(_ref7 => {
                let {
                  label,
                  value
                } = _ref7;
                return /*#__PURE__*/_jsxs("label", {
                  style: {
                    marginRight: "1em"
                  },
                  children: [/*#__PURE__*/_jsx("input", {
                    type: "checkbox",
                    name: "unitFeature",
                    value: value,
                    checked: formValues.unitFeature.includes(String(value)),
                    onChange: handleChange
                  }), label]
                }, value);
              })
            }), /*#__PURE__*/_jsx("div", {
              className: "select-group",
              children: /*#__PURE__*/_jsx(Select, {
                isMulti: true,
                name: "unitFeatureExtra",
                options: unitExtraOptions,
                value: formValues.unitFeatureExtra,
                onChange: selectedOptions => setFormValues(prev => ({
                  ...prev,
                  unitFeatureExtra: selectedOptions || []
                })),
                placeholder: "\u8FFD\u52A0\u7279\u5FB4\u3092\u9078\u629E"
              })
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsxs("th", {
            children: ["CHARACTER", /*#__PURE__*/_jsx("br", {}), "\u7279\u5FB4\u6307\u5B9A"]
          }), /*#__PURE__*/_jsxs("td", {
            className: "c1",
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '1em' // チェックボックス行とセレクトボックス行の余白
            },
            children: [/*#__PURE__*/_jsx("div", {
              className: "checkbox-group",
              children: [{
                label: "男性",
                value: "male"
              }, {
                label: "女性",
                value: "female"
              }, {
                label: "大人",
                value: "adult"
              }, {
                label: "子供",
                value: "child"
              }, {
                label: "NT",
                value: "newType"
              }, {
                label: "CO",
                value: "coordinator"
              }, {
                label: "GF",
                value: "gundamFighter"
              }].map(_ref8 => {
                let {
                  label,
                  value
                } = _ref8;
                return /*#__PURE__*/_jsxs("label", {
                  style: {
                    marginRight: "1em"
                  },
                  children: [/*#__PURE__*/_jsx("input", {
                    type: "checkbox",
                    name: "charFeature",
                    value: value,
                    checked: formValues.charFeature.includes(String(value)),
                    onChange: handleChange
                  }), label]
                }, value);
              })
            }), /*#__PURE__*/_jsx("div", {
              className: "select-group",
              children: /*#__PURE__*/_jsx(Select, {
                isMulti: true,
                name: "charFeatureExtra",
                options: characterExtraOptions,
                value: formValues.charFeatureExtra,
                onChange: selectedOptions => handleSelectChange("charFeatureExtra", selectedOptions),
                placeholder: "\u8FFD\u52A0\u7279\u5FB4\u3092\u9078\u629E"
              })
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsxs("th", {
            children: ["\u305D\u306E\u4ED6", /*#__PURE__*/_jsx("br", {}), "\u7279\u5FB4\u6307\u5B9A"]
          }), /*#__PURE__*/_jsx("div", {
            className: "checkbox-group",
            children: [{
              label: "移動",
              value: "move"
            }, {
              label: "回復",
              value: "recover"
            }, {
              label: "強化",
              value: "enhance"
            }, {
              label: "再生",
              value: "regenerate"
            }, {
              label: "支配",
              value: "control"
            }, {
              label: "束縛",
              value: "bind"
            }, {
              label: "対抗",
              value: "counter"
            }, {
              label: "展開",
              value: "deploy"
            }, {
              label: "破壊",
              value: "destroy"
            }, {
              label: "補強",
              value: "reinforce"
            }, {
              label: "兵装",
              value: "equipment"
            }].map(_ref9 => {
              let {
                label,
                value
              } = _ref9;
              return /*#__PURE__*/_jsxs("label", {
                children: [/*#__PURE__*/_jsx("input", {
                  type: "checkbox",
                  name: "otherFeature",
                  value: value,
                  checked: formValues.otherFeature.includes(String(value)),
                  onChange: handleChange
                }), label]
              }, value);
            })
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u6240\u5C5E/\u7CFB\u7D71"
          }), /*#__PURE__*/_jsx("input", {
            type: "text",
            name: "traitText",
            className: "ntext",
            placeholder: "\u30B9\u30DA\u30FC\u30B9\u533A\u5207\u308A\u3067AND\u691C\u7D22\uFF08\u4F8B\uFF1A\u3007\u3007\u7CFB \u30B8\u30AA\u30F3\uFF09",
            value: formValues.traitText,
            onChange: handleChange
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsxs("th", {
            children: ["\u7279\u5FB4\u306E", /*#__PURE__*/_jsx("br", {}), "\u4E00\u81F4\u6761\u4EF6"]
          }), /*#__PURE__*/_jsxs("select", {
            name: "traits_logic",
            className: "nselect",
            value: formValues.traits_logic,
            onChange: handleChange,
            children: [/*#__PURE__*/_jsx("option", {
              value: "and",
              children: "\u3059\u3079\u3066\u306E\u7279\u5FB4\u3092\u542B\u3080"
            }), /*#__PURE__*/_jsx("option", {
              value: "or",
              children: "\u3044\u305A\u308C\u304B\u306E\u7279\u5FB4\u3092\u542B\u3080"
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u5C02\u7528"
          }), /*#__PURE__*/_jsx("input", {
            type: "text",
            name: "exclusivePilotText",
            className: "ntext",
            placeholder: "\u30D1\u30A4\u30ED\u30C3\u30C8\u540D",
            value: formValues.exclusivePilotText,
            onChange: handleChange
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("details", {
      className: "search-accordion",
      open: !isCompactMobileSearch || openAccordions.build,
      children: [/*#__PURE__*/_jsx("summary", {
        className: "search-accordion-summary",
        onClick: toggleAccordion("build"),
        children: "\u53CE\u9332\u30FB\u69CB\u7BC9\u6761\u4EF6"
      }), /*#__PURE__*/_jsxs("div", {
        className: "search-accordion-panel",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u69CB\u7BC9\u7BC4\u56F2"
          }), /*#__PURE__*/_jsxs("div", {
            className: "inline-group deck-range-group",
            children: [/*#__PURE__*/_jsxs("label", {
              children: [/*#__PURE__*/_jsx("input", {
                type: "radio",
                name: "deckRangeType",
                value: "none",
                checked: formValues.deckRangeType === 'none',
                onChange: handleChange
              }), "\u6307\u5B9A\u306A\u3057"]
            }), /*#__PURE__*/_jsxs("label", {
              children: [/*#__PURE__*/_jsx("input", {
                type: "radio",
                name: "deckRangeType",
                value: "tensaku",
                checked: formValues.deckRangeType === 'tensaku',
                onChange: handleChange
              }), "\u6DFB\u524A\u676F"]
            }), /*#__PURE__*/_jsxs("label", {
              children: [/*#__PURE__*/_jsx("input", {
                type: "radio",
                name: "deckRangeType",
                value: "classic",
                checked: formValues.deckRangeType === 'classic',
                onChange: handleChange
              }), "\u30AF\u30E9\u30B7\u30C3\u30AF"]
            }), /*#__PURE__*/_jsxs("label", {
              children: [/*#__PURE__*/_jsx("input", {
                type: "radio",
                name: "deckRangeType",
                value: "rising",
                checked: formValues.deckRangeType === 'rising',
                onChange: handleChange
              }), "\u30E9\u30A4\u30B8\u30F3\u30B0"]
            }), formValues.deckRangeType === 'tensaku' && /*#__PURE__*/_jsxs("select", {
              name: "deckRangeDetail",
              className: "ntext",
              value: formValues.deckRangeDetail,
              onChange: handleChange,
              style: {
                marginLeft: '8px'
              },
              children: [/*#__PURE__*/_jsx("option", {
                value: "",
                children: "\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"
              }), /*#__PURE__*/_jsx("option", {
                value: "2010-03-09",
                children: "\u7B2C9\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2009-08-09",
                children: "\u7B2C8\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2009-02-19",
                children: "\u7B2C7\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2008-02-28",
                children: "\u7B2C6\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2007-08-31",
                children: "\u7B2C5\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2007-02-28",
                children: "\u7B2C4\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2006-08-31",
                children: "\u7B2C3\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2006-02-28",
                children: "\u7B2C2\u56DE \u6DFB\u524A\u676F"
              }), /*#__PURE__*/_jsx("option", {
                value: "2005-08-31",
                children: "\u7B2C1\u56DE \u6DFB\u524A\u676F"
              })]
            })]
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "form-row",
          children: [/*#__PURE__*/_jsx("th", {
            children: "\u53CE\u9332\u5F3E"
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("div", {
              className: "checkbox-grid6",
              children: [{
                label: "GUNDAM WAR",
                value: "1st"
              }, {
                label: "撃墜王出撃",
                value: "2nd"
              }, {
                label: "宇宙の記憶",
                value: "3rd"
              }, {
                label: "新しき翼",
                value: "4th"
              }, {
                label: "永久の絆",
                value: "5th"
              }, {
                label: "新世紀の鼓動",
                value: "6th"
              }, {
                label: "革新の波濤",
                value: "7th"
              }, {
                label: "月下の戦塵",
                value: "8th"
              }, {
                label: "相剋の軌跡",
                value: "9th"
              }, {
                label: "刻の末裔",
                value: "10th"
              }, {
                label: "蒼海の死闘",
                value: "11th"
              }, {
                label: "宿命の螺旋",
                value: "12th"
              }, {
                label: "烈火の咆哮",
                value: "13th"
              }, {
                label: "果てなき運命",
                value: "14th"
              }, {
                label: "禁忌の胎動",
                value: "15th"
              }, {
                label: "覇王の紋章",
                value: "16th"
              }, {
                label: "不敗の流派",
                value: "17th"
              }, {
                label: "戦慄の兵威",
                value: "18th"
              }, {
                label: "変革の叛旗",
                value: "19th"
              }, {
                label: "流転する世界",
                value: "20th"
              }, {
                label: "放たれた刃",
                value: "21st"
              }, {
                label: "武神降臨",
                value: "22nd"
              }, {
                label: "栄光の戦史",
                value: "23rd"
              }, {
                label: "宇宙を駆逐する光",
                value: "24th"
              }, {
                label: "双極の閃光",
                value: "25th"
              }, {
                label: "戦いという名の対話",
                value: "26th"
              }, {
                label: "雷鳴の使徒",
                value: "27th"
              }, {
                label: "絶対戦力",
                value: "28th"
              }, {
                label: "プロモカード",
                value: "PR"
              }].map(_ref10 => {
                let {
                  label,
                  value
                } = _ref10;
                return /*#__PURE__*/_jsxs("label", {
                  children: [/*#__PURE__*/_jsx("input", {
                    type: "checkbox",
                    name: "setIncluded",
                    value: value,
                    checked: formValues.setIncluded.includes(String(value)),
                    onChange: handleChange
                  }), label]
                }, value);
              })
            }), /*#__PURE__*/_jsxs("div", {
              className: "select-row",
              children: [/*#__PURE__*/_jsx(Select, {
                isMulti: true,
                name: "setFeatureExtraBB",
                options: setIncludeExtraOptionsBB,
                value: formValues.setFeatureExtraBB,
                onChange: selectedOptions => handleSelectChange("setFeatureExtraBB", selectedOptions),
                placeholder: "BB/EB"
              }), /*#__PURE__*/_jsx(Select, {
                isMulti: true,
                name: "setFeatureExtraST",
                options: setIncludeExtraOptionsST,
                value: formValues.setFeatureExtraST,
                onChange: selectedOptions => handleSelectChange("setFeatureExtraST", selectedOptions),
                placeholder: "\u30B9\u30BF\u30FC\u30BF\u30FC"
              }), /*#__PURE__*/_jsx(Select, {
                isMulti: true,
                name: "setFeatureExtraDB",
                options: setIncludeExtraOptionsDB,
                value: formValues.setFeatureExtraDB,
                onChange: selectedOptions => handleSelectChange("setFeatureExtraDB", selectedOptions),
                placeholder: "\u7279\u6B8A\u30D6\u30FC\u30B9\u30BF\u30FC"
              }), /*#__PURE__*/_jsx(Select, {
                isMulti: true,
                name: "setFeatureExtraEX",
                options: setIncludeExtraOptionsEX,
                value: formValues.setFeatureExtraEX,
                onChange: selectedOptions => handleSelectChange("setFeatureExtraEX", selectedOptions),
                placeholder: "\u305D\u306E\u4ED6"
              })]
            })]
          })]
        })]
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "form-row",
      children: [/*#__PURE__*/_jsx("th", {
        children: "\u8868\u793A\u4EF6\u6570"
      }), /*#__PURE__*/_jsx("select", {
        name: "pageSize",
        className: "nselect",
        value: formValues.pageSize,
        onChange: handleChange,
        children: [10, 20, 50, 100, 200].map(size => /*#__PURE__*/_jsxs("option", {
          value: size,
          children: [size, "\u4EF6"]
        }, size))
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "form-row",
      children: [/*#__PURE__*/_jsx("label", {}), " ", /*#__PURE__*/_jsx("div", {
        className: "button-cell",
        children: /*#__PURE__*/_jsxs("div", {
          className: "button-group",
          children: [/*#__PURE__*/_jsxs("button", {
            type: "submit",
            className: "search",
            children: [/*#__PURE__*/_jsx("span", {
              className: "owl-sprite-16-black icon-search"
            }), "\u691C\u7D22"]
          }), /*#__PURE__*/_jsxs("button", {
            type: "reset",
            className: "reset",
            onClick: handleReset,
            children: [/*#__PURE__*/_jsx("span", {
              className: "owl-sprite-16-black icon-delete"
            }), "\u30EA\u30BB\u30C3\u30C8"]
          })]
        })
      })]
    })]
  });
};
export default SearchForm;
