import React, { useState } from 'react';

// 初期状態（すべてのフィールドを網羅）
const initialState = {
  // エキスパンション（複数選択：name="or60"）
  or60: [],
  // 勢力（複数選択：name="or1"）
  or1: [],
  // カード種（複数選択：name="or2,64"）
  "or2,64": [],
  // レアリティ（複数選択：name="or4"）
  or4: [],
  // 指定国力
  up5: "",
  down5: "",
  // 格闘
  up38: "",
  down38: "",
  // 合計国力
  up6: "",
  down6: "",
  // 射撃
  up39: "",
  down39: "",
  // 資源コスト
  up7: "",
  down7: "",
  // 防御
  up40: "",
  down40: "",
  // 性別・年齢・特徴
  keys57: "",
  keys58: "",
  keys59: "",
  // 地形適性（複数選択：name="or8"）
  or8: [],
  // 特殊テキスト選択（and検索：各項目は単一チェックボックス、true/false）
  keys9: false,
  keys10: false,
  keys18: false,
  keys11: false,
  keys27: false,
  keys15: false,
  keys16: false,
  "keys13,53": false,
  keys14: false,
  "keys19,51": false,
  "keys20,54": false,
  keys23: false,
  "keys26,48": false,
  "keys21,52": false,
  "keys22,49": false,
  keys17: false,
  keys25: false,
  "keys30,46": false,
  keys12: false,
  keys24: false,
  "keys31,55": false,
  keys28: false,
  keys29: false,
  keys33: false,
  keys34: false,
  keys35: false,
  keys32: false,
  // カード名称から検索
  keys3: "",
  // カードテキストから検索
  "keys36,42": "",
  // キーワードで検索
  IDv001: "",
  IDn001: "and",
  // 検索条件
  word: "0",
  // 表示件数
  print: "20",
  // 再録（ラジオ：""=表示, "O"=非表示, "R"=再録のみ表示）
  keys63: ""
};

