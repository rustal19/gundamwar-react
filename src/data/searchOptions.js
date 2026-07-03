// 検索フォームの選択肢データ（SearchForm / CompactDeckSearchForm で共有）

// 戦闘修正（格闘・射撃・防御）用: * と負数を含む
export const COMBAT_NUMERIC_OPTIONS = [
  { label: "*", value: "*" },
  { label: "-2", value: -2 },
  { label: "-1", value: -1 },
  ...Array.from({ length: 11 }, (_, n) => ({ label: String(n), value: n })),
];

// 国力・合計国力・資源コスト用: 0〜10
export const COST_NUMERIC_OPTIONS = Array.from({ length: 11 }, (_, n) => ({
  label: String(n),
  value: n,
}));

export const CARD_TYPE_OPTIONS = [
  { label: "UNIT", value: 1 },
  { label: "CHARACTER", value: 2 },
  { label: "COMMAND", value: 3 },
  { label: "OPERATION", value: 4 },
  { label: "Generation", value: 10 },
  { label: "ACE", value: 11 },
];

export const COLOR_INCLUDE_OPTIONS = [
  { label: "青", value: 1 },
  { label: "緑", value: 2 },
  { label: "黒", value: 3 },
  { label: "赤", value: 4 },
  { label: "茶", value: 5 },
  { label: "白", value: 6 },
  { label: "紫", value: 7 },
];

export const COLOR_EXCLUDE_OPTIONS = COLOR_INCLUDE_OPTIONS.map(({ label, value }) => ({
  label: `${label}でない`,
  value,
}));

export const UNIT_FEATURE_OPTIONS = [
  { label: "MS", value: "mobileSuits" },
  { label: "MA", value: "mobileArmor" },
  { label: "MF", value: "mobileFighter" },
  { label: "コンビ", value: "combi" },
  { label: "Lサイズ", value: "largeSize" },
  { label: "艦艇", value: "warship" },
];

export const UNIT_EXTRA_OPTIONS = [
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
  { value: "orbitalElevator", label: "軌道エレベーター" },
];

export const CHAR_FEATURE_OPTIONS = [
  { label: "男性", value: "male" },
  { label: "女性", value: "female" },
  { label: "大人", value: "adult" },
  { label: "子供", value: "child" },
  { label: "NT", value: "newType" },
  { label: "CO", value: "coordinator" },
  { label: "GF", value: "gundamFighter" },
];

export const CHARACTER_EXTRA_OPTIONS = [
  { value: "boostedMan", label: "ブーステッドマン" },
  { value: "extended", label: "エクステンデッド" },
  { value: "innovator", label: "イノベイター" },
  { value: "superSoldier", label: "超兵" },
  { value: "observer", label: "監視者" },
];

export const OTHER_FEATURE_OPTIONS = [
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
  { label: "兵装", value: "equipment" },
];

export const SET_INCLUDED_OPTIONS = [
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
  { label: "プロモカード", value: "PR" },
];

export const SET_EXTRA_OPTIONS_BB = [
  { label: "ベースドブースター", value: "BB1" },
  { label: "ベースドブースター2", value: "BB2" },
  { label: "ベースドブースター3", value: "BB3" },
  { label: "エクステンションブースター", value: "EB1" },
  { label: "エクステンションブースター2", value: "EB2" },
  { label: "エクステンションブースター3", value: "EB3" },
];

export const SET_EXTRA_OPTIONS_ST = [
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
  { label: "純白の鋼翼", value: "WS2" },
];

export const SET_EXTRA_OPTIONS_DB = [
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
  { label: "ガンプラ30thメモリアルエディション", value: "CB2" },
];

export const SET_EXTRA_OPTIONS_EX = [
  { label: "拡張シート", value: "EX1" },
  { label: "拡張シートVer.2", value: "EX2" },
  { label: "覇王の紋章 ジャンボカードダスVer.", value: "EX3" },
  { label: "入門用スターター", value: "BS" },
  { label: "オールウェイズビギニングセット", value: "EV" },
  { label: "BIGガンスリンガーカード", value: "BG" },
  { label: "コラボカード", value: "joke" },
];

export const TERRAIN_OPTIONS = ["宇宙", "地球"];

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

export const DECK_RANGE_PRESET_CUTOFFS = {
  classic: "2006-01-01",
  rising: "2009-11-20",
};

export const TENSAKU_OPTIONS = [
  { label: "第9回 添削杯", value: "2010-03-09" },
  { label: "第8回 添削杯", value: "2009-08-09" },
  { label: "第7回 添削杯", value: "2009-02-19" },
  { label: "第6回 添削杯", value: "2008-02-28" },
  { label: "第5回 添削杯", value: "2007-08-31" },
  { label: "第4回 添削杯", value: "2007-02-28" },
  { label: "第3回 添削杯", value: "2006-08-31" },
  { label: "第2回 添削杯", value: "2006-02-28" },
  { label: "第1回 添削杯", value: "2005-08-31" },
];
