// 削除依頼フォーム(Googleフォーム)のURL。
//
// ここが空のあいだ、規約とプライバシーポリシーは「窓口は準備中」の文面を出す。
// 未確定のURLでリンクを公開してしまう事故を防ぐためのフォールバック。
// フォームを作ったら、この定数にURLを入れるだけで両ページの窓口が有効になる。
const DELETION_REQUEST_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSe3_n2mxqLM5swY54ePceLitK1sD-X5jZgHhcdmA6G_UtUcNg/viewform";

// 画面側はこの関数だけを見る。空文字なら窓口なしとして扱う。
export function getDeletionRequestFormUrl() {
  return DELETION_REQUEST_FORM_URL.trim();
}

// 規約・プライバシーポリシーの制定日。本番へ公開した日(JST)。
// 内容を改定したときは、この下に LEGAL_REVISED_DATE を足して併記する。
export const LEGAL_ESTABLISHED_DATE = "2026年9月10日";

// Google アナリティクスの参照先。GA を使っていることの開示は Google の
// 利用規約で求められているため、仕組みの説明とオプトアウト手段を示す。
export const GA_DATA_USE_URL = "https://policies.google.com/technologies/partner-sites";
export const GA_OPT_OUT_URL = "https://tools.google.com/dlpage/gaoptout";