const SearchForm = ({ onSearch }) => {
  const [formValues, setFormValues] = useState(initialState);

  // 共通の onChange ハンドラ
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // 複数選択のチェックボックスの場合（name が or60, or1, or2,64, or4, or8）
    if (type === "checkbox" && ["or60", "or1", "or2,64", "or4", "or8"].includes(name)) {
      setFormValues((prev) => {
        const current = prev[name] || [];
        if (checked) {
          return { ...prev, [name]: [...current, value] };
        } else {
          return { ...prev, [name]: current.filter((v) => v !== value) };
        }
      });
    } else if (type === "checkbox") {
      // 単一チェックボックス（true/false）
      setFormValues((prev) => ({ ...prev, [name]: checked }));
    } else {
      // テキスト、select、radio
      setFormValues((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 検索条件を JSON 表現として親コンポーネントに渡す
    onSearch(formValues);
  };

  const handleReset = () => {
    setFormValues(initialState);
  };

  return (
    <div id="container">
      {/* ヘッダー部（画像、戻るリンク、hr など） */}

      <hr color="#009563" noshade="noshade" width="92%" size="14" />

      <a name="#database" />
      <div className="sub_tit">■GUNDAM WAR DATABASE■</div>

      {/* フォーム全体 */}
      <form onSubmit={handleSubmit}>
        {/* ※ form をテーブルの外側に配置して、内部にテーブルレイアウトを使用 */}
        <table align="center" width="85%" cellPadding="4">
          <tbody>
            {/* エキスパンション */}
            <tr>
              <td className="cell_b">
                エキスパンション
                <br />
                （or検索）
              </td>
              <td colSpan="3">
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="01"
                    onChange={handleChange}
                    checked={formValues.or60.includes("01")}
                  />
                  第一弾
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="02"
                    onChange={handleChange}
                    checked={formValues.or60.includes("02")}
                  />
                  撃墜王出撃！
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="04"
                    onChange={handleChange}
                    checked={formValues.or60.includes("04")}
                  />
                  宇宙の記憶
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="06"
                    onChange={handleChange}
                    checked={formValues.or60.includes("06")}
                  />
                  新しき翼
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="08"
                    onChange={handleChange}
                    checked={formValues.or60.includes("08")}
                  />
                  永久の絆
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="10"
                    onChange={handleChange}
                    checked={formValues.or60.includes("10")}
                  />
                  新世紀の鼓動
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="12"
                    onChange={handleChange}
                    checked={formValues.or60.includes("12")}
                  />
                  革新の波濤
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="14"
                    onChange={handleChange}
                    checked={formValues.or60.includes("14")}
                  />
                  月下の戦塵
                </label>
                <br />
                {/* 以下、省略せず全て追加 */}
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="16"
                    onChange={handleChange}
                    checked={formValues.or60.includes("16")}
                  />
                  相克の軌跡
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="18"
                    onChange={handleChange}
                    checked={formValues.or60.includes("18")}
                  />
                  刻の末裔
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="21"
                    onChange={handleChange}
                    checked={formValues.or60.includes("21")}
                  />
                  蒼海の死闘
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="23"
                    onChange={handleChange}
                    checked={formValues.or60.includes("23")}
                  />
                  宿命の螺旋
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="25"
                    onChange={handleChange}
                    checked={formValues.or60.includes("25")}
                  />
                  烈火の咆哮
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="29"
                    onChange={handleChange}
                    checked={formValues.or60.includes("29")}
                  />
                  果てなき運命
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="32"
                    onChange={handleChange}
                    checked={formValues.or60.includes("32")}
                  />
                  禁忌の胎動
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="36"
                    onChange={handleChange}
                    checked={formValues.or60.includes("36")}
                  />
                  覇王の紋章
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="13"
                    onChange={handleChange}
                    checked={formValues.or60.includes("13")}
                  />
                  BB
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="17"
                    onChange={handleChange}
                    checked={formValues.or60.includes("17")}
                  />
                  BB 2
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="24"
                    onChange={handleChange}
                    checked={formValues.or60.includes("24")}
                  />
                  BB 3
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="09"
                    onChange={handleChange}
                    checked={formValues.or60.includes("09")}
                  />
                  一年戦争編
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="11"
                    onChange={handleChange}
                    checked={formValues.or60.includes("11")}
                  />
                  Ｗ/∀編
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="20"
                    onChange={handleChange}
                    checked={formValues.or60.includes("20")}
                  />
                  SEED編
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="27"
                    onChange={handleChange}
                    checked={formValues.or60.includes("27")}
                  />
                  戦場の女神
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="31"
                    onChange={handleChange}
                    checked={formValues.or60.includes("31")}
                  />
                  DESTINY編
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="22"
                    onChange={handleChange}
                    checked={formValues.or60.includes("22")}
                  />
                  エース編
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="33"
                    onChange={handleChange}
                    checked={formValues.or60.includes("33")}
                  />
                  劇場版Z編
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="26"
                    onChange={handleChange}
                    checked={formValues.or60.includes("26")}
                  />
                  拡張シート1
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="28"
                    onChange={handleChange}
                    checked={formValues.or60.includes("28")}
                  />
                  拡張シート2
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="03"
                    onChange={handleChange}
                    checked={formValues.or60.includes("03")}
                  />
                  DS 1
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="07"
                    onChange={handleChange}
                    checked={formValues.or60.includes("07")}
                  />
                  DS 2
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="15"
                    onChange={handleChange}
                    checked={formValues.or60.includes("15")}
                  />
                  DS ギレンの野望編
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="19"
                    onChange={handleChange}
                    checked={formValues.or60.includes("19")}
                  />
                  DS 栄光のザフト
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="30"
                    onChange={handleChange}
                    checked={formValues.or60.includes("30")}
                  />
                  DS 閃光のミネルバ
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="34"
                    onChange={handleChange}
                    checked={formValues.or60.includes("34")}
                  />
                  TS 疾風の砲火
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="35"
                    onChange={handleChange}
                    checked={formValues.or60.includes("35")}
                  />
                  TS 戦乱の兇刃
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or60"
                    value="05"
                    onChange={handleChange}
                    checked={formValues.or60.includes("05")}
                  />
                  プロモ
                </label>
              </td>
            </tr>

            {/* 勢力 */}
            <tr>
              <td className="cell_a">
                勢力
                <br />
                （or検索）
              </td>
              <td colSpan="3">
                {["連邦", "ジオン公国", "ティターンズ", "ザンスカール", "ネオジオン", "クロスボーン", "∀", "Ｘ", "Ｇ", "Ｗ", "SEED", "その他"].map((faction) => (
                  <label key={faction}>
                    <input
                      type="checkbox"
                      name="or1"
                      value={faction}
                      onChange={handleChange}
                      checked={formValues.or1.includes(faction)}
                    />
                    {faction}
                  </label>
                ))}
              </td>
            </tr>

            {/* カード種 */}
            <tr>
              <td className="cell_b">
                カード種
                <br />
                （or検索）
              </td>
              <td colSpan="3">
                <label>
                  <input
                    type="checkbox"
                    name="or2,64"
                    value="U- SP- OL-"
                    onChange={handleChange}
                    checked={formValues["or2,64"].includes("U- SP- OL-")}
                  />
                  ユニット
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or2,64"
                    value="CH-"
                    onChange={handleChange}
                    checked={formValues["or2,64"].includes("CH-")}
                  />
                  キャラクター
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or2,64"
                    value="C-"
                    onChange={handleChange}
                    checked={formValues["or2,64"].includes("C-")}
                  />
                  コマンド
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    name="or2,64"
                    value="O-"
                    onChange={handleChange}
                    checked={formValues["or2,64"].includes("O-")}
                  />
                  オペレーション
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="or2,64"
                    value="G-"
                    onChange={handleChange}
                    checked={formValues["or2,64"].includes("G-")}
                  />
                  ジェネレーション
                </label>
              </td>
            </tr>

            {/* レアリティ */}
            <tr>
              <td className="cell_a">
                レアリティ
                <br />
                （or検索）
              </td>
              <td colSpan="3">
                {["Rare", "Un", "Common", "SP", "SR"].map((r) => (
                  <label key={r}>
                    <input
                      type="checkbox"
                      name="or4"
                      value={r}
                      onChange={handleChange}
                      checked={formValues.or4.includes(r)}
                    />
                    {r === "Rare" ? "レア" : r === "Un" ? "アンコモン" : r === "Common" ? "コモン" : r === "SP" ? "プロモ" : "シークレットレア"}
                  </label>
                ))}
              </td>
            </tr>

            {/* 指定国力 */}
            <tr>
              <td className="cell_b">指定国力</td>
              <td>
                <select name="up5" size="1" value={formValues.up5} onChange={handleChange}>
                  <option value=""></option>
                  {["1", "2", "3", "4"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以上
                <select name="down5" size="1" value={formValues.down5} onChange={handleChange}>
                  <option value=""></option>
                  {["1", "2", "3", "4"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以下
              </td>

              <td className="cell_b">格闘</td>
              <td>
                <select name="up38" size="1" value={formValues.up38} onChange={handleChange}>
                  <option value=""></option>
                  {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以上
                <select name="down38" size="1" value={formValues.down38} onChange={handleChange}>
                  <option value=""></option>
                  {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以下
              </td>
            </tr>

            {/* 合計国力 / 射撃 */}
            <tr>
              <td className="cell_a">合計国力</td>
              <td>
                <select name="up6" size="1" value={formValues.up6} onChange={handleChange}>
                  <option value=""></option>
                  {["1","2","3","4","5","6","7","8","9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以上
                <select name="down6" size="1" value={formValues.down6} onChange={handleChange}>
                  <option value=""></option>
                  {["1","2","3","4","5","6","7","8","9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以下
              </td>
              <td className="cell_a">射撃</td>
              <td>
                <select name="up39" size="1" value={formValues.up39} onChange={handleChange}>
                  <option value=""></option>
                  {["0","1","2","3","4","5","6","7","8","9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以上
                <select name="down39" size="1" value={formValues.down39} onChange={handleChange}>
                  <option value=""></option>
                  {["0","1","2","3","4","5","6","7","8","9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以下
              </td>
            </tr>

            {/* 資源コスト / 防御 */}
            <tr>
              <td className="cell_b">資源コスト</td>
              <td>
                <select name="up7" size="1" value={formValues.up7} onChange={handleChange}>
                  <option value=""></option>
                  {["1","2","3","4","5","6"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以上
                <select name="down7" size="1" value={formValues.down7} onChange={handleChange}>
                  <option value=""></option>
                  {["1","2","3","4","5","6"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以下
              </td>
              <td className="cell_b">防御</td>
              <td>
                <select name="up40" size="1" value={formValues.up40} onChange={handleChange}>
                  <option value=""></option>
                  {["0","1","2","3","4","5","6","7","8","9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以上
                <select name="down40" size="1" value={formValues.down40} onChange={handleChange}>
                  <option value=""></option>
                  {["0","1","2","3","4","5","6","7","8","9"].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                以下
              </td>
            </tr>

            {/* 性別・年齢・特徴 */}
            <tr>
              <td className="cell_a">性別・年齢・特徴</td>
              <td colSpan="3">
                <select name="keys57" size="1" value={formValues.keys57} onChange={handleChange}>
                  <option value=""></option>
                  <option value="M">男性</option>
                  <option value="F">女性</option>
                </select>
                <select name="keys58" size="1" value={formValues.keys58} onChange={handleChange}>
                  <option value=""></option>
                  <option value="Ad">大人</option>
                  <option value="Ch">子供</option>
                </select>
                <select name="keys59" size="1" value={formValues.keys59} onChange={handleChange}>
                  <option value=""></option>
                  <option value="NT">NT</option>
                  <option value="CO">CO</option>
                  <option value="GF">GF</option>
                </select>
              </td>
            </tr>

            {/* 地形適性 */}
            <tr>
              <td className="cell_b">地形適性（or検索）</td>
              <td colSpan="3">
                {["宇宙", "地球", "宇地"].map((val) => (
                  <label key={val}>
                    <input
                      type="checkbox"
                      name="or8"
                      value={val}
                      onChange={handleChange}
                      checked={formValues.or8.includes(val)}
                    />
                    {val}
                  </label>
                ))}
              </td>
            </tr>

            {/* 特殊テキスト選択（and検索） */}
            <tr>
              <td className="cell_a">
                特殊テキスト選択
                <br />
                （and検索）
              </td>
              <td colSpan="3">
                <label>
                  <input type="checkbox" name="keys9" onChange={handleChange} checked={formValues.keys9} />
                  1枚制限
                </label>
                <label>
                  <input type="checkbox" name="keys10" onChange={handleChange} checked={formValues.keys10} />
                  プリベント
                </label>
                <label>
                  <input type="checkbox" name="keys18" onChange={handleChange} checked={formValues.keys18} />
                  クイック
                </label>
                <label>
                  <input type="checkbox" name="keys11" onChange={handleChange} checked={formValues.keys11} />
                  PS装甲
                </label>
                <label>
                  <input type="checkbox" name="keys27" onChange={handleChange} checked={formValues.keys27} />
                  MF
                </label>
                <br />
                <label>
                  <input type="checkbox" name="keys15" onChange={handleChange} checked={formValues.keys15} />
                  強襲
                </label>
                <label>
                  <input type="checkbox" name="keys16" onChange={handleChange} checked={formValues.keys16} />
                  速攻
                </label>
                <label>
                  <input type="checkbox" name="keys13,53" onChange={handleChange} checked={formValues["keys13,53"]} />
                  バルチャー
                </label>
                <label>
                  <input type="checkbox" name="keys14" onChange={handleChange} checked={formValues.keys14} />
                  宙間戦闘
                </label>
                <br />
                <label>
                  <input type="checkbox" name="keys19,51" onChange={handleChange} checked={formValues["keys19,51"]} />
                  大気圏突入
                </label>
                <label>
                  <input type="checkbox" name="keys20,54" onChange={handleChange} checked={formValues["keys20,54"]} />
                  範囲兵器
                </label>
                <label>
                  <input type="checkbox" name="keys23" onChange={handleChange} checked={formValues.keys23} />
                  サイコミュ
                </label>
                <label>
                  <input type="checkbox" name="keys26,48" onChange={handleChange} checked={formValues["keys26,48"]} />
                  高機動
                </label>
                <br />
                <label>
                  <input type="checkbox" name="keys21,52" onChange={handleChange} checked={formValues["keys21,52"]} />
                  砂漠
                </label>
                <label>
                  <input type="checkbox" name="keys22,49" onChange={handleChange} checked={formValues["keys22,49"]} />
                  水
                </label>
                <label>
                  <input type="checkbox" name="keys17" onChange={handleChange} checked={formValues.keys17} />
                  タイヤ
                </label>
                <label>
                  <input type="checkbox" name="keys25" onChange={handleChange} checked={formValues.keys25} />
                  変形
                </label>
                <label>
                  <input type="checkbox" name="keys30,46" onChange={handleChange} checked={formValues["keys30,46"]} />
                  特殊シールド
                </label>
                <br />
                <label>
                  <input type="checkbox" name="keys12" onChange={handleChange} checked={formValues.keys12} />
                  サポート
                </label>
                <label>
                  <input type="checkbox" name="keys24" onChange={handleChange} checked={formValues.keys24} />
                  拠点
                </label>
                <label>
                  <input type="checkbox" name="keys31,55" onChange={handleChange} checked={formValues["keys31,55"]} />
                  コロニー
                </label>
                <label>
                  <input type="checkbox" name="keys28" onChange={handleChange} checked={formValues.keys28} />
                  艦船
                </label>
                <label>
                  <input type="checkbox" name="keys29" onChange={handleChange} checked={formValues.keys29} />
                  補給
                </label>
                <br />
                <label>
                  <input type="checkbox" name="keys33" onChange={handleChange} checked={formValues.keys33} />
                  【セット/Ｘ】
                </label>
                <label>
                  <input type="checkbox" name="keys34" onChange={handleChange} checked={formValues.keys34} />
                  家名
                </label>
                <label>
                  <input type="checkbox" name="keys35" onChange={handleChange} checked={formValues.keys35} />
                  艦船用修正
                </label>
                <label>
                  <input type="checkbox" name="keys32" onChange={handleChange} checked={formValues.keys32} />
                  解体
                </label>
              </td>
            </tr>

            {/* カード名称から検索 */}
            <tr>
              <td className="cell_b">カード名称から検索</td>
              <td colSpan="3">
                <input
                  type="text"
                  size="50"
                  name="keys3"
                  value={formValues.keys3}
                  onChange={handleChange}
                />
              </td>
            </tr>

            {/* カードテキストから検索 */}
            <tr>
              <td className="cell_a" nowrap="nowrap">
                カードテキストから検索
              </td>
              <td colSpan="3">
                <input
                  type="text"
                  size="50"
                  name="keys36,42"
                  value={formValues["keys36,42"]}
                  onChange={handleChange}
                />
              </td>
            </tr>

            {/* キーワードで検索 */}
            <tr>
              <td className="cell_b">キーワードで検索</td>
              <td colSpan="3">
                <input
                  type="text"
                  size="50"
                  name="IDv001"
                  value={formValues.IDv001}
                  onChange={handleChange}
                />
                <select name="IDn001" size="1" value={formValues.IDn001} onChange={handleChange}>
                  <option>and</option>
                  <option>or</option>
                  <option>not</option>
                </select>
              </td>
            </tr>

            {/* 検索条件 */}
            <tr>
              <td className="cell_a">検索条件</td>
              <td colSpan="3">
                <select name="word" size="1" value={formValues.word} onChange={handleChange}>
                  <option value="1">大文字小文字を区別</option>
                  <option value="0">区別しない</option>
                  <option value="2">全角半角も区別しない</option>
                </select>
              </td>
            </tr>

            {/* 表示件数 */}
            <tr>
              <td className="cell_b">表示件数</td>
              <td colSpan="3">
                <select name="print" size="1" value={formValues.print} onChange={handleChange}>
                  <option>10</option>
                  <option>20</option>
                  <option>30</option>
                  <option>40</option>
                  <option>50</option>
                </select>
                件ごと
              </td>
            </tr>

            {/* 再録 */}
            <tr>
              <td className="cell_a" nowrap="nowrap">
                再録
              </td>
              <td colSpan="3">
                <label>
                  <input
                    type="radio"
                    name="keys63"
                    value=""
                    onChange={handleChange}
                    checked={formValues.keys63 === ""}
                  />
                  表示　
                </label>
                <label>
                  <input
                    type="radio"
                    name="keys63"
                    value="O"
                    onChange={handleChange}
                    checked={formValues.keys63 === "O"}
                  />
                  非表示　
                </label>
                <label>
                  <input
                    type="radio"
                    name="keys63"
                    value="R"
                    onChange={handleChange}
                    checked={formValues.keys63 === "R"}
                  />
                  再録のみ表示
                </label>
              </td>
            </tr>

            {/* Submit / Reset */}
            <tr>
              <td>
                <br />
                <input type="submit" value="検索" />
              </td>
              <td colSpan="3">
                <br />
                <input type="reset" value="取消" onClick={handleReset} />
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <br />
      <div className="base">
        <a href="dbuse.html" target="_blank" rel="noopener noreferrer">
          ○ DATABASE解説 ○
        </a>
      </div>
      <hr color="#009563" noshade="noshade" width="92%" size="14" />
      <div className="ret">
        <a href="https://web.archive.org/web/20060411002812/http://relena.noob.jp/">
          戻る
        </a>
      </div>

      <div id="footer">
        <p>Copyright &copy; 少女が見た流星 All Rights Reserved.</p>
      </div>
    </div>
  );
};

export default SearchForm;
