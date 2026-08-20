"use strict";

// アイコン（Bootstrap Icons, MIT License）を絵文字の代わりに生SVGで埋め込む。
const ICON_X =
  '<svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/></svg>';
const ICON_IMAGE =
  '<svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>' +
  '<path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1z"/></svg>';

const doc = document.getElementById("doc");
const docLeftEl = document.querySelector(".doc-left");
const docRightEl = document.getElementById("docRight");
const popoverEl = document.getElementById("notePopover");
const popoverInput = document.getElementById("notePopoverInput");
const titleInput = document.getElementById("titleInput");
const saveBtn = document.getElementById("saveBtn");
const savePdfBtn = document.getElementById("savePdfBtn");
const officialModeRow = document.getElementById("officialModeRow");
const officialModeToggle = document.getElementById("officialModeToggle");
const exportHotlineBtn = document.getElementById("exportHotlineBtn");
const printDocEl = document.getElementById("printDoc");
const loadInput = document.getElementById("loadInput");
const saveStatusEl = document.getElementById("saveStatus");
const resumeApplyBtn = document.getElementById("resumeApply");
const resumeDiscardBtn = document.getElementById("resumeDiscard");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const nameBlackInput = document.getElementById("nameBlack");
const nameBlueInput = document.getElementById("nameBlue");
const showNamesToggle = document.getElementById("showNamesToggle");
const helpBtn = document.getElementById("helpBtn");
const helpPanel = document.getElementById("helpPanel");
const formatToolbarEl = document.getElementById("formatToolbar");
const alignBtns = Array.from(formatToolbarEl.querySelectorAll("[data-align]"));
const indentDecBtn = document.getElementById("indentDecBtn");
const indentIncBtn = document.getElementById("indentIncBtn");
const hangingDecBtn = document.getElementById("hangingDecBtn");
const hangingIncBtn = document.getElementById("hangingIncBtn");
const hangingLabel = document.getElementById("hangingLabel");
const boldBtn = document.getElementById("boldBtn");
const underlineBtn = document.getElementById("underlineBtn");
const kentenBtn = document.getElementById("kentenBtn");
const styleBtns = Array.from(formatToolbarEl.querySelectorAll("[data-style]"));
const docStackEl = document.getElementById("docStack");
const docLabelEl = document.getElementById("docLabel");
const pdfViewerEl = document.getElementById("pdfViewer");
const introSection = document.getElementById("introSection");
const introDismissToggle = document.getElementById("introDismissToggle");
const showIntroToggle = document.getElementById("showIntroToggle");
const numberingSettingsBtn = document.getElementById("numberingSettingsBtn");
const numberingPanel = document.getElementById("numberingPanel");
const applyNumberingBtn = document.getElementById("applyNumberingBtn");
// 見出し（H1〜H3）の見た目設定。文字サイズ(pt)は空欄可（本文と同じ＝上書きしない）、太字はON/OFFのみ。
const styleSettingInputs = {
  h1: { size: document.getElementById("h1SizeInput"), bold: document.getElementById("h1BoldToggle") },
  h2: { size: document.getElementById("h2SizeInput"), bold: document.getElementById("h2BoldToggle") },
  h3: { size: document.getElementById("h3SizeInput"), bold: document.getElementById("h3BoldToggle") },
};
// 項番（行頭の型）ごとのインデント・ぶら下げ設定。
const numberingSettingInputs = {
  dai:    { indent: document.getElementById("numDaiIndent"),    hanging: document.getElementById("numDaiHanging") },
  arabic: { indent: document.getElementById("numArabicIndent"), hanging: document.getElementById("numArabicHanging") },
  paren:  { indent: document.getElementById("numParenIndent"),  hanging: document.getElementById("numParenHanging") },
  kana:   { indent: document.getElementById("numKanaIndent"),   hanging: document.getElementById("numKanaHanging") },
};

let anchorIdSeq = 1;
let replyIdSeq = 1;
let imageIdSeq = 1;

// ---- モード（本文＝打ち込み編集 か PDF＝既存PDFへの注釈 か。sidenote-pdfから移植） ----
// 「開く」で.pdfを選ぶとpdfモードへ切り替わる（新規ボタンは増やさない方針、loadInput.onchange参照）。
// notesByAnchor・色・返信スレッドの仕組みは両モード共通。異なるのは「本文をどう表示し、
// どこにノートを固定するか」だけなので、そこだけモード別の実装（renumberAndLayoutText/Pdf、
// buildPrintDoc/Pdf）に分け、共通部分（layoutSidenotes・ポップオーバー・色選択等）は分岐しない。
let currentMode = "text";   // "text" | "pdf"
let currentPdfDoc = null;         // pdf.jsのPDFDocumentProxy（再レンダリング等では今のところ使わない。将来用に保持）
let currentPdfDataUrl = null;     // 保存(.json)にそのまま埋め込む元PDFのdata URL
// pdfモードでの注釈の「正本」。#doc（docHTML）に相当する存在で、DOM上の.pdf-markは
// これを描画した結果に過ぎない（ページの再描画時はこの配列から作り直す）。
// { anchorId, page(0始まり), kind: "text"|"point"|"rect",
//   quote,                          // kind:"text"のみ。参考用（表示はしない）
//   rects: [{x,y,w,h}, ...],        // kind:"text"のみ。ページ空間（scale=1）座標
//   point: {x,y},                   // kind:"point"のみ。ページ空間座標
//   rect: {x,y,w,h} }               // kind:"rect"のみ。ページ空間座標
let pdfAnchors = [];

// anchorId -> [{id, text, color}, ...]（1つの一文・画像に複数のコメントを重ねられる＝返信スレッド形式）
// 引用された原文自体はDOM（.note-anchorのspan）がそのまま保持するのでここには持たない。
const notesByAnchor = new Map();
let pendingTarget = null;             // { type: "text", range } | { type: "image", paraEl } | { type: "reply", anchorId }
let lastUsedColor = "black";          // 直前に選んだ色をポップオーバーの初期選択にする
const AUTHOR_COLOR_HEX = { black: "#31333f", blue: "#1a73e8", red: "#d33" };
// 黒・青は「誰か」を表す名前を「設定」で自由に変えられる（例：黒=Tomo、青=Toko）。赤は「重要」固定。
const colorNames = { black: "自分", blue: "共有相手" };
function colorLabel(color) {
  return color === "red" ? "重要" : (colorNames[color] || color);
}
// サイドノートに「自分：」等の名前を表示するかどうか（デフォルトはオフ＝表示しない。色分けだけで足りる場合が多いため）。
// この端末の個人的な表示設定として扱い、.jsonへは保存しない（md書き出しには名前を常に含める＝別扱い）。
let showAuthorLabel = false;

// インデント／ぶら下げインデント／スタイルは.paraのdata属性（data-indent-level・data-hanging・
// data-style）で持たせ、画面・印刷（PDF化）の両方がこの属性から表示用のスタイルを組み立てる
// （値そのものは属性が正、スタイルは都度の計算結果というのが唯一の情報源になる）。
const INDENT_STEP_EM = 1;
const INDENT_LEVEL_MAX = 6;
// ぶら下げは1〜3文字幅から選べる（0＝なし）。1文字＝1em（本文の37字組版と同じ「全角1文字≒1em」の前提）。
const HANGING_CHAR_EM = 1;
const HANGING_MAX = 3;
// スタイルは「本文」＋見出し3段階（H1〜H3）の離散的な4択（かつての70%〜150%の連続ステッパー式
// 文字サイズは廃止）。data-styleが無い＝本文（フォントサイズ・太さともに素のまま）。
// 各見出しの実際の見た目（文字サイズpt・太字）は「項番設定」パネルで文書ごとに変えられる設定
// （paraStyleSettings、下のDEFAULT_PARA_STYLE_SETTINGSが初期値）にした。文字サイズは印刷（PDF化）
// との一致を優先してpt単位で持つ（画面・印刷どちらもCSSのpt単位がそのまま使える）。
// fontSizePtがnull＝本文と同じ文字サイズのまま太字だけ変える、という指定にも対応する。
const DEFAULT_PARA_STYLE_SETTINGS = {
  h1: { fontSizePt: 16, bold: false },
  h2: { fontSizePt: null, bold: true },
  h3: { fontSizePt: null, bold: true },
};
let paraStyleSettings = JSON.parse(JSON.stringify(DEFAULT_PARA_STYLE_SETTINGS));

// ---- 項番（行頭の型）の自動判定 ----
// 「第１」「１、」「⑴」「ア、」のような行頭の型ごとに、インデント・ぶら下げをまとめて設定できる
// （numberingSettings、下のDEFAULT_NUMBERING_SETTINGSが初期値）。「項番を一括適用」ボタン
// （applyNumbering）を押すと、文書内の全段落を先頭のテキストで判定し、一致した型の設定を書き込む。
// 本文中に偶然現れる数字・カタカナ1文字を拾わないよう、「第」に続く数字（dai型）以外は直後に
// 区切り文字（空白・句読点・丸括弧閉じ）を要求しているが、完全な誤検出防止はできないため、
// applyNumbering側で「既に手動でインデント・ぶら下げを変えた段落は対象外」にして被害を抑えている。
const NUMBERING_TYPES = ["dai", "arabic", "paren", "kana"];
const NUMBERING_TYPE_LABELS = { dai: "第１型", arabic: "１型", paren: "⑴型", kana: "ア型" };
const NUMBERING_PATTERNS = {
  dai:    /^第[0-9０-９一二三四五六七八九十百千]+/,
  arabic: /^[0-9０-９]+[\s　、，,．.）)]/,
  paren:  /^([⑴-⒇]|[（(][0-9０-９]+[）)])/,
  kana:   /^[ア-ン][\s　、，,．.）)]/,
};
const DEFAULT_NUMBERING_SETTINGS = {
  dai:    { indentLevel: 0, hanging: 1 },
  arabic: { indentLevel: 1, hanging: 1 },
  paren:  { indentLevel: 2, hanging: 1 },
  kana:   { indentLevel: 3, hanging: 1 },
};
let numberingSettings = JSON.parse(JSON.stringify(DEFAULT_NUMBERING_SETTINGS));

// .jsonから読み込んだ設定を既定値へマージする（旧ファイル・欠損・改ざんされた値でも壊れないように）。
function mergeParaStyleSettings(loaded) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_PARA_STYLE_SETTINGS));
  if (loaded && typeof loaded === "object") {
    Object.keys(merged).forEach((key) => {
      const s = loaded[key];
      if (!s || typeof s !== "object") return;
      merged[key].fontSizePt = Number.isFinite(s.fontSizePt) ? s.fontSizePt : null;
      merged[key].bold = !!s.bold;
    });
  }
  return merged;
}
function mergeNumberingSettings(loaded) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_NUMBERING_SETTINGS));
  if (loaded && typeof loaded === "object") {
    NUMBERING_TYPES.forEach((type) => {
      const r = loaded[type];
      if (!r || typeof r !== "object") return;
      if (Number.isFinite(r.indentLevel)) merged[type].indentLevel = Math.max(0, Math.min(INDENT_LEVEL_MAX, r.indentLevel));
      if (Number.isFinite(r.hanging)) merged[type].hanging = Math.max(0, Math.min(HANGING_MAX, r.hanging));
    });
  }
  return merged;
}

const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const setStatus = (msg) => { saveStatusEl.textContent = msg || ""; };
const timestamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

// ---- ノート本文は簡易Markdown（**太字**と<u>下線</u>のみ許可） ----
function formatNoteText(raw) {
  const esc = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, "<u>$1</u>");
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 選択範囲がロック済み注釈（.note-anchor）や画像ブロック（.para-image）にかかっていないか確認する。
// 原文の改変を防ぐため、これらをまたぐ選択には太字/下線もノート追加も適用しない。
function rangeOverlapsLockedAnchor(range) {
  return Array.from(doc.querySelectorAll(".note-anchor, .para-image")).some((el) => range.intersectsNode(el));
}

// ---- 貼り付けは常にプレーンテキスト化した上で、1行＝1段落(.para)に組み直す ----
// （書式を持ち込まないのに加えて、行ごとにインデント／ぶら下げインデントを適用できるようにするため）
function linesToParaHtml(text) {
  return text.split(/\r\n|\r|\n/)
    .map((line) => line.length ? `<div class="para">${escapeHtml(line)}</div>` : `<div class="para"><br></div>`)
    .join("");
}

// クリップボードに画像が含まれる場合は画像ブロックとして挿入し、無ければ従来通りテキスト化する。
doc.addEventListener("paste", (e) => {
  const cd = e.clipboardData || window.clipboardData;
  const imageItem = Array.from(cd.items || []).find((it) => it.type && it.type.startsWith("image/"));
  if (imageItem) {
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) insertImageBlock(file);
    return;
  }
  e.preventDefault();
  const text = cd.getData("text/plain");
  if (text) document.execCommand("insertHTML", false, linesToParaHtml(text));
});

// 文書は常に最低1つの.para（空でも）を持つ状態にしておく。空の#docに直接入力し始めた場合でも
// インデント操作の対象（カーソルが属する.para）が存在するようにするため。
function resetDoc() {
  doc.innerHTML = '<div class="para"><br></div>';
}

// 空の時にplaceholderを出す（contenteditableはネイティブ対応が無いためCSSではなくJSで判定）。
// pdfモードは「空の本文」という概念自体が無い（PDFを開いた時点で必ず中身がある）ので何もしない。
function updatePlaceholder() {
  if (currentMode === "pdf") return;
  doc.classList.toggle("empty", doc.textContent.trim() === "" && doc.querySelectorAll(".note-anchor, .para-image").length === 0);
}
// 画像ブロックもBackspace/Deleteでのブラウザ標準の削除に対応しているため、
// テキストの編集と同じ"input"イベントでも通し番号・サイドノート欄を必ず作り直す
// （そうしないと、画像を削除してもサイドノート欄にその残骸が残ってしまう）。
doc.addEventListener("input", () => { updatePlaceholder(); renumberAndLayout(); autoSaveDebounced(); });
resetDoc();
updatePlaceholder();
// 初回読み込み時もrenumberAndLayout()を呼んでおく（呼ばないとlayoutSidenotes()が一度も走らず、
// 注釈0件時のグレーアウトの見本カードが最初の入力までサイドに出ない）。
renumberAndLayout();
updateFormatToolbarState();

// ---- Markdown取り込み（AIが書いた原稿を本文として取り込む） ----
// 対応範囲は「AIが書く公文書ドラフト」を想定した最小限にとどめる：見出し（#〜######）は記号だけ
// 外してただの段落として取り込む（H1〜H3の適用はユーザーが手動で行う仕様のため、自動でスタイルは
// 付けない）・**太字**・空行区切りの段落のみ対応。箇条書き・表・リンク・コードブロック等は非対応で、
// 記号ごとプレーンな文字として取り込まれる（今後、実際の利用実績を見て対応範囲を広げる）。
// ブロック内の単一改行はCommonMark同様のソフト改行として1つのスペースに畳む
// （見出し直後に空行を挟まない書き方には対応しない＝見出しも前後の段落と同じブロックに混ざる）。
function parseMarkdownToParas(text) {
  return text.replace(/\r\n?/g, "\n").split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const line = block.replace(/\n/g, " ").replace(/^#{1,6}\s+/, "").trim();
      return mdInlineToHtml(line);
    });
}

// インライン書式は**太字**のみ対応する（ノート本文のformatNoteTextと違い<u>下線</u>記法は
// AIが書く.mdでは使われない想定のため対象外。それ以外の文字はエスケープしてそのまま文字として扱う）。
function mdInlineToHtml(line) {
  return escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// 「開く」で.mdを選んだ時の入口。.jsonの「開く」と違い、既存の段落・ノート・画像・項番/スタイル
// 設定は全て消えて本文だけ.mdの内容に差し替わる（.mdファイル自体はこれらの設定を持たないため、
// 「新しい作業」で初期化してから本文だけ入れる動きに近い）。
function importMarkdownFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const blocks = parseMarkdownToParas(String(reader.result));
      if (!blocks.length) throw new Error("空のMarkdownファイルです");

      setMode("text");
      pdfViewerEl.innerHTML = "";
      currentPdfDoc = null;
      currentPdfDataUrl = null;
      pdfAnchors = [];
      notesByAnchor.clear();
      anchorIdSeq = 1;
      replyIdSeq = 1;
      imageIdSeq = 1;
      numberingSettings = JSON.parse(JSON.stringify(DEFAULT_NUMBERING_SETTINGS));
      paraStyleSettings = JSON.parse(JSON.stringify(DEFAULT_PARA_STYLE_SETTINGS));
      refreshNumberingSettingInputs();
      refreshStyleSettingInputs();

      doc.innerHTML = blocks.map((html) => `<div class="para">${html || "<br>"}</div>`).join("");

      // タイトル欄（保存ファイル名用）は1つ目の段落のテキストを仮に入れておく（後から書き換え可）。
      // 見出しのスタイル・中央ぞろえ・項番のインデントはユーザーが取り込み後に手動で適用する
      // （タイトル中央ぞろえの自動判定は信頼できないため実装しない。インデントは既存の
      // 「項番を一括適用」がそのまま使える）。
      const firstText = doc.querySelector(".para")?.textContent.trim() || "";
      titleInput.value = firstText.slice(0, 40);

      renumberAndLayout();
      updatePlaceholder();
      updateFormatToolbarState();
      setStatus(`Markdownを取り込みました：${file.name}（見出し・中央ぞろえ・項番のインデントは手動で適用してください）`);
      autoSaveDebounced();
    } catch (err) {
      console.error(err);
      setStatus("Markdownの取り込みに失敗しました。");
    }
  };
  reader.onerror = () => setStatus("読み込みに失敗しました。");
  reader.readAsText(file);
}

// ---- hotline向け書き出し（項番マーカー＋サイドノート） ----
// C:\minnanosaiban\hotline のoverrides/hooks/doc_indent.pyがそのまま展開できる
// :N X[#anchor名]: マーカー形式で本文を書き出す。data-indent-level・data-hangingが唯一の
// 情報源で、hotline側のpadN／idt／hg-idt(2/3)と直接対応する：
//   hanging=0            → :Ni:（indent0なら:0i:＝<p class="doc idt">、一字下げの地の文）
//   hanging=1/2/3         → :Nh: / :Nh2: / :Nh3:（第１・１・⑴・ア等の項番見出し）
// 中央ぞろえ（タイトル）の段落だけはマーカー化せず生HTML（<p class="doc center">）で出す
// （center/smaller/doc-gap-top等の稀な修飾はマーカー非対応、というhotline側の設計に合わせる）。
// アンカー（#anchor名）は「項番の見出し（ぶら下げ有り）」または「サイドノートが付いている」
// 段落にだけ p1, p2... と機械的に振る。意味のある名前への差し替えはhotline側で手動を想定
// （386箇所の既存アンカーも人手で付けた名前で、自動生成では意味のある名前は作れないため）。
const HOTLINE_HANGING_KIND = { 1: "h", 2: "h2", 3: "h3" };

function hotlineEscapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// #doc内のノードをhotline向けのインラインHTML文字列へ変換する。buildPrintNode（PDF化用）と
// 考え方は同じだが、（1）太字はhotlineの既存慣習に合わせて<strong>ではなく<b>にする、
// （2）サイドノートは本文へ埋め込まず上付き番号だけ残す（中身は呼び出し側で別ブロックのasideにする）
// 点が異なる。
function hotlineInlineHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return hotlineEscapeText(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (node.tagName === "BR") return "<br>";
  if (node.classList && node.classList.contains("note-anchor")) {
    const quoted = node.querySelector("span")?.textContent || "";
    const num = node.querySelector(".note-num")?.textContent;
    return hotlineEscapeText(quoted) + (num ? `<sup>${num}</sup>` : "");
  }
  const children = () => Array.from(node.childNodes).map(hotlineInlineHtml).join("");
  if (node.classList && node.classList.contains("kenten")) {
    // hotline側に.kentenクラスは無いため、見た目（-webkit-text-emphasis-style）をインラインで持たせる。
    return `<span style="-webkit-text-emphasis-style: filled dot; text-emphasis-style: filled dot;">${children()}</span>`;
  }
  if (node.tagName === "STRONG" || node.tagName === "B") return `<b>${children()}</b>`;
  if (node.tagName === "U") return `<u>${children()}</u>`;
  return children();
}

function hotlineMarkerFor(indentLevel, hanging) {
  return `:${indentLevel}${HOTLINE_HANGING_KIND[hanging] || "i"}`;
}

// notesByAnchorの中身をhotlineのサイドノート（<aside class="sidenote">、doc_indent.pyの
// マーカー対象外＝生HTMLのまま素通りする）へ変換する。色「重要」はhotline既存の赤強調
// （.strong-rd、eneos-saibanの「争う」等と同じ赤）に対応させる（黒／青の色分けは
// レビュー中だけの区別なので、公開用のhotlineには引き継がない）。
function hotlineNoteHtml(num, notes) {
  const body = notes.map((note) => {
    const html = formatNoteText(note.text);   // **太字**・<u>下線</u>をHTMLへ変換（画面の表示と同じ関数）
    return note.color === "red" ? `<span class="strong-rd">${html}</span>` : html;
  }).join("<br>");
  return `<aside class="sidenote"><span class="num">${num}</span>${body}</aside>`;
}

// 1段落ぶんの出力（マーカー行 or 生HTML）＋その段落に付いているサイドノートのブロック列を返す。
function buildHotlineParaOutput(paraEl, anchorSeqRef) {
  const indentLevel = Number(paraEl.dataset.indentLevel || 0);
  const hanging = Number(paraEl.dataset.hanging || 0);
  let text = Array.from(paraEl.childNodes).map(hotlineInlineHtml).join("").trim();
  if (!text) return [];
  // H1〜H3（画面上の見出し表示用）は、hotline側にはpt指定の概念が無いため、意図だけ太字で残す。
  if (paraEl.dataset.style) text = `<b>${text}</b>`;

  const noteGroups = Array.from(paraEl.querySelectorAll(".note-anchor"))
    .map((anchor) => {
      const num = anchor.querySelector(".note-num")?.textContent;
      const notes = notesByAnchor.get(anchor.dataset.anchorId) || [];
      return num && notes.length ? { num, notes } : null;
    })
    .filter(Boolean);

  const needsAnchor = hanging > 0 || noteGroups.length > 0;
  const anchorPart = needsAnchor ? `#p${anchorSeqRef.n++}` : "";

  const mainBlock = paraEl.dataset.align === "center"
    ? `<p class="doc center">\n${text}\n</p>`   // タイトル等はマーカー化せず生HTMLで出す
    : `${hotlineMarkerFor(indentLevel, hanging)}${anchorPart}: ${text}`;

  return [mainBlock, ...noteGroups.map((g) => hotlineNoteHtml(g.num, g.notes))];
}

function buildHotlineMarkdown() {
  const paras = Array.from(doc.querySelectorAll(".para"));
  const imageCount = paras.filter((p) => p.classList.contains("para-image")).length;
  const anchorSeqRef = { n: 1 };
  const blocks = [];
  paras.forEach((p) => {
    if (p.classList.contains("para-image")) return;   // 画像はhotline書き出しの対象外（下の注記で警告）
    blocks.push(...buildHotlineParaOutput(p, anchorSeqRef));
  });
  if (!blocks.length) return null;
  return { md: blocks.join("\n\n") + "\n", imageCount };
}

// ---- hotline書き出しの保存先（File System Access API） ----
// hotlineリポジトリのdocs/trial/parts/へ直接ファイルを書き込み、「ダウンロード→探す→
// 貼り付け」の手作業を無くす。書面の再編集→再書き出しは同名ファイルの上書きで完結させる
// 前提なので、ファイル名はタイトル由来の安定した名前にする（日時は付けない。日時付きの
// 控えが必要な用途は.json保存が担う）。フォルダのハンドルはIndexedDBに永続化し、初回だけ
// フォルダ選択・以後は許可の再確認のみ（Chromeはハンドル自体を構造化クローンで保存できる）。
// localStorageでなくIndexedDBなのは、FileSystemDirectoryHandleが文字列化できないため。
const IDB_NAME = "sidenote-pdf-doc";
const IDB_STORE = "handles";
const HOTLINE_DIR_KEY = "hotlineExportDir";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 保存先フォルダへmdを書き込む。戻り値はフォルダ名（表示用）。
// File System Access API非対応（Firefox等）ならnullを返し、呼び出し側がダウンロードへ落とす。
async function saveHotlineFileDirect(md, filename, forceRepick) {
  if (!window.showDirectoryPicker) return null;
  let dir = null;
  if (!forceRepick) {
    try { dir = await idbGet(HOTLINE_DIR_KEY); } catch (err) { /* 初回等、無ければ選ばせる */ }
  }
  if (dir) {
    // 保存済みハンドルの権限はセッションごとに失効するため、毎回確認→必要なら再要求する
    // （requestPermissionはユーザー操作起点でしか呼べないが、ここはボタンクリック中なのでOK）。
    let perm = await dir.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") perm = await dir.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") dir = null;
  }
  if (!dir) {
    dir = await window.showDirectoryPicker({ mode: "readwrite" });
    try { await idbSet(HOTLINE_DIR_KEY, dir); } catch (err) { /* 保存失敗しても今回分の書き込みは続行 */ }
  }
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(md);
  await writable.close();
  return dir.name;
}

// Ctrl+クリック＝クリップボードへコピー（ファイル保存なし。一部だけ手で貼りたい時の保険）。
// Shift+クリック＝保存先フォルダを選び直す。通常クリック＝記憶したフォルダへ直接保存
// （非対応ブラウザは従来どおりダウンロード）。
async function exportHotlineMarkdown(e) {
  const built = buildHotlineMarkdown();
  if (!built) { setStatus("書き出す本文がありません。"); return; }
  const { md, imageCount } = built;
  const imageNote = imageCount ? `（画像${imageCount}件は対象外のため含まれていません）` : "";

  if (e && e.ctrlKey) {
    try {
      await navigator.clipboard.writeText(md);
      setStatus(`hotline向けMarkdownをクリップボードへコピーしました${imageNote}`);
    } catch (err) {
      console.error(err);
      setStatus("クリップボードへのコピーに失敗しました。");
    }
    return;
  }

  const filename = `${sanitizeFilename(projectTitle()) || "hotline-export"}.md`;
  try {
    const dirName = await saveHotlineFileDirect(md, filename, e && e.shiftKey);
    if (dirName !== null) {
      setStatus(`hotline向けに保存しました：${dirName}/${filename}${imageNote}`);
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") { setStatus("保存をキャンセルしました。"); return; }
    console.error(err);   // 直接保存に失敗した場合は下のダウンロードへ落とす（書き出し自体は成立させる）
  }
  downloadBlob(new Blob([md], { type: "text/markdown" }), filename);
  setStatus(`hotline向けに書き出しました（ダウンロード）：${filename}${imageNote}`);
}
exportHotlineBtn.onclick = (e) => exportHotlineMarkdown(e);

// ---- 保存・読み込み（.jsonファイル） ----
// 長文の作業を前提に、途中まで進めた内容をファイルとして残せるようにする。
// 案件ごとに別ファイルとして残せるよう、タイトル欄の内容をファイル名に含める。
function projectTitle() {
  return titleInput.value.trim();
}

function serializeProject() {
  const base = {
    app: "sidenote-pdf",
    version: 4,
    title: projectTitle(),
    savedAt: new Date().toISOString(),
    mode: currentMode,
    notesByAnchor: Array.from(notesByAnchor.entries()),   // [anchorId, [{id,text,color}, ...]][]
    anchorIdSeq,
    replyIdSeq,
    colorNames: { ...colorNames },   // 黒・青の名前もファイルに残す（開いた人が同じ表示で見られるように）
    // 「項番設定」パネルの内容（見出しH1〜H3の見た目、項番の型ごとのインデント・ぶら下げ）も
    // 文書ごとの設定としてファイルに残す（v4で追加。無い旧ファイルはmergeXxxSettings側で既定値になる）。
    paraStyleSettings: JSON.parse(JSON.stringify(paraStyleSettings)),
    numberingSettings: JSON.parse(JSON.stringify(numberingSettings)),
  };
  if (currentMode === "pdf") {
    // 元PDFをdata URLのまま内包する（画像を.jsonに内包しているのと同じ考え方）。
    return { ...base, pdfDataUrl: currentPdfDataUrl, pdfAnchors };
  }
  return { ...base, docHTML: doc.innerHTML, imageIdSeq };
}

function applyProjectData(data) {
  if (!data) throw new Error("invalid project data");
  // 「項番設定」パネルの内容もこのファイルの値で上書きする（モードに関わらず共通、無ければ既定値）。
  paraStyleSettings = mergeParaStyleSettings(data.paraStyleSettings);
  numberingSettings = mergeNumberingSettings(data.numberingSettings);
  refreshStyleSettingInputs();
  refreshNumberingSettingInputs();
  if (data.mode === "pdf") {
    if (typeof data.pdfDataUrl !== "string") throw new Error("invalid pdf project data");
    notesByAnchor.clear();
    if (Array.isArray(data.notesByAnchor)) data.notesByAnchor.forEach(([anchorId, notes]) => notesByAnchor.set(anchorId, notes || []));
    anchorIdSeq = typeof data.anchorIdSeq === "number" ? data.anchorIdSeq : notesByAnchor.size + 1;
    replyIdSeq = typeof data.replyIdSeq === "number" ? data.replyIdSeq : replyIdSeq;
    if (data.colorNames && data.colorNames.black) colorNames.black = data.colorNames.black;
    if (data.colorNames && data.colorNames.blue) colorNames.blue = data.colorNames.blue;
    nameBlackInput.value = colorNames.black;
    nameBlueInput.value = colorNames.blue;
    updateColorSwatchLabels();
    titleInput.value = data.title || "";
    return renderPdfFromDataUrl(data.pdfDataUrl, Array.isArray(data.pdfAnchors) ? data.pdfAnchors : []);
  }

  if (typeof data.docHTML !== "string") throw new Error("invalid project data");
  setMode("text");
  doc.innerHTML = data.docHTML;
  notesByAnchor.clear();

  if (Array.isArray(data.notesByAnchor)) {
    data.notesByAnchor.forEach(([anchorId, notes]) => notesByAnchor.set(anchorId, notes || []));
    anchorIdSeq = typeof data.anchorIdSeq === "number" ? data.anchorIdSeq : notesByAnchor.size + 1;
    replyIdSeq = typeof data.replyIdSeq === "number" ? data.replyIdSeq : replyIdSeq;
  } else if (Array.isArray(data.notes)) {
    // 旧形式（1範囲=1ノート、data-note-id属性）の.jsonとの後方互換。
    doc.querySelectorAll("[data-note-id]").forEach((el) => {
      el.dataset.anchorId = el.dataset.noteId;
      el.removeAttribute("data-note-id");
    });
    data.notes.forEach(([anchorId, text]) => {
      notesByAnchor.set(anchorId, [{ id: "r" + replyIdSeq++, text, color: "black" }]);
    });
    anchorIdSeq = typeof data.noteIdSeq === "number" ? data.noteIdSeq : notesByAnchor.size + 1;
  }

  imageIdSeq = typeof data.imageIdSeq === "number" ? data.imageIdSeq : doc.querySelectorAll(".para-image").length + 1;
  if (data.colorNames && data.colorNames.black) colorNames.black = data.colorNames.black;
  if (data.colorNames && data.colorNames.blue) colorNames.blue = data.colorNames.blue;
  nameBlackInput.value = colorNames.black;
  nameBlueInput.value = colorNames.blue;
  updateColorSwatchLabels();
  titleInput.value = data.title || "";
  // innerHTMLの再代入で.para-imageのボタン等のイベントリスナーは失われるため、必ず再バインドする。
  doc.querySelectorAll(".para-image").forEach(bindImageParaEvents);
  // 配置・インデント・ぶら下げ・スタイルはdocHTMLに焼き込まれたインラインstyleでそのまま復元されるが、
  // 旧バージョン・手編集されたファイル等でdata属性だけがありstyleが伴わない場合に備え、念のため再計算する。
  applyParaStyles(Array.from(doc.querySelectorAll(".para:not(.para-image)")));
  renumberAndLayout();
  updatePlaceholder();
  updateFormatToolbarState();
}

// ファイル名に使えない文字を落とすだけの軽いサニタイズ（Windows/Mac共通のNG文字を除外）。
const sanitizeFilename = (s) => s.replace(/[\\/:*?"<>|]/g, "_");

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

saveBtn.onclick = () => {
  const data = serializeProject();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const namePart = projectTitle() ? `-${sanitizeFilename(projectTitle())}` : "";
  const filename = `sidenote${namePart}-${timestamp()}.json`;
  downloadBlob(blob, filename);
  setStatus(`保存しました：${filename}`);
};

// ---- A4 PDF化（ブラウザの印刷機能を使う）----
// 独自にPDFを組み立てるのではなく、印刷用CSSを当てた#printDocをブラウザの印刷（→PDFに保存）に渡す方式。
// サイドノートは段落を分割せず、注釈の直後にインラインで埋め込んだ上でfloat:right＋マイナスマージンにより
// 段落の右の余白へ逃がす（Tufte CSSとして知られる余白注釈の定番手法）。2026-08-19以前は「段落を注釈の
// 位置で複数の<p>に分割する」方式だったが、分割した<p>同士は同じ幅のfloat:leftになるため横に並ぶ余地が
// 無く、注釈の直後で必ず改行されたように見える不具合になっていた（分割しない今の方式ならこの問題が
// 原理的に起きない）。ページをまたぐレイアウトでは絶対座標（画面と同じ方式）が使えないため、
// float方式を使う。

// 「公文書仕様」（officialModeToggle）がオンの間だけ立てるフラグ。行政への提出を想定し、
// サイドノートを余白ではなく文書の最後にまとめた文末脚注にし（printFootnoteMode）、
// 文字サイズ・フォントもH1〜H3の設定を無視して統一する（printOfficialMode、buildPrintPara参照）。
// collectedFootnotesは文末脚注モードの間だけ使う一時的な蓄積先で、buildPrintDoc呼び出しのたびに
// 空にする（savePdfBtn.onclickとCtrl+Alt+Pのプレビュー、両方の入口で毎回リセットする）。
let printOfficialMode = false;
let printFootnoteMode = false;
let collectedFootnotes = [];   // [{num, notes}, ...] 文中に現れた順

// #doc内のノードをprintDoc用のDOMへ再帰的に組み立てる。
function buildPrintNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
  if (node.tagName === "BR") return document.createElement("br");
  if (node.classList && node.classList.contains("note-anchor")) {
    const frag = document.createDocumentFragment();
    const quoted = node.querySelector("span")?.textContent || "";
    frag.appendChild(document.createTextNode(quoted));
    const num = node.querySelector(".note-num")?.textContent;
    if (num) {
      const sup = document.createElement("sup");
      sup.textContent = num;
      frag.appendChild(sup);
      // サイドノート本文を、対応する一文のすぐ後ろにインラインで埋め込む。段落を分割しないため、
      // ここに差し込んでもテキストの流れは途切れない（見た目はCSS側のfloatが担当する）。
      // 文末脚注モード（公文書仕様）の間は、その場には埋め込まずcollectedFootnotesへ積んでおき、
      // buildPrintDocの最後でまとめて並べる（本文中に残すのは上のsup番号だけ）。
      const notes = notesByAnchor.get(node.dataset.anchorId) || [];
      if (notes.length) {
        if (printFootnoteMode) collectedFootnotes.push({ num, notes });
        else frag.appendChild(buildPrintAsideEl(num, notes));
      }
    }
    return frag;
  }
  // 傍点（.kenten）はexecCommandではなく独自のspanなので、クラスごと複製して印刷側でも
  // 同じCSS（text-emphasis-style）が当たるようにする。
  if (node.classList && node.classList.contains("kenten")) {
    const span = document.createElement("span");
    span.className = "kenten";
    Array.from(node.childNodes).forEach((child) => span.appendChild(buildPrintNode(child)));
    return span;
  }
  // execCommand("bold")はChromeでは<strong>ではなく<b>を生成するため、両方を太字として扱う
  // （STRONGは将来的な用途・他経路での混入に備えて引き続き受け付ける）。
  const wrapTag = (node.tagName === "STRONG" || node.tagName === "B") ? "strong"
    : node.tagName === "U" ? "u" : null;
  const container = wrapTag ? document.createElement(wrapTag) : document.createDocumentFragment();
  Array.from(node.childNodes).forEach((child) => container.appendChild(buildPrintNode(child)));
  return container;
}

// 番号＋注釈本文（複数件なら改行区切り）をcontainerへ組み立てる。余白のアサイド（buildPrintAsideEl）
// と文末脚注（buildPrintFootnoteRow）はどちらもこの中身を使い、外側の入れ物だけが違う。
function appendNoteContent(container, num, notes) {
  const sup = document.createElement("sup");
  sup.textContent = num;
  container.appendChild(sup);
  container.appendChild(document.createTextNode(" "));
  notes.forEach((note, i) => {
    if (i > 0) container.appendChild(document.createElement("br"));
    // PDFは画面と同じく色が見える（mdと違い色の情報を残せる）ため、「設定」の名前表示オンオフ・
    // 色分けとも画面の表示にそのまま揃える（mdは常に名前を出す＝別扱いのまま）。
    if (showAuthorLabel) {
      const strong = document.createElement("strong");
      strong.textContent = `${colorLabel(note.color)}：`;
      container.appendChild(strong);
    }
    const span = document.createElement("span");
    span.style.color = AUTHOR_COLOR_HEX[note.color] || AUTHOR_COLOR_HEX.black;
    span.innerHTML = formatNoteText(note.text);   // **太字**・<u>下線</u>をHTMLへ変換（画面の表示と同じ関数）
    container.appendChild(span);
  });
}

function buildPrintAsideEl(num, notes) {
  const aside = document.createElement("aside");
  aside.className = "print-aside";
  appendNoteContent(aside, num, notes);
  return aside;
}

// 文末脚注1件ぶんの行。buildPrintAsideElと違いfloatさせない通常のブロックとして、
// 文末脚注セクション（buildPrintDoc末尾）に出現順で積む。
function buildPrintFootnoteRow(num, notes) {
  const p = document.createElement("p");
  p.className = "print-footnote-row";
  appendNoteContent(p, num, notes);
  return p;
}

// 段落は分割せず1つの<p class="print-para">のまま保つ（注釈のサイドノートはbuildPrintNode内で
// 対応する一文の直後にインラインで埋め込み済み。見た目の位置はCSS側のfloatが担当する）。
// 2026-08-16：かつての「段落を注釈の位置で複数の<p>に分割する」方式は、以前この方式は実機の
// 印刷プレビューでサイドノートが消える不具合が2回再現し撤回した経緯がある（buildPrintDoc()の
// 最後の強制リフローはその対策）。今回は分割自体をやめたので、その不具合の再発リスクは無い。
function buildPrintPara(paraEl) {
  const level = Number(paraEl.dataset.indentLevel || 0);
  const hangingChars = Number(paraEl.dataset.hanging || 0);
  const base = level * INDENT_STEP_EM;

  const p = document.createElement("p");
  p.className = "print-para";
  if (level > 0 || hangingChars > 0) {
    p.style.paddingLeft = `${base + hangingChars * HANGING_CHAR_EM}em`;
    p.style.textIndent = hangingChars > 0 ? `-${hangingChars * HANGING_CHAR_EM}em` : "0";
  }
  // 配置・スタイルも画面（#doc）側の書式ツールバーで付けたdata属性をそのまま踏襲する
  // （スタイルの実際の見た目＝文字サイズ・太字は「項番設定」パネルのparaStyleSettingsから引く）。
  if (paraEl.dataset.align) p.style.textAlign = paraEl.dataset.align;
  const styleLook = paraStyleSettings[paraEl.dataset.style];
  if (printOfficialMode) {
    // 公文書仕様：文字サイズはH1〜H3の設定を無視し、中央ぞろえ＝タイトル扱いで16pt、
    // それ以外は本文12ptに統一する（太字だけはH1〜H3のbold設定をそのまま引き継ぐ）。
    p.style.fontSize = paraEl.dataset.align === "center" ? "16pt" : "12pt";
  } else if (styleLook && styleLook.fontSizePt) {
    p.style.fontSize = `${styleLook.fontSizePt}pt`;
  }
  if (styleLook && styleLook.bold) p.style.fontWeight = "700";
  Array.from(paraEl.childNodes).forEach((n) => p.appendChild(buildPrintNode(n)));
  return p;
}

function buildPrintDoc() {
  printDocEl.innerHTML = "";
  collectedFootnotes = [];   // 文末脚注モードの蓄積先をこの回の分だけにする

  // 公文書仕様では、このファイル管理用のタイトル（保存ファイル名に使うtitleInputの値）は
  // 文書そのものの内容ではないため出さない。実際の文書タイトルは本文側で中央ぞろえした段落
  // （buildPrintPara側で16pt扱いになる）をユーザーが自分で用意する想定。
  const title = projectTitle();
  if (title && !printOfficialMode) {
    const titleEl = document.createElement("div");
    titleEl.className = "print-title";
    titleEl.textContent = title;
    printDocEl.appendChild(titleEl);
  }

  Array.from(doc.children).forEach((child) => {
    if (!child.classList || !child.classList.contains("para")) return;

    if (child.classList.contains("para-image")) {
      const imgEl = child.querySelector(".para-image-img");
      const printImg = document.createElement("img");
      printImg.className = "print-img";
      printImg.src = imgEl.src;
      printDocEl.appendChild(printImg);

      const badge = child.querySelector(".note-anchor");
      const num = badge?.querySelector(".note-num")?.textContent;
      const notes = badge ? notesByAnchor.get(badge.dataset.anchorId) || [] : [];
      if (num && notes.length) {
        if (printFootnoteMode) collectedFootnotes.push({ num, notes });
        else printDocEl.appendChild(buildPrintAsideEl(num, notes));
      }
    } else {
      // buildPrintNode/buildPrintParaは再帰的なDOM構築のみ（複雑な分割ロジックは無い）なので
      // 通常は失敗しないはずだが、想定外の構造（壊れたデータの.json読み込み時等）でも印刷全体
      // （他の段落・注釈）が巻き添えで消えないよう、念のためこの段落だけの簡易フォールバック
      // （注釈・書式は失われるがテキストだけは残す）を用意しておく。
      try {
        printDocEl.appendChild(buildPrintPara(child));
      } catch (err) {
        console.error("buildPrintPara failed, falling back for this paragraph:", err, child);
        const p = document.createElement("p");
        p.className = "print-para";
        p.textContent = child.textContent;
        printDocEl.appendChild(p);
      }
    }
  });

  // 文末脚注モード：本文を組み終えた後、集めておいた注釈を出現順のまま文書の最後にまとめて置く
  // （本文中に残っているのは各注釈の上付き番号だけ）。
  if (printFootnoteMode && collectedFootnotes.length) {
    const section = document.createElement("div");
    section.className = "print-footnotes";
    const heading = document.createElement("div");
    heading.className = "print-footnotes-heading";
    heading.textContent = "脚注";
    section.appendChild(heading);
    collectedFootnotes.forEach(({ num, notes }) => section.appendChild(buildPrintFootnoteRow(num, notes)));
    printDocEl.appendChild(section);
  }

  // 直後にwindow.print()（またはプレビュー用のクラス切り替え）が呼ばれる前に、大量のfloat要素を
  // 書き換えた後のレイアウトを強制的に確定させる（読み取りアクセスでリフローを強制する定番の手法）。
  // これを入れずに直後printすると、印刷専用のレンダリングパスがレイアウト未確定のまま走り、
  // float要素（サイドノート側）が描画されない不具合が起きたことがあったための予防措置。
  void printDocEl.offsetHeight;
}

// モードに応じて#printDocの中身を組み立てる（本文モードは既存のbuildPrintDoc、pdfモードは
// このファイルの後半で定義するbuildPrintDocPdf）。
function buildPrintDocForCurrentMode() {
  if (currentMode === "pdf") { buildPrintDocPdf(); return; }
  buildPrintDoc();
}

// 印刷直前に「公文書仕様」チェックボックスの状態をprintOfficialMode/printFootnoteModeへ反映する
// （savePdfBtn.onclickとCtrl+Alt+Pのプレビュー、両方の入口で毎回呼ぶ）。
function applyOfficialModeFlags() {
  printOfficialMode = officialModeToggle.checked;
  printFootnoteMode = printOfficialMode;
}

savePdfBtn.onclick = () => {
  try {
    applyOfficialModeFlags();
    buildPrintDocForCurrentMode();
    document.body.classList.add("print-active");
    document.body.classList.toggle("official-mode", printOfficialMode);
    window.print();   // Chromeではこの呼び出しはダイアログが閉じるまでブロックするので、直後にクラスを外してよい
  } finally {
    // buildPrintDoc()やwindow.print()の途中で何か例外が起きても、印刷専用の見た目のまま
    // 編集画面に固まってしまわないよう、必ずクラスを外す。
    document.body.classList.remove("print-active", "official-mode");
  }
};

// デバッグ用：印刷版面をネイティブの印刷ダイアログを開かずに画面上でそのままプレビューする
// （Ctrl+Alt+Pでトグル）。window.print()はOS側の印刷ダイアログを開くため中身を自動化ツールから
// 確認できない。印刷レイアウト（floatの実際の描画）を実機で調整する時はこちらを使う。
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    applyOfficialModeFlags();
    buildPrintDocForCurrentMode();
    const nowActive = document.body.classList.toggle("print-active");
    document.body.classList.toggle("official-mode", nowActive && printOfficialMode);
  }
});

loadInput.onchange = (e) => {
  const file = e.target.files && e.target.files[0];
  loadInput.value = "";   // 同じファイルを続けて開き直せるようにリセット
  if (!file) return;

  // 拡張子で.pdf・.md・.jsonを振り分ける（ボタンは増やさず「開く」1つで全て受け付ける方針）。
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    openPdfFile(file);
    return;
  }
  if (file.type === "text/markdown" || /\.md$/i.test(file.name)) {
    importMarkdownFile(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await applyProjectData(JSON.parse(reader.result));
      setStatus(`読み込みました：${file.name}`);
    } catch (err) {
      console.error(err);
      setStatus("読み込みに失敗しました。ファイルが壊れているか、対応していない形式です。");
    }
  };
  reader.onerror = () => setStatus("読み込みに失敗しました。");
  reader.readAsText(file);
};

// ---- 自動保存（ブラウザ内・安全網） ----
// 明示的な「保存」を忘れてタブを閉じてしまった場合に備え、変更のたびにブラウザ内へも自動保存しておく。
// あくまで安全網なので、保存に失敗しても（容量超過等）エラー表示はしない。
// 画像はdata URLとして doc.innerHTML にそのまま含まれるため、localStorageの容量上限（5MB程度）に
// 画像入りの文書だと届きやすい点に注意（.jsonファイルへの明示保存の方が本命）。
// pdfモードは元PDF自体をdata URLとして丸ごと持つため、数MB超のPDF（複数ページのスキャン等）では
// 自動保存が容量超過で毎回黙って失敗する可能性がかなり高い。この場合も明示的な「保存」（.json書き出し）
// が実質的な唯一の保存手段になる。
const AUTOSAVE_KEY = "sidenote-pdf-autosave-v1";

function autoSave() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProject()));
  } catch (err) {
    // 容量超過等は無視。明示保存（.json書き出し）があるため致命的ではない。
  }
}
const autoSaveDebounced = debounce(autoSave, 800);

// ページを開いた時点で読み込める自動保存があるかどうかを判定し、「続きから再開」の有効/無効を切り替える。
// 以前は条件付きの黄色いバナーで出していたが、常時表示のツールバーボタンに統一したため、
// 「復元できる内容が無い時はボタンを押せなくする」という形でユーザーに知らせる。
// 復元対象のデータはこの関数のクロージャに保持しておき、ボタン押下時にそのまま使う。
function checkAutoSaveOnLoad() {
  let raw;
  try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (err) { raw = null; }
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (err) { data = null; }
  }
  const hasContent = !!(data && (
    (data.mode === "pdf" && data.pdfDataUrl) ||
    (data.mode !== "pdf" && data.docHTML && data.docHTML !== '<div class="para"><br></div>')
  ));

  resumeApplyBtn.disabled = !hasContent;
  resumeApplyBtn.title = hasContent
    ? `ブラウザ内の自動保存を読み込みます（${data.title ? `「${data.title}」・` : ""}自動保存: ${data.savedAt ? new Date(data.savedAt).toLocaleString("ja-JP") : "不明な日時"}）`
    : "復元できる自動保存がありません";

  resumeApplyBtn.onclick = async () => {
    if (!hasContent) return;
    try {
      await applyProjectData(data);
      setStatus("自動保存された内容を復元しました。");
    } catch (err) {
      console.error(err);
      setStatus("復元に失敗しました。");
    }
  };
}
checkAutoSaveOnLoad();

// 「新しい作業」：本文・ノート・画像に加えてタイトルも空にし、自動保存も消す（＝別の案件を新規に始める）。
// pdfモードで押した場合も本文モード（打ち込み編集）へ戻す＝「PDFを開く」はあくまで「開く」経由の
// 個別の入り口という位置づけのため。案件を切り替えずに一部だけ消したい場合は、各段落・画像ブロックの
// ホバー操作（×削除）で個別に消す。
resumeDiscardBtn.onclick = () => {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (err) { /* noop */ }
  setMode("text");
  pdfViewerEl.innerHTML = "";
  currentPdfDoc = null;
  currentPdfDataUrl = null;
  pdfAnchors = [];
  resetDoc();
  notesByAnchor.clear();
  titleInput.value = "";
  // 「項番設定」パネルの内容も文書ごとの設定なので、新しい案件では既定値に戻す。
  paraStyleSettings = JSON.parse(JSON.stringify(DEFAULT_PARA_STYLE_SETTINGS));
  numberingSettings = JSON.parse(JSON.stringify(DEFAULT_NUMBERING_SETTINGS));
  refreshStyleSettingInputs();
  refreshNumberingSettingInputs();
  renumberAndLayout();
  updatePlaceholder();
  updateFormatToolbarState();
  checkAutoSaveOnLoad();   // 復元対象が無くなったので「続きから再開」を無効化し直す
  setStatus("新しい作業を始めます。");
};

// ---- 範囲選択→コメント追加ポップオーバー（本文テキスト向け） ----
doc.addEventListener("mouseup", handleSelection);
doc.addEventListener("touchend", handleSelection);

function getNodePara(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return el ? el.closest(".para") : null;
}

function handleSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!doc.contains(range.commonAncestorContainer)) return;
  if (rangeOverlapsLockedAnchor(range)) return;   // 既存のロック範囲・画像ブロックをまたぐ選択には非対応
  // 複数段落にまたがる選択は「複数段落まとめてインデント」用の選択とみなし、ノート追加欄は出さない
  // （1つのノートは1段落内の一文を引用する前提のため、段落をまたぐ選択はそもそも引用として成立しない）。
  const startPara = getNodePara(range.startContainer);
  const endPara = getNodePara(range.endContainer);
  if (!startPara || !endPara || startPara !== endPara) return;
  pendingTarget = { type: "text", range: range.cloneRange() };
  openPopover(range.getBoundingClientRect());
}

// ---- 色選択（自分／共有相手／重要）----
// 直前に選んだ色をポップオーバーの初期選択にする（毎回選び直す手間を減らす）。
const colorPickerEl = document.getElementById("colorPicker");
function updateColorPickerSelection() {
  colorPickerEl.querySelectorAll(".color-swatch").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.color === lastUsedColor);
  });
}
function updateColorSwatchLabels() {
  colorPickerEl.querySelectorAll(".color-swatch").forEach((btn) => {
    btn.textContent = colorLabel(btn.dataset.color);
  });
}
colorPickerEl.querySelectorAll(".color-swatch").forEach((btn) => {
  btn.onclick = () => {
    lastUsedColor = btn.dataset.color;
    updateColorPickerSelection();
  };
});
updateColorSwatchLabels();

// ---- 「設定」（黒・青の名前）と「ヘルプ」のドロップダウン ----
// 黒・青の名前はこの端末の既定値としてlocalStorageにも残し、次に新規で作る文書にも引き継ぐ
// （個別の.jsonファイルを開いた場合は、そのファイルに保存されている名前が優先される＝applyProjectData側）。
const COLOR_NAMES_KEY = "sidenote-pdf-color-names-v1";
(function loadColorNamesDefault() {
  try {
    const raw = localStorage.getItem(COLOR_NAMES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.black) colorNames.black = parsed.black;
    if (parsed && parsed.blue) colorNames.blue = parsed.blue;
  } catch (err) { /* noop */ }
})();
function saveColorNamesDefault() {
  try { localStorage.setItem(COLOR_NAMES_KEY, JSON.stringify(colorNames)); } catch (err) { /* noop */ }
}
nameBlackInput.value = colorNames.black;
nameBlueInput.value = colorNames.blue;
nameBlackInput.oninput = () => {
  colorNames.black = nameBlackInput.value.trim() || "自分";
  updateColorSwatchLabels();
  saveColorNamesDefault();
  renumberAndLayout();   // 既存ノートの表示名（色ラベル）も更新する
  autoSaveDebounced();
};
nameBlueInput.oninput = () => {
  colorNames.blue = nameBlueInput.value.trim() || "共有相手";
  updateColorSwatchLabels();
  saveColorNamesDefault();
  renumberAndLayout();
  autoSaveDebounced();
};

// サイドノートの名前表示（自分／共有相手／重要）のオンオフ。こちらも端末の個人設定としてlocalStorageへ。
const SHOW_NAMES_KEY = "sidenote-pdf-show-names-v1";
(function loadShowNamesDefault() {
  try {
    const raw = localStorage.getItem(SHOW_NAMES_KEY);
    if (raw !== null) showAuthorLabel = raw === "1";
  } catch (err) { /* noop */ }
})();
showNamesToggle.checked = showAuthorLabel;
showNamesToggle.onchange = () => {
  showAuthorLabel = showNamesToggle.checked;
  try { localStorage.setItem(SHOW_NAMES_KEY, showAuthorLabel ? "1" : "0"); } catch (err) { /* noop */ }
  renumberAndLayout();
};

// 冒頭の機能説明カード（#introSection）の表示オンオフ。「次回から表示しない」（カード側）と
// 「冒頭の機能説明を表示する」（ヘルプ側）は同じ状態を裏表で操作する2つのスイッチなので、
// どちらを動かしても両方のチェック状態を揃える。端末の個人設定としてlocalStorageへ。
const SHOW_INTRO_KEY = "sidenote-pdf-show-intro-v1";
let showIntro = true;
(function loadShowIntroDefault() {
  try {
    const raw = localStorage.getItem(SHOW_INTRO_KEY);
    if (raw !== null) showIntro = raw === "1";
  } catch (err) { /* noop */ }
})();
function applyShowIntro() {
  introSection.hidden = !showIntro;
  introDismissToggle.checked = !showIntro;
  showIntroToggle.checked = showIntro;
}
function setShowIntro(value) {
  showIntro = value;
  try { localStorage.setItem(SHOW_INTRO_KEY, showIntro ? "1" : "0"); } catch (err) { /* noop */ }
  applyShowIntro();
}
applyShowIntro();
introDismissToggle.onchange = () => setShowIntro(!introDismissToggle.checked);
showIntroToggle.onchange = () => setShowIntro(showIntroToggle.checked);

// 「設定」「ヘルプ」は同じ開閉パターン（同じボタンをもう一度押す、または他方を開くと閉じる）。
function toggleDropdownPanel(panelEl, btnEl) {
  const opening = panelEl.hidden;
  document.querySelectorAll(".dropdown-panel").forEach((el) => { el.hidden = true; });
  closePopover();
  if (!opening) return;
  const rect = btnEl.getBoundingClientRect();
  panelEl.hidden = false;
  panelEl.style.top = `${window.scrollY + rect.bottom + 6}px`;
  panelEl.style.left = `${window.scrollX + rect.left}px`;
}
settingsBtn.onclick = () => toggleDropdownPanel(settingsPanel, settingsBtn);
helpBtn.onclick = () => toggleDropdownPanel(helpPanel, helpBtn);
numberingSettingsBtn.onclick = () => toggleDropdownPanel(numberingPanel, numberingSettingsBtn);

// ---- 「項番設定」パネル：見出し（H1〜H3）の見た目と、項番の型ごとのインデント・ぶら下げ ----
// どちらも.jsonに保存する文書ごとの設定（serializeProject/applyProjectData参照）なので、
// localStorageへの端末既定値は持たない（colorNames等とは違う扱い）。
// パネルの入力欄をparaStyleSettings/numberingSettingsの現在値に合わせて表示し直す。
// .json読み込み・「新しい作業」での初期化のたびに呼ぶ。
function refreshStyleSettingInputs() {
  Object.keys(styleSettingInputs).forEach((key) => {
    const s = paraStyleSettings[key];
    styleSettingInputs[key].size.value = s.fontSizePt != null ? String(s.fontSizePt) : "";
    styleSettingInputs[key].bold.checked = !!s.bold;
  });
}
function refreshNumberingSettingInputs() {
  NUMBERING_TYPES.forEach((type) => {
    numberingSettingInputs[type].indent.value = String(numberingSettings[type].indentLevel);
    numberingSettingInputs[type].hanging.value = String(numberingSettings[type].hanging);
  });
}
// 見出しの文字サイズ・太字を変えたら、既にH1〜H3を付けている段落全部に即反映する
// （data属性ではなくparaStyleSettings側が変わるため、単発のapplyParaStyles(paras)では拾えない）。
function reapplyAllParaStyles() {
  applyParaStyles(Array.from(doc.querySelectorAll(".para:not(.para-image)")));
}
Object.keys(styleSettingInputs).forEach((key) => {
  styleSettingInputs[key].size.oninput = () => {
    const raw = styleSettingInputs[key].size.value.trim();
    paraStyleSettings[key].fontSizePt = raw === "" ? null : Number(raw);
    reapplyAllParaStyles();
    autoSaveDebounced();
  };
  styleSettingInputs[key].bold.onchange = () => {
    paraStyleSettings[key].bold = styleSettingInputs[key].bold.checked;
    reapplyAllParaStyles();
    autoSaveDebounced();
  };
});
NUMBERING_TYPES.forEach((type) => {
  numberingSettingInputs[type].indent.onchange = () => {
    numberingSettings[type].indentLevel = Number(numberingSettingInputs[type].indent.value) || 0;
    autoSaveDebounced();
  };
  numberingSettingInputs[type].hanging.onchange = () => {
    numberingSettings[type].hanging = Number(numberingSettingInputs[type].hanging.value) || 0;
    autoSaveDebounced();
  };
});
refreshStyleSettingInputs();
refreshNumberingSettingInputs();

// 段落の行頭テキストが項番の型（第１型／１型／⑴型／ア型）のどれかに一致するかを判定する。
// マッチしなければnull。textContentは配下のspan（傍点・note-anchor等）の入れ子に関わらず
// フラットな文字列を返すので、DOM構造に関わらずこの判定が使える。
function detectNumberingType(paraEl) {
  const text = (paraEl.textContent || "").trimStart();
  for (const type of NUMBERING_TYPES) {
    if (NUMBERING_PATTERNS[type].test(text)) return type;
  }
  return null;
}

// 「項番を一括適用」：文書内の全段落（画像を除く）を先頭から判定し、一致した型の設定
// （インデント・ぶら下げ）を書き込む。既にインデント・ぶら下げを持つ段落のうち、それが
// このボタン自身の適用でついたもの（data-numbered）ではない＝手動で書式を変えた段落は
// 対象から外して保護する（インデント・ぶら下げのボタンを直接押すとdata-numberedは外れる）。
function applyNumbering() {
  const paras = Array.from(doc.querySelectorAll(".para:not(.para-image)"));
  let applied = 0, skipped = 0;
  paras.forEach((p) => {
    const type = detectNumberingType(p);
    if (!type) return;
    const hasManualFormat = (p.dataset.indentLevel || p.dataset.hanging) && !p.dataset.numbered;
    if (hasManualFormat) { skipped++; return; }
    const rule = numberingSettings[type];
    if (rule.indentLevel > 0) p.dataset.indentLevel = String(rule.indentLevel); else delete p.dataset.indentLevel;
    if (rule.hanging > 0) p.dataset.hanging = String(rule.hanging); else delete p.dataset.hanging;
    p.dataset.numbered = type;
    applied++;
  });
  applyParaStyles(paras);
  updateFormatToolbarState();
  autoSaveDebounced();
  setStatus(`項番を適用しました（${applied}段落に適用／手動書式のため${skipped}段落をスキップ）`);
}
applyNumberingBtn.onclick = applyNumbering;

function openPopover(rect) {
  settingsPanel.hidden = true;
  helpPanel.hidden = true;
  numberingPanel.hidden = true;
  popoverInput.value = "";
  popoverEl.hidden = false;
  updateColorPickerSelection();
  updateColorSwatchLabels();
  const top = window.scrollY + rect.bottom + 6;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - popoverEl.offsetWidth - 12;
  const left = Math.min(window.scrollX + rect.left, Math.max(12, maxLeft));
  popoverEl.style.top = `${top}px`;
  popoverEl.style.left = `${left}px`;
  popoverInput.focus();
}

function closePopover() {
  pendingTarget = null;
  popoverEl.hidden = true;
}

document.getElementById("notePopoverCancel").onclick = () => {
  closePopover();
  window.getSelection()?.removeAllRanges();
};

document.getElementById("notePopoverAdd").onclick = () => {
  const text = popoverInput.value.trim();
  if (!text || !pendingTarget) return;

  if (pendingTarget.type === "text") {
    addTextNote(pendingTarget.range, text, lastUsedColor);
  } else if (pendingTarget.type === "image") {
    addImageNote(pendingTarget.paraEl, text, lastUsedColor);
  } else if (pendingTarget.type === "reply") {
    addNoteToAnchor(pendingTarget.anchorId, text, lastUsedColor);
  } else if (pendingTarget.type === "pdftext") {
    addPdfTextNote(pendingTarget.pageEl, pendingTarget.rectsPdf, pendingTarget.quote, text, lastUsedColor);
  } else if (pendingTarget.type === "pdfpoint") {
    addPdfPointNote(pendingTarget.pageEl, pendingTarget.point, text, lastUsedColor);
  } else if (pendingTarget.type === "pdfrect") {
    addPdfRectNote(pendingTarget.pageEl, pendingTarget.rect, text, lastUsedColor);
  }

  closePopover();
  window.getSelection()?.removeAllRanges();
  renumberAndLayout();
  updatePlaceholder();
};

// anchorId（一文のロック範囲、または画像）に1件コメントを積む（＝返信スレッドへの追加）。
// 新規ノート・画像ノート・既存アンカーへの返信のいずれも最終的にここを通る共通の入り口。
function addNoteToAnchor(anchorId, text, color) {
  const note = { id: "r" + replyIdSeq++, text, color: color || "black" };
  if (!notesByAnchor.has(anchorId)) notesByAnchor.set(anchorId, []);
  notesByAnchor.get(anchorId).push(note);
  return note;
}

function addTextNote(range, text, color) {
  const anchorId = "a" + anchorIdSeq++;
  const quoted = range.toString();
  // <mark>は「ハイライト」の意味を持つタグなので使わず、中立な<span>にする。
  // 番号(<sup>)は選択範囲の先頭に置く（末尾ではなく）。
  const html = `<span class="note-anchor" contenteditable="false" data-anchor-id="${anchorId}">` +
    `<sup class="note-num"></sup><span>${escapeHtml(quoted)}</span></span>`;

  // 段落の一番先頭（直前に文字が1つも無い位置）でcontenteditable="false"の要素をinsertHTMLすると、
  // Chromeがその要素を段落の外（.paraの直前の兄弟）へ押し出してしまう既知の挙動がある
  // （文の冒頭を選択して注釈を付けると、注釈が.paraから外れてPDF/MD書き出しの対象から漏れたり
  // 選択範囲より多めの文字を巻き込んだりする不具合として発現する。2026-08-16に実機で発見・特定）。
  // 回避策：直前にゼロ幅スペースを1文字だけ仮に挿し込み、「段落の先頭ちょうど」という条件を
  // 崩してからinsertHTMLする（挿入後は不要なので取り除く）。
  const paraEl = (range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement)?.closest(".para");
  let zwsp = null;
  if (paraEl) {
    const probe = document.createRange();
    probe.setStart(paraEl, 0);
    probe.setEnd(range.startContainer, range.startOffset);
    if (probe.toString().length === 0) {
      zwsp = document.createTextNode("​");
      paraEl.insertBefore(zwsp, paraEl.firstChild);
    }
  }
  // 段落の一番末尾（直後に文字が1つも無い位置）まで選択した場合も、上と対称の同じ不具合が起きる
  // （選択範囲の最後の文字にかかった注釈が.paraの外＝直後の兄弟へ押し出され、.paraはdiv＝ブロック要素
  // なので見た目上そこで改行されたようになる）。回避策も対称：末尾にゼロ幅スペースを仮に足しておく。
  let zwspEnd = null;
  if (paraEl) {
    const probeEnd = document.createRange();
    probeEnd.setStart(range.endContainer, range.endOffset);
    probeEnd.setEnd(paraEl, paraEl.childNodes.length);
    if (probeEnd.toString().length === 0) {
      zwspEnd = document.createTextNode("​");
      paraEl.appendChild(zwspEnd);
    }
  }

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  // execCommand('insertHTML')経由にすると、ノート追加もブラウザのundo履歴(Ctrl+Z)に乗る
  // （insertNodeなど直接のDOM操作はundo履歴の対象外になってしまうため使わない）。
  // ※execCommandの戻り値は信用せず、実際にDOMへ挿入されたかで成否判定する（二重挿入バグの教訓）。
  document.execCommand && document.execCommand("insertHTML", false, html);
  if (zwsp) zwsp.remove();
  if (zwspEnd) zwspEnd.remove();
  if (!doc.querySelector(`[data-anchor-id="${anchorId}"]`)) {
    // 本当に失敗した場合のみのフォールバック（この経路のみundo対象外）
    const anchor = document.createElement("span");
    anchor.className = "note-anchor";
    anchor.contentEditable = "false";
    anchor.dataset.anchorId = anchorId;
    const sup = document.createElement("sup");
    sup.className = "note-num";
    anchor.appendChild(sup);
    const contentSpan = document.createElement("span");
    contentSpan.appendChild(range.extractContents());
    anchor.appendChild(contentSpan);
    range.insertNode(anchor);
  }
  addNoteToAnchor(anchorId, text, color);
}

// ---- 画像ブロック（スクショ） ----
// カーソル位置の.paraを起点に execCommand ではなく直接DOM操作で挿入する。
// contenteditable内でブロック要素をカーソル位置へinsertHTMLすると、既存の.para内に
// ネストして壊れることがあるため、確実に「現在の段落の直後」に兄弟要素として差し込む方式にした。
// 代わりにこの操作自体はCtrl+Zのundo対象外になる（削除は×ボタンで行う・既知の制約）。
function getCurrentParaOrLast() {
  return getCurrentPara() || doc.querySelector(".para:last-child, .para-image:last-child") || doc.lastElementChild;
}

function buildAndInsertImageBlock(file, afterEl, onInserted) {
  const reader = new FileReader();
  reader.onload = () => {
    const paraId = "img" + imageIdSeq++;
    const wrap = buildImageParaEl(paraId, reader.result);
    if (afterEl && afterEl.parentElement === doc) afterEl.insertAdjacentElement("afterend", wrap);
    else doc.appendChild(wrap);
    // 画像が文書の一番最後に来ると、その下に続きを打つための段落が無くなり編集できなくなるため、
    // 画像の後に何も無ければ空の.paraを1つ用意しておく（クリックすれば続けて入力できる）。
    if (!wrap.nextElementSibling) {
      const trailingPara = document.createElement("div");
      trailingPara.className = "para";
      trailingPara.innerHTML = "<br>";
      wrap.insertAdjacentElement("afterend", trailingPara);
    }
    bindImageParaEvents(wrap);
    updatePlaceholder();
    renumberAndLayout();
    autoSaveDebounced();
    onInserted && onInserted(wrap);
  };
  reader.readAsDataURL(file);
}

function insertImageBlock(file) {
  buildAndInsertImageBlock(file, getCurrentParaOrLast());
}

function buildImageParaEl(paraId, dataUrl) {
  const wrap = document.createElement("div");
  wrap.className = "para para-image";
  wrap.contentEditable = "false";
  wrap.dataset.paraId = paraId;

  const inner = document.createElement("div");
  inner.className = "para-image-inner";

  const meta = document.createElement("div");
  meta.className = "para-image-meta";

  const noteBtn = document.createElement("button");
  noteBtn.type = "button";
  noteBtn.className = "para-image-note-btn";
  noteBtn.textContent = "＋ ノート";
  noteBtn.title = "この画像にコメントを追加（出典はサイドノートに記載してください）";
  meta.appendChild(noteBtn);

  // JIMDO的なブロック単位の操作に合わせ、画像ブロック自体にも削除ボタンを常設する
  // （contentEditable="false"のブロックなのでボタンを内包しても本文の編集対象に混ざらない）。
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "para-image-del-btn";
  delBtn.innerHTML = ICON_X;
  delBtn.title = "この画像を削除";
  meta.appendChild(delBtn);

  inner.appendChild(meta);

  const img = document.createElement("img");
  img.className = "para-image-img";
  img.src = dataUrl;
  img.alt = "スクショ";
  inner.appendChild(img);

  // 通し番号バッジも画像より上に置く（テキストの方も選択範囲の先頭に番号を置く設計なので、それに揃える）。
  const notesRow = document.createElement("div");
  notesRow.className = "para-image-notes";
  wrap.appendChild(notesRow);
  wrap.appendChild(inner);

  return wrap;
}

// applyProjectData()でのdoc.innerHTML再代入後は既存のリスナーが失われるため、
// 新規作成時・復元時のどちらからも呼べる形にしてある（冪等：何度呼んでも上書きするだけ）。
function bindImageParaEvents(wrap) {
  const noteBtn = wrap.querySelector(".para-image-note-btn");

  noteBtn.onclick = () => {
    pendingTarget = { type: "image", paraEl: wrap };
    openPopover(noteBtn.getBoundingClientRect());
  };

  wrap.querySelector(".para-image-del-btn").onclick = () => deletePara(wrap);
}

// 画像は原文のロックが無い分テキストより単純：画像自身のparaIdをそのままアンカーIDとして使う
// （画像1枚につき通し番号バッジは1つだけ。複数コメントはそのバッジの下にスレッドとして並ぶ）。
function addImageNote(paraEl, text, color) {
  addNoteToAnchor(paraEl.dataset.paraId, text, color);
  ensureImageNoteBadge(paraEl);
}

function ensureImageNoteBadge(paraEl) {
  const notesRow = paraEl.querySelector(".para-image-notes");
  if (notesRow.querySelector(".note-anchor")) return;
  const badge = document.createElement("span");
  badge.className = "note-anchor img-note-anchor";
  badge.dataset.anchorId = paraEl.dataset.paraId;
  const sup = document.createElement("sup");
  sup.className = "note-num";
  badge.appendChild(sup);
  notesRow.appendChild(badge);
}

// 複数ファイルを「選択順のまま、指定した段落の直後」へ連続挿入する。
// FileReaderは非同期なので、forEachで並行に読ませると完了順が入れ替わり挿入順が崩れる。
// 1件ずつ「直前に挿入した画像の直後」へ差し込むよう直列化して、選択順を保つ。
function insertImageFilesAfter(files, afterEl) {
  let cur = afterEl;
  const insertNext = (i) => {
    if (i >= files.length) return;
    buildAndInsertImageBlock(files[i], cur, (wrap) => {
      cur = wrap;
      insertNext(i + 1);
    });
  };
  insertNext(0);
}

// ---- 段落ホバー時の操作（＋画像／×削除）----
// JIMDOのようなブロック単位の操作にするため、グローバルな「スクショ」「文書をクリア」ボタンは廃止し、
// 段落にカーソルを乗せた時だけ、その段落の直後に画像を挿入／その段落自体を削除するアイコンを出す。
// これらのアイコンは#doc（contenteditable）の外側の要素として1つだけ用意し、位置だけをJSで合わせる
// （#docの中に直接ボタンを置くと、保存(.json)やPDF印刷が本文の一部としてボタンまで拾ってしまうため）。
const paraHoverEl = document.getElementById("paraHover");
const paraHoverFileInput = document.getElementById("paraHoverFile");
const paraHoverDelBtn = document.getElementById("paraHoverDel");
let hoveredPara = null;

function showParaHover(para) {
  cancelParaHoverHide();
  if (para === hoveredPara) return;   // 同じ段落内を動いただけなら位置の再計算は不要
  hoveredPara = para;
  const pRect = para.getBoundingClientRect();
  const hostRect = docLeftEl.getBoundingClientRect();
  // -4pxはCSSのpadding分の補正（ボタン自体の見た目の位置が段落の先頭行と揃うようにする）。
  paraHoverEl.style.top = `${pRect.top - hostRect.top - 4}px`;
  paraHoverEl.hidden = false;
}
function hideParaHover() {
  hoveredPara = null;
  paraHoverEl.hidden = true;
}

// .paraはmax-width:37emで#docより幅が狭いため、段落からアイコンへ向かってマウスを動かすと
// 「#docの中だが.paraの外」という隙間を必ず一度通る。隙間で即座に隠すとアイコンに手が届かず
// クリックできない不具合になるため、隠すのは少し待ってから（＝離れた先で.paraかアイコン自体に
// 入り直せば隠さない）にする。よくある「hover intent」の遅延パターン。
let paraHoverHideTimer = null;
function scheduleParaHoverHide() {
  clearTimeout(paraHoverHideTimer);
  paraHoverHideTimer = setTimeout(hideParaHover, 400);
}
function cancelParaHoverHide() {
  clearTimeout(paraHoverHideTimer);
}

doc.addEventListener("mouseover", (e) => {
  const para = e.target.closest(".para");
  // 画像ブロックは専用の削除ボタンを自身の中に持つため、テキスト段落だけを対象にする。
  if (para && !para.classList.contains("para-image")) showParaHover(para);
});
doc.addEventListener("mouseout", scheduleParaHoverHide);
paraHoverEl.addEventListener("mouseenter", cancelParaHoverHide);
paraHoverEl.addEventListener("mouseleave", scheduleParaHoverHide);

paraHoverFileInput.onchange = (e) => {
  const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
  paraHoverFileInput.value = "";   // 同じファイルを続けて選び直せるようにリセット
  if (!files.length || !hoveredPara) return;
  insertImageFilesAfter(files, hoveredPara);
};

paraHoverDelBtn.onclick = () => {
  if (hoveredPara) deletePara(hoveredPara);
};

// 段落（テキスト・画像どちらも）を1つ削除する。文書は常に最低1つの.paraを持つ、という
// resetDoc()以来の前提を守るため、残り1つになる場合は削除せず空のテキスト段落に戻す。
function deletePara(para) {
  const remaining = doc.querySelectorAll(".para").length;
  if (remaining <= 1) {
    para.className = "para";
    para.removeAttribute("data-para-id");
    para.removeAttribute("contenteditable");   // .para-imageで付けたcontentEditable="false"を解除
    para.removeAttribute("style");   // 配置・インデント・ぶら下げ・スタイルの見た目もリセットする
    delete para.dataset.indentLevel;
    delete para.dataset.hanging;
    delete para.dataset.align;
    delete para.dataset.style;
    delete para.dataset.numbered;
    para.innerHTML = "<br>";
  } else {
    para.remove();
  }
  hideParaHover();
  updatePlaceholder();
  renumberAndLayout();
  autoSaveDebounced();
}

// Ctrl+B / Ctrl+U で選択範囲を **太字** / <u>下線</u> に囲む（ノート入力欄）
function wrapSelection(textarea, before, after) {
  const start = textarea.selectionStart, end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const insertion = before + selected + after;
  textarea.focus();
  textarea.setSelectionRange(start, end);
  const inserted = document.execCommand && document.execCommand("insertText", false, insertion);
  if (!inserted) textarea.value = value.slice(0, start) + insertion + value.slice(end);
  const selStart = start + before.length;
  textarea.setSelectionRange(selStart, selStart + selected.length);
}
popoverInput.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === "b" || e.key === "B") { e.preventDefault(); wrapSelection(popoverInput, "**", "**"); }
  else if (e.key === "u" || e.key === "U") { e.preventDefault(); wrapSelection(popoverInput, "<u>", "</u>"); }
});

doc.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); insertNewParagraph(); return; }
  // Ctrl+Zはここでは何も処理しない＝ブラウザのネイティブundoにそのまま任せる。
  // 上のノート追加/削除をexecCommand経由にしたのは、まさにこのネイティブundoの対象に含めるため。
});

// Enterで新しい.para（段落）を作る。ブラウザ標準のEnter挙動任せだとclass="para"の無い
// ただの<div>やbrになり、通し番号・サイドノート配置の単位（.para）として扱えなくなるため、自前で挿入して制御する。
function insertNewParagraph() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!doc.contains(range.commonAncestorContainer)) return;
  if (rangeOverlapsLockedAnchor(range)) return;
  const currentPara = getCurrentPara();   // Enter前の段落。配置・インデント・ぶら下げ・スタイルを引き継ぐために控えておく

  // 挿入した.paraを一時属性で目印してすぐ拾い、カーソルをその中（brの手前＝空行の先頭）に置く。
  document.execCommand("insertHTML", false, '<div class="para" data-new-para="1"><br></div>');
  const newPara = doc.querySelector('.para[data-new-para="1"]');
  if (!newPara) return;
  newPara.removeAttribute("data-new-para");
  if (currentPara) inheritParaFormat(currentPara, newPara);

  const r = document.createRange();
  r.setStart(newPara, 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

// ---- 本文（#doc）の書式ツールバー：配置／インデント／ぶら下げ／太字下線／傍点／スタイル ----
// 配置・インデント・ぶら下げ・スタイルは「段落」の属性として扱う（カーソルのある1段落、
// または選択範囲が複数段落にまたがる場合はその全段落）。太字・下線・傍点だけは選択した文字への
// 適用にする。画像ブロックはテキストの書式という性質上、対象から外す。
// 段落pの内容が選択範囲rangeと実際に重なっているか（両端が触れているだけ＝実際には0文字の
// 重なりは除く）。range.intersectsNode(p)は使わない：ある段落をちょうど末尾まで選択した時
// （triple-clickでの1段落選択が典型）、選択範囲の終端が「次の段落の先頭（offset 0）」という
// 形で表現されることがあり、その場合intersectsNodeは次の段落にも触れているとみなしてtrueを
// 返してしまう（実機で確認：1段落だけをtriple-clickで選択して書式を適用したはずが、次の段落
// にも配置・文字サイズが漏れて適用されるバグとして発現した）。両端の厳密な前後比較なら
// この「触れているだけ」のケースを正しく除外できる。
function paraOverlapsRange(p, range) {
  const pRange = document.createRange();
  pRange.selectNodeContents(p);
  const startsBeforeParaEnds = range.compareBoundaryPoints(Range.END_TO_START, pRange) < 0;
  const endsAfterParaStarts = range.compareBoundaryPoints(Range.START_TO_END, pRange) > 0;
  return startsBeforeParaEnds && endsAfterParaStarts;
}

function getTargetParas() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    if (doc.contains(range.commonAncestorContainer)) {
      const paras = Array.from(doc.querySelectorAll(".para:not(.para-image)"))
        .filter((p) => paraOverlapsRange(p, range));
      if (paras.length) return paras;
    }
  }
  const cur = getCurrentPara();
  return cur && !cur.classList.contains("para-image") ? [cur] : [];
}

// data属性（唯一の情報源）から、画面表示用のインラインスタイルを組み立て直す。
// applyProjectData()での.json読み込み直後にも呼び、旧ファイル・手編集ファイルとの整合を保つ。
function applyParaStyles(paras) {
  paras.forEach((p) => {
    const level = Number(p.dataset.indentLevel || 0);
    const hangingChars = Number(p.dataset.hanging || 0);
    if (level > 0 || hangingChars > 0) {
      p.style.paddingLeft = `${level * INDENT_STEP_EM + hangingChars * HANGING_CHAR_EM}em`;
      p.style.textIndent = hangingChars > 0 ? `-${hangingChars * HANGING_CHAR_EM}em` : "0";
    } else {
      p.style.paddingLeft = "";
      p.style.textIndent = "";
    }
    p.style.textAlign = p.dataset.align || "";
    // 見出しの実際の見た目（文字サイズ・太字）は「項番設定」パネルのparaStyleSettingsから引く
    // （fontSizePtがnull＝本文と同じ文字サイズのまま、boldだけ独立して効かせる）。
    const styleLook = paraStyleSettings[p.dataset.style];
    p.style.fontSize = (styleLook && styleLook.fontSizePt) ? `${styleLook.fontSizePt}pt` : "";
    p.style.fontWeight = (styleLook && styleLook.bold) ? "700" : "";
  });
}

// Enterで段落を分けた直後は、直前の段落の配置・インデント・ぶら下げ・スタイルを引き継ぐ
// （準備書面等の番号付き項目を続けて書く時、行ごとに書式を付け直さずに済むようにするため）。
// 太字・下線は文字への書式なので対象外（新しい行の頭は素の状態から始まる）。
function inheritParaFormat(fromPara, toPara) {
  ["indentLevel", "hanging", "align", "style"].forEach((key) => {
    if (fromPara.dataset[key] !== undefined) toPara.dataset[key] = fromPara.dataset[key];
  });
  applyParaStyles([toPara]);
}

function applyAlign(align) {
  const paras = getTargetParas();
  if (!paras.length) return;
  paras.forEach((p) => { if (align === "left") delete p.dataset.align; else p.dataset.align = align; });
  applyParaStyles(paras);
  updateFormatToolbarState();
  autoSaveDebounced();
}
alignBtns.forEach((btn) => { btn.onclick = () => applyAlign(btn.dataset.align); });

function applyIndentStep(delta) {
  const paras = getTargetParas();
  if (!paras.length) return;
  paras.forEach((p) => {
    const level = Math.max(0, Math.min(INDENT_LEVEL_MAX, Number(p.dataset.indentLevel || 0) + delta));
    if (level === 0) delete p.dataset.indentLevel; else p.dataset.indentLevel = String(level);
    delete p.dataset.numbered;   // 手動で変えた段落は「項番を一括適用」の対象から外して保護する
  });
  applyParaStyles(paras);
  updateFormatToolbarState();
  autoSaveDebounced();
}
indentDecBtn.onclick = () => applyIndentStep(-1);
indentIncBtn.onclick = () => applyIndentStep(1);

// ぶら下げは0（なし）〜3文字の幅から選ぶ（インデントと同じ−／＋のステッパー式）。
function applyHangingStep(delta) {
  const paras = getTargetParas();
  if (!paras.length) return;
  paras.forEach((p) => {
    const chars = Math.max(0, Math.min(HANGING_MAX, Number(p.dataset.hanging || 0) + delta));
    if (chars === 0) delete p.dataset.hanging; else p.dataset.hanging = String(chars);
    delete p.dataset.numbered;   // 手動で変えた段落は「項番を一括適用」の対象から外して保護する
  });
  applyParaStyles(paras);
  updateFormatToolbarState();
  autoSaveDebounced();
}
hangingDecBtn.onclick = () => applyHangingStep(-1);
hangingIncBtn.onclick = () => applyHangingStep(1);

// スタイルは「本文」（data-style無し）とH1〜H3の排他選択（配置と同じ考え方）。
function applyStyle(styleKey) {
  const paras = getTargetParas();
  if (!paras.length) return;
  paras.forEach((p) => { if (!styleKey) delete p.dataset.style; else p.dataset.style = styleKey; });
  applyParaStyles(paras);
  updateFormatToolbarState();
  autoSaveDebounced();
}
styleBtns.forEach((btn) => { btn.onclick = () => applyStyle(btn.dataset.style); });

// 太字・下線は選択した文字へ（execCommand経由＝Ctrl+Zのundo対象にもなる）。
// 選択が折りたたまれている（カーソルだけ）場合はブラウザ標準の挙動として、以後タイプする文字に適用される。
function applyInlineFormat(cmd) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!doc.contains(range.commonAncestorContainer)) return;
  if (!sel.isCollapsed && rangeOverlapsLockedAnchor(range)) return;   // 既存の注釈・画像をまたぐ範囲には適用しない
  document.execCommand(cmd);
  updateFormatToolbarState();
  autoSaveDebounced();
}
boldBtn.onclick = () => applyInlineFormat("bold");
underlineBtn.onclick = () => applyInlineFormat("underline");

// 傍点は太字・下線と違いブラウザ標準のexecCommandが無いため、note-anchor（範囲選択→ロック）と
// 同じ考え方の自前実装にする：選択範囲を<span class="kenten">で囲む（execCommand("insertHTML")
// 経由でCtrl+Zのundo対象にする）。既に選択範囲がまるごと1つの.kentenと一致する場合は解除する
// （removeNoteFromAnchor()の「注釈を外して原文を書き戻す」と同じ手順）。
// 太字・下線と違い「以後の入力に適用」は持たない（execCommandの標準機能ではないため）ので、
// 範囲選択が無い（カーソルだけの）場合は何もしない。
// 制約：選択範囲が既存の.kentenの一部だけにまたがる場合（完全一致しない部分的な重なり）は
// 解除ではなく二重に囲む形になる（頻度の低いケースとして許容する）。
function toggleKenten() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!doc.contains(range.commonAncestorContainer)) return;
  if (rangeOverlapsLockedAnchor(range)) return;

  const container = range.commonAncestorContainer;
  const containerEl = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
  const existingKenten = containerEl ? containerEl.closest(".kenten") : null;

  if (existingKenten && doc.contains(existingKenten) && existingKenten.textContent === range.toString()) {
    // .kentenは（note-anchorと違い）contenteditable="false"の非編集アイランドではない普通のspanなので、
    // removeNoteFromAnchor()と同じ「selectNode()して execCommand("insertText") 」パターンは使えない
    // （実機で確認：execCommandはtrueを返すのにDOMは変化しないという罠がある。おそらく編集可能な
    // 要素をまるごと選択した状態はinsertTextが想定するテキスト位置の選択と解釈が違うため）。
    // 代わりに execCommand("delete") で選択中の要素を確実に削除してから、その後の
    // 折りたたまれたカーソル位置へ execCommand("insertText") でプレーンテキストを差し戻す
    // （2段階に分けてもどちらもexecCommand経由なのでCtrl+Zのundo対象のまま）。
    const text = existingKenten.textContent;
    const r = document.createRange();
    r.selectNode(existingKenten);
    sel.removeAllRanges();
    sel.addRange(r);
    const deleted = document.execCommand && document.execCommand("delete", false);
    const replaced = deleted && document.execCommand("insertText", false, text);
    if (!replaced) existingKenten.replaceWith(document.createTextNode(text));
  } else {
    const html = `<span class="kenten">${escapeHtml(range.toString())}</span>`;
    document.execCommand("insertHTML", false, html);
  }
  updateFormatToolbarState();
  autoSaveDebounced();
}
kentenBtn.onclick = toggleKenten;

// ツールバーのボタンをクリックしても#docのフォーカス・選択範囲を失わないようにする
// （失うと、どの段落・どの文字範囲に適用すべきか分からなくなるため。定番のmousedown+preventDefault）。
formatToolbarEl.addEventListener("mousedown", (e) => {
  if (e.target.closest("button")) e.preventDefault();
});

// 現在のカーソル位置（または選択）に応じて、ツールバーの状態（選択中の配置・ぶら下げ・スタイルの
// 強調表示、インデントの上下限での無効化、太字・下線の強調表示）を更新する。
function updateFormatToolbarState() {
  const paras = getTargetParas();
  const p = paras[0] || null;

  const align = p ? (p.dataset.align || "left") : "left";
  alignBtns.forEach((btn) => btn.classList.toggle("active", !!p && btn.dataset.align === align));

  const hangingChars = p ? Number(p.dataset.hanging || 0) : 0;
  hangingLabel.textContent = hangingChars > 0 ? `${hangingChars}字` : "オフ";
  hangingDecBtn.disabled = !p || hangingChars <= 0;
  hangingIncBtn.disabled = !p || hangingChars >= HANGING_MAX;

  const indentLevel = p ? Number(p.dataset.indentLevel || 0) : 0;
  indentDecBtn.disabled = !p || indentLevel <= 0;
  indentIncBtn.disabled = !p || indentLevel >= INDENT_LEVEL_MAX;

  const styleKey = p ? (p.dataset.style || "") : "";
  styleBtns.forEach((btn) => btn.classList.toggle("active", !!p && (btn.dataset.style || "") === styleKey));

  let boldActive = false, underlineActive = false;
  try {
    boldActive = document.queryCommandState("bold");
    underlineActive = document.queryCommandState("underline");
  } catch (err) { /* 選択が#docの外にある等、状態取得できない場合は非アクティブ扱い */ }
  boldBtn.classList.toggle("active", boldActive);
  underlineBtn.classList.toggle("active", underlineActive);

  // 傍点にはqueryCommandStateの対応が無いため、選択位置が.kentenの中かどうかを自前で見る。
  const sel2 = window.getSelection();
  const anchorNode = sel2 && sel2.rangeCount ? sel2.anchorNode : null;
  const anchorEl = anchorNode && (anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentElement);
  kentenBtn.classList.toggle("active", !!(anchorEl && doc.contains(anchorEl) && anchorEl.closest(".kenten")));
}
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && doc.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    updateFormatToolbarState();
  }
});

// 画像挿入位置（カーソルが属する.para）を求めるのに使う。
function getCurrentPara() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType !== 1) node = node.parentElement;
  return node ? node.closest(".para") : null;
}

// ---- コメント削除（スレッドの1件だけ削除／最後の1件を消したらロックも解除） ----
function removeNoteFromAnchor(anchor, anchorId, noteId) {
  const remaining = (notesByAnchor.get(anchorId) || []).filter((n) => n.id !== noteId);

  if (remaining.length > 0) {
    notesByAnchor.set(anchorId, remaining);
  } else {
    notesByAnchor.delete(anchorId);
    // スレッドが空になった＝ロック解除。画像はバッジを外すだけ（画像本体は残す）、
    // テキストは引用していた原文をそのまま書き戻して編集可能に戻す。
    // pdfモードのマーク（テキスト／点／矩形）はそもそも「原文を差し替える」概念が無い
    // （PDFページ自体は不変）ので、正本のpdfAnchorsから外してマーク要素を消すだけでよい。
    if (anchor.classList.contains("pdf-mark")) {
      pdfAnchors = pdfAnchors.filter((a) => a.anchorId !== anchorId);
      anchor.remove();
    } else if (anchor.classList.contains("img-note-anchor")) {
      anchor.remove();
    } else {
      const contentSpan = anchor.querySelector("span");
      const text = contentSpan ? contentSpan.textContent : "";
      const range = document.createRange();
      range.selectNode(anchor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const replaced = document.execCommand && document.execCommand("insertText", false, text);   // これもCtrl+Z対象にするため
      if (!replaced) anchor.replaceWith(document.createTextNode(text));
    }
  }

  renumberAndLayout();
  updatePlaceholder();
  autoSaveDebounced();
}

// ---- 通し番号を振り直して、右側にサイドノートを配置する ----
// 貼り付け（doc.addEventListener("paste", ...)）でexecCommand('insertHTML')に複数行分の
// <div class="para">...</div>をまとめて渡すと、カーソルが既存の（多くは最初の空の）.paraの中に
// あった場合、Chromeがそれらを兄弟として展開せず、既存の.paraの中に入れ子にしてしまうことがある
// （2026-08-17、実際のユーザーファイルで発覚：入れ子になった結果、印刷・MD書き出しが段落・注釈を
// 直下しか見ない設計のため、注釈が一つも出力されなくなっていた）。
// 入れ子の.paraを見つけたら、外側の.paraをその中身（＝本来並ぶはずだった複数の.para）で
// 置き換えて1階層引き上げる。renumberAndLayout()は貼り付け後のinputイベント・.json読み込み後
// （applyProjectData）を含め編集の度に呼ばれるため、ここに置くことで自己修復として機能する。
function flattenNestedParas(root) {
  let changed = true;
  while (changed) {
    changed = false;
    Array.from(root.children).forEach((el) => {
      if (!el.classList || !el.classList.contains("para")) return;
      const hasNestedPara = Array.from(el.children).some((c) => c.classList && c.classList.contains("para"));
      if (!hasNestedPara) return;
      const frag = document.createDocumentFragment();
      Array.from(el.childNodes).forEach((n) => frag.appendChild(n));
      el.replaceWith(frag);
      changed = true;
    });
  }
}

// モードに応じて振り分ける（呼び出し側は既存のまま「renumberAndLayout()」を呼べばよい）。
function renumberAndLayout() {
  if (currentMode === "pdf") { renumberAndLayoutPdf(); return; }
  renumberAndLayoutText();
}

// anchorはdoc内に実体として存在するので、querySelectorAllの結果＝そのまま文書内の出現順になる
// （テキストのノート・画像のノートを問わず、DOM上の登場順で自動的に混ざる）。
function renumberAndLayoutText() {
  flattenNestedParas(doc);
  const anchors = Array.from(doc.querySelectorAll(".note-anchor"));
  // 画像ブロックがBackspace等でDOMごと消えた場合、notesByAnchorにそのIDだけ残ってしまうので、
  // 実際に文書内に存在するIDだけ残す（ゴミの蓄積・書き出し時の混入を防ぐ）。
  const liveAnchorIds = new Set(anchors.map((a) => a.dataset.anchorId));
  Array.from(notesByAnchor.keys()).forEach((id) => {
    if (!liveAnchorIds.has(id)) notesByAnchor.delete(id);
  });

  const ordered = anchors.map((anchor, i) => {
    const num = i + 1;
    const supEl = anchor.querySelector(".note-num");
    if (supEl) supEl.textContent = String(num);
    const anchorId = anchor.dataset.anchorId;
    return { num, mark: anchor, anchorId, notes: notesByAnchor.get(anchorId) || [] };
  });
  updateImageNoteButtons();
  layoutSidenotes(ordered);
}

// pdfモード版：マークはページをまたいで#pdfViewer内に散らばっているので、DOM登場順ではなく
// 「ページ番号→ページ内での縦位置」で明示的に並べ替えてから通し番号を振る
// （ページのDOM挿入順は必ずページ番号順だが、1ページ内の複数マークは追加した順にDOMへ積まれるだけで
// 縦位置の順とは限らないため）。それ以外（liveAnchorIdsの掃除、layoutSidenotesへ渡す最終形）は
// renumberAndLayoutTextと同じ形にそろえ、layoutSidenotes自体は完全に共通のまま使う。
function renumberAndLayoutPdf() {
  const marks = Array.from(pdfViewerEl.querySelectorAll(".pdf-mark"));
  const liveAnchorIds = new Set(marks.map((m) => m.dataset.anchorId));
  Array.from(notesByAnchor.keys()).forEach((id) => {
    if (!liveAnchorIds.has(id)) notesByAnchor.delete(id);
  });
  pdfAnchors = pdfAnchors.filter((a) => liveAnchorIds.has(a.anchorId));

  marks.sort((a, b) => {
    const pa = Number(a.closest(".pdf-page").dataset.pageIndex);
    const pb = Number(b.closest(".pdf-page").dataset.pageIndex);
    if (pa !== pb) return pa - pb;
    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  });

  const ordered = marks.map((mark, i) => {
    const num = i + 1;
    // テキスト／点マークは要素自身のtextContentが番号（バッジそのものなので）。
    // 矩形マークだけは要素自体が枠線の四角なので、角に乗せた子バッジ(.pdf-mark-rect-num)に書く。
    const numEl = mark.classList.contains("pdf-mark-rect") ? mark.querySelector(".pdf-mark-rect-num") : mark;
    if (numEl) numEl.textContent = String(num);
    const anchorId = mark.dataset.anchorId;
    return { num, mark, anchorId, notes: notesByAnchor.get(anchorId) || [] };
  });
  layoutSidenotes(ordered);
}

// コメントが既に付いている画像は、右のサイドノートにある「＋ 返信」で追記できるので、
// 画像側の「＋ ノート」ボタンは（紛らわしいので）隠す。コメントが0件に戻れば再表示する。
function updateImageNoteButtons() {
  doc.querySelectorAll(".para-image").forEach((el) => {
    const hasNotes = (notesByAnchor.get(el.dataset.paraId) || []).length > 0;
    const btn = el.querySelector(".para-image-note-btn");
    if (btn) btn.hidden = hasNotes;
  });
}

// 画像のサイドノートは、バッジ（.img-note-anchor）ではなく画像自体の上端に高さを揃える方が分かりやすいため、
// 位置決めだけは画像要素のrectを使う（通し番号・スレッドの紐付けはバッジ＝mark側のまま変えない）。
function getPositionRect(mark) {
  if (mark.classList.contains("img-note-anchor")) {
    const img = mark.closest(".para-image")?.querySelector(".para-image-img");
    if (img) return img.getBoundingClientRect();
  }
  return mark.getBoundingClientRect();
}

function layoutSidenotes(ordered) {
  docRightEl.innerHTML = "";
  if (ordered.length === 0) {
    // 注釈が1件も無い間は、使い方が伝わるようグレーアウトの見本カードを1枚だけ出しておく
    // （実際のノートを1件でも付けた瞬間に消える。本文側の見本＜#docSample＞とは別に、
    // こちらは「注釈が0件かどうか」で独立して出し分ける）。
    const sample = document.createElement("div");
    sample.className = "sidenote-card sidenote-sample";
    sample.setAttribute("aria-hidden", "true");
    sample.style.top = "20px";
    sample.innerHTML = '<span class="sidenote-num">1</span>' +
      '<span class="sidenote-text">（例）ここに相手方や自分へのコメントが入ります</span>';
    docRightEl.appendChild(sample);
    return;
  }
  // 原点は「今表示している方」の左カラムの上端（本文モードは#doc、pdfモードは#pdfViewer）。
  const originTop = (currentMode === "pdf" ? pdfViewerEl : doc).getBoundingClientRect().top;
  const GAP = 20;   // 罫線ではなく余白で個々のノートを区切るため、番号+枠線を使っていた頃より広めに取る
  let prevBottom = -Infinity;

  ordered.forEach((n) => {
    const card = document.createElement("div");
    card.className = "sidenote-card";

    const numEl = document.createElement("span");
    numEl.className = "sidenote-num";
    numEl.textContent = String(n.num);
    card.appendChild(numEl);

    // 1つの通し番号の下に、自分・共有相手それぞれのコメントを色分けして積む（返信スレッド）。
    n.notes.forEach((note) => {
      const entry = document.createElement("div");
      entry.className = "sidenote-entry";

      const textEl = document.createElement("span");
      textEl.className = "sidenote-text";
      textEl.style.color = AUTHOR_COLOR_HEX[note.color] || AUTHOR_COLOR_HEX.black;
      // 名前表示は「設定」のオンオフに従う（色分けだけで足りる場合は非表示にできる）。
      // md書き出し側は常に名前を含める＝別扱い（色の情報がそのまま持ち込めないため）。
      const namePrefix = showAuthorLabel ? `<strong>${escapeHtml(colorLabel(note.color))}：</strong>` : "";
      textEl.innerHTML = namePrefix + formatNoteText(note.text);

      const rmBtn = document.createElement("button");
      rmBtn.className = "sidenote-rm";
      rmBtn.type = "button";
      rmBtn.innerHTML = ICON_X;
      rmBtn.title = n.notes.length > 1 ? "このコメントを削除" : "このコメントを削除（ロックも解除）";
      rmBtn.onclick = () => removeNoteFromAnchor(n.mark, n.anchorId, note.id);

      entry.appendChild(textEl);
      entry.appendChild(rmBtn);
      card.appendChild(entry);
    });

    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "sidenote-reply-btn";
    replyBtn.textContent = "＋ 返信";
    replyBtn.title = "この一文にコメントを追加する";
    replyBtn.onclick = () => {
      pendingTarget = { type: "reply", anchorId: n.anchorId };
      openPopover(replyBtn.getBoundingClientRect());
    };
    card.appendChild(replyBtn);

    docRightEl.appendChild(card);

    const r = getPositionRect(n.mark);
    let top = r.top - originTop;
    if (top < prevBottom + GAP) top = prevBottom + GAP;
    card.style.top = `${top}px`;
    prevBottom = top + card.getBoundingClientRect().height;
  });
}

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renumberAndLayout(), 150);
});

// ================================================================
// ---- PDFモード（「開く」で.pdfを選んだ時。PDF.js／vendor/pdfjs、Apache License 2.0。
//       sidenote-pdfから移植） ----
// 表示（doc-left）を#docから#pdfViewerへ切り替え、既存のPDFファイルへサイドノートを付けられるように
// する。右側（サイドノート欄）・ポップオーバー・色選択・返信スレッド（notesByAnchor）は本文モードと
// 完全に共通のまま使う。異なるのは「本文をどう表示し、どこにノートを固定するか」の部分だけ
// （renumberAndLayoutPdf・buildPrintDocPdfは既に上で定義済み／ここでは表示とノート追加を実装する）。
// ================================================================

function setMode(mode) {
  currentMode = mode;
  const isPdf = mode === "pdf";
  docStackEl.hidden = isPdf;
  pdfViewerEl.hidden = !isPdf;
  docLabelEl.textContent = isPdf ? "PDF" : "本文（テキスト・スクショ）";
  // 本文用の書式ツールバーはPDFページには適用できないため、pdfモードでは隠す
  // （sidenote-pdfには無い、doc版固有の対応）。
  formatToolbarEl.hidden = isPdf;
  // 「公文書仕様」も本文（段落）向けの文字サイズ・フォント上書きなので、pdfモードでは意味を持たず隠す。
  officialModeRow.hidden = isPdf;
  // hotline書き出しも段落（data-indent-level等）が無いpdfモードでは意味を持たず隠す。
  exportHotlineBtn.hidden = isPdf;
  // モード切り替え時に前の状態を持ち越さない（本文モード側のホバーアイコン）。
  paraHoverEl.hidden = true;
  hoveredPara = null;
}

// ---- 「開く」で.pdfを選んだ時の入口 ----
function openPdfFile(file) {
  setStatus("PDFを読み込み中…");
  const reader = new FileReader();
  reader.onload = () => {
    startNewPdfProject(reader.result, file.name).catch((err) => {
      console.error(err);
      setStatus("PDFの読み込みに失敗しました。ファイルが壊れているか、対応していない形式の可能性があります。");
    });
  };
  reader.onerror = () => setStatus("PDFの読み込みに失敗しました。");
  // 画像と同じくdata URLとして丸ごと保持する（.json保存にそのまま埋め込むため）。
  reader.readAsDataURL(file);
}

// PDFを開く＝別の案件を新規に始める扱い（本文モードの「新しい作業」と同じ考え方）。
async function startNewPdfProject(dataUrl, filename) {
  notesByAnchor.clear();
  anchorIdSeq = 1;
  replyIdSeq = 1;
  pdfAnchors = [];
  titleInput.value = filename.replace(/\.pdf$/i, "");
  await renderPdfFromDataUrl(dataUrl, []);
  setStatus(`PDFを開きました：${filename}`);
  autoSaveDebounced();
}

// PDF.js（vendor/pdfjs、Apache License 2.0。THIRD_PARTY_NOTICES.md参照）はESモジュール配布のみだが、
// 動的import()はクラシックスクリプト（app.js自体）からでも使えるため、別途<script type="module">の
// 橋渡しタグは用意せず、初めてPDFが必要になった時にここで読み込む（毎回のページ読み込みで1.7MB超の
// pdf.jsを無条件に取りに行かずに済む＝PDF機能を使わない人には影響が無い）。結果はキャッシュし、
// 2回目以降は再取得しない。
let pdfjsLibPromise = null;
function loadPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("./vendor/pdfjs/pdf.min.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsLibPromise;
}

// data:application/pdf;base64,.... → Uint8Array（pdf.jsのgetDocument({data})に渡す形）。
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 新規に開く時・.json/自動保存から復元する時の両方から呼ぶ共通の描画処理。
// savedAnchorsを渡した場合は、全ページ描画後にそのマークを再構築する（notesByAnchor自体は
// 呼び出し側＝applyProjectDataが既に埋めている前提。ここでは触らない）。
async function renderPdfFromDataUrl(dataUrl, savedAnchors) {
  let pdfjsLib;
  try {
    pdfjsLib = await loadPdfjsLib();
  } catch (err) {
    setStatus("PDF機能の読み込みに失敗しました。通信環境を確認して、もう一度お試しください。");
    throw err;
  }
  currentPdfDataUrl = dataUrl;
  setMode("pdf");   // 先に表示を切り替える（hiddenのままだとページ幅の実測（clientWidth）が0になるため）
  pdfViewerEl.innerHTML = "";

  // cMapUrl：フォントを埋め込んでいないPDF（定義済みCJKエンコーディング参照のみのPDF）でも文字化けしない
  // よう、pdf.js純正のcmap一式（vendor/pdfjs/cmaps、同じくApache License 2.0）を渡す。
  // 埋め込みフォント済みのPDF（Wordの「PDFとして保存」等、大半のケース）では使われない。
  const pdf = await pdfjsLib.getDocument({
    data: dataUrlToUint8Array(dataUrl),
    cMapUrl: "vendor/pdfjs/cmaps/",
    cMapPacked: true,
  }).promise;
  currentPdfDoc = pdf;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    await renderPdfPage(pdf, pageNum);
  }

  if (savedAnchors && savedAnchors.length) rebuildPdfAnchors(savedAnchors);
  renumberAndLayout();
}

// 1ページぶんの canvas（描画）＋テキストレイヤー（選択可能なテキストがあれば）＋
// 注釈レイヤー（マーク常設表示、スキャンページではクリック／ドラッグの受け口も兼ねる）を組み立てる。
// 表示幅は#pdfViewerの実際の幅にフィットさせる（.doc-leftの可変幅にそのまま追従、ウィンドウ幅が
// 変わっても再描画はしない＝本文モードの.para{max-width:37em}と同じく「開いた時の幅で固定」でよしとする）。
async function renderPdfPage(pdf, pageNum) {
  const pdfjsLib = await loadPdfjsLib();   // 既に読み込み済みなのでキャッシュされたPromiseがすぐ解決する
  const page = await pdf.getPage(pageNum);
  const containerWidth = pdfViewerEl.clientWidth || 600;
  const baseViewport = page.getViewport({ scale: 1 });   // ＝ノートの位置を保存する「ページ空間」の基準
  const scale = containerWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const pageEl = document.createElement("div");
  pageEl.className = "pdf-page";
  pageEl.dataset.pageIndex = String(pageNum - 1);   // renumberAndLayoutPdf等の並び替えは0始まりで扱う
  pageEl.dataset.scale = String(scale);
  pageEl.dataset.baseWidth = String(baseViewport.width);    // 印刷書き出し（mm換算）で使う
  pageEl.dataset.baseHeight = String(baseViewport.height);
  pageEl.style.width = `${viewport.width}px`;
  pageEl.style.height = `${viewport.height}px`;
  // PDF.js純正TextLayerの内部実装が要求するカスタムプロパティ（.pdf-text-layerのCSSコメント参照）。
  // このページの実際の表示スケールと必ず一致させる。
  pageEl.style.setProperty("--total-scale-factor", String(scale));
  pageEl.style.setProperty("--scale-round-x", "1px");
  pageEl.style.setProperty("--scale-round-y", "1px");

  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;   // 内部解像度だけ上げて描画をくっきりさせる（CSSサイズは変えない）
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  pageEl.appendChild(canvas);
  await page.render({ canvasContext: ctx, viewport }).promise;

  // テキストが1文字も無ければ「スキャン」扱いにする（OCR済みスキャンは通常テキストを持つため、
  // その場合は自動的にテキストPDFと同じ扱いになる＝自己判定でよく、ユーザーに申告させない）。
  const textContent = await page.getTextContent();
  const hasText = textContent.items.some((it) => it.str && it.str.trim().length > 0);

  const textLayerEl = document.createElement("div");
  textLayerEl.className = "pdf-text-layer";
  pageEl.appendChild(textLayerEl);
  if (hasText) {
    const textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerEl, viewport });
    await textLayer.render();
  } else {
    textLayerEl.classList.add("pdf-text-layer-empty");
  }

  const annotLayerEl = document.createElement("div");
  annotLayerEl.className = "pdf-annot-layer";
  pageEl.appendChild(annotLayerEl);
  if (!hasText) bindScanPageInteraction(pageEl, annotLayerEl);   // テキストが無いページだけクリック／ドラッグを有効化

  pdfViewerEl.appendChild(pageEl);
  return pageEl;
}

// ---- テキストPDF：範囲選択→コメント追加ポップオーバー ----
// 本文モードのhandleSelection（doc.addEventListener("mouseup", ...)）と対になる、pdfViewer版。
pdfViewerEl.addEventListener("mouseup", handlePdfTextSelection);
pdfViewerEl.addEventListener("touchend", handlePdfTextSelection);

function handlePdfTextSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const anchorEl = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const textLayerEl = anchorEl?.closest(".pdf-text-layer");
  if (!textLayerEl) return;   // テキストレイヤーの外での選択（例：ページ間の余白）は無視
  const pageEl = textLayerEl.closest(".pdf-page");
  if (!pageEl) return;
  const quote = range.toString();
  if (!quote.trim()) return;

  // 選択範囲の各行の矩形を、ページ空間（scale=1）座標に変換して保持する
  // （テキストレイヤーのスパン自体はscale込みのpx位置なので、そのpageのscaleで割り戻す）。
  const scale = Number(pageEl.dataset.scale);
  const pageRect = pageEl.getBoundingClientRect();
  const rectsPdf = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      x: (r.left - pageRect.left) / scale,
      y: (r.top - pageRect.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    }));
  if (!rectsPdf.length) return;

  pendingTarget = { type: "pdftext", pageEl, rectsPdf, quote };
  openPopover(range.getBoundingClientRect());
}

// ---- スキャンPDF：クリック（点）／ドラッグ（矩形）→コメント追加ポップオーバー ----
// テキストが無いページ（renderPdfPage参照）だけ、そのページの.pdf-annot-layerへ1度だけバインドする。
function bindScanPageInteraction(pageEl, annotLayerEl) {
  annotLayerEl.classList.add("scan-mode");   // pointer-events:autoにする＋カーソルをcrosshairに（CSS側）
  const DRAG_THRESHOLD_PX = 6;   // これ未満のマウス移動はドラッグではなくクリックとみなす
  let previewEl = null;

  const toPageSpace = (clientX, clientY) => {
    const scale = Number(pageEl.dataset.scale);
    const r = pageEl.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };

  annotLayerEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;   // 左クリックのみ（右クリック等は無視）
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;

    const onMove = (moveEv) => {
      const dx = moveEv.clientX - startX, dy = moveEv.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      if (!previewEl) {
        previewEl = document.createElement("div");
        previewEl.className = "pdf-drag-preview";
        annotLayerEl.appendChild(previewEl);
      }
      const layerRect = annotLayerEl.getBoundingClientRect();
      previewEl.style.left = `${Math.min(startX, moveEv.clientX) - layerRect.left}px`;
      previewEl.style.top = `${Math.min(startY, moveEv.clientY) - layerRect.top}px`;
      previewEl.style.width = `${Math.abs(moveEv.clientX - startX)}px`;
      previewEl.style.height = `${Math.abs(moveEv.clientY - startY)}px`;
    };

    const onUp = (upEv) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (previewEl) { previewEl.remove(); previewEl = null; }

      if (dragging) {
        const p1 = toPageSpace(startX, startY);
        const p2 = toPageSpace(upEv.clientX, upEv.clientY);
        const rect = {
          x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
          w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y),
        };
        if (rect.w < 3 && rect.h < 3) return;   // ほぼ点にしかならない微小ドラッグは無視（誤操作対策）
        pendingTarget = { type: "pdfrect", pageEl, rect };
        openPopover(new DOMRect(upEv.clientX, upEv.clientY, 0, 0));
      } else {
        pendingTarget = { type: "pdfpoint", pageEl, point: toPageSpace(startX, startY) };
        openPopover(new DOMRect(startX, startY, 0, 0));
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

// ---- マーク（テキスト番号バッジ／点ピン／矩形囲み）の登録・描画 ----
// pdfAnchors（正本）への追加と、対応するDOM要素の作成をまとめて行う共通入口。
// 新規追加（addPdfTextNote等）・保存データからの再構築（rebuildPdfAnchors）の両方がここを通る。
function registerPdfMark(anchorData) {
  pdfAnchors.push(anchorData);
  const pageEl = pdfViewerEl.querySelector(`.pdf-page[data-page-index="${anchorData.page}"]`);
  if (pageEl) drawPdfMark(pageEl, anchorData);   // 万一該当ページが無ければ静かに諦める（壊れたデータ対策）
}

function drawPdfMark(pageEl, a) {
  const annotLayerEl = pageEl.querySelector(".pdf-annot-layer");
  const scale = Number(pageEl.dataset.scale);
  const markEl = document.createElement("span");
  markEl.dataset.anchorId = a.anchorId;

  if (a.kind === "text") {
    markEl.className = "pdf-mark pdf-mark-text";
    const first = a.rects[0];
    markEl.style.left = `${first.x * scale}px`;
    markEl.style.top = `${first.y * scale}px`;
  } else if (a.kind === "point") {
    markEl.className = "pdf-mark pdf-mark-point";
    markEl.style.left = `${a.point.x * scale}px`;
    markEl.style.top = `${a.point.y * scale}px`;
  } else {
    markEl.className = "pdf-mark pdf-mark-rect";
    markEl.style.left = `${a.rect.x * scale}px`;
    markEl.style.top = `${a.rect.y * scale}px`;
    markEl.style.width = `${a.rect.w * scale}px`;
    markEl.style.height = `${a.rect.h * scale}px`;
    const num = document.createElement("span");
    num.className = "pdf-mark-rect-num";
    markEl.appendChild(num);
  }
  annotLayerEl.appendChild(markEl);
  return markEl;
}

// .json（または自動保存）から復元する時、全ページ描画後にまとめて呼ぶ（notesByAnchor自体は
// applyProjectData側が既に埋めているので、ここではpdfAnchors＋DOM上のマークだけ作る）。
function rebuildPdfAnchors(savedAnchors) {
  pdfAnchors = [];
  savedAnchors.forEach(registerPdfMark);
}

// ---- ノート追加（ポップオーバーの「追加」から呼ばれる。notePopoverAdd.onclick参照） ----
// 本文モードのaddTextNote/addImageNoteと対になる3種類（テキスト／点／矩形）。
// execCommandを経由しない直接のDOM操作なので、本文モードと違いinputイベント頼みのautoSaveは
// 起きない→ここで明示的に呼ぶ（画像挿入（buildAndInsertImageBlock）と同じ理由・同じパターン）。
function addPdfTextNote(pageEl, rectsPdf, quote, text, color) {
  const anchorId = "a" + anchorIdSeq++;
  registerPdfMark({ anchorId, page: Number(pageEl.dataset.pageIndex), kind: "text", quote, rects: rectsPdf });
  addNoteToAnchor(anchorId, text, color);
  autoSaveDebounced();
}
function addPdfPointNote(pageEl, point, text, color) {
  const anchorId = "a" + anchorIdSeq++;
  registerPdfMark({ anchorId, page: Number(pageEl.dataset.pageIndex), kind: "point", point });
  addNoteToAnchor(anchorId, text, color);
  autoSaveDebounced();
}
function addPdfRectNote(pageEl, rect, text, color) {
  const anchorId = "a" + anchorIdSeq++;
  registerPdfMark({ anchorId, page: Number(pageEl.dataset.pageIndex), kind: "rect", rect });
  addNoteToAnchor(anchorId, text, color);
  autoSaveDebounced();
}

// ---- PDFモードの印刷版面（PDF化） ----
// 本文モードはTufte CSS（float）方式だが、PDFページは1ページの中に複数の注釈がバラバラの高さで
// 乗るため、そのページ画像に対する絶対座標でサイドノートを置く（画面表示と同じ考え方）。
// ページ画像は既に画面用に描画済みのcanvasをそのまま書き出す（再描画しない）。
function buildPrintDocPdf() {
  printDocEl.innerHTML = "";

  const title = projectTitle();
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "print-title";
    titleEl.textContent = title;
    printDocEl.appendChild(titleEl);
  }

  const PRINT_WIDTH_MM = 115;   // 本文モードの.print-para/.print-imgと同じ幅に揃える
  Array.from(pdfViewerEl.querySelectorAll(".pdf-page")).forEach((pageEl) => {
    const canvas = pageEl.querySelector("canvas");
    const baseWidth = Number(pageEl.dataset.baseWidth);   // ページ空間（scale=1）での幅＝ノート座標の基準
    const mmPerUnit = PRINT_WIDTH_MM / baseWidth;

    const wrap = document.createElement("div");
    wrap.className = "print-pdf-page";
    const img = document.createElement("img");
    img.className = "print-pdf-page-img";
    img.src = canvas.toDataURL("image/jpeg", 0.92);   // 枚数が多い証拠PDFでも書き出しが重くなり過ぎないようJPEGにする
    wrap.appendChild(img);

    const pageIndex = Number(pageEl.dataset.pageIndex);
    pdfAnchors.filter((a) => a.page === pageIndex).forEach((a) => {
      const markEl = pageEl.querySelector(`.pdf-mark[data-anchor-id="${a.anchorId}"]`);
      const num = markEl
        ? (a.kind === "rect" ? markEl.querySelector(".pdf-mark-rect-num")?.textContent : markEl.textContent)
        : null;
      if (!num) return;   // renumberAndLayoutPdfが未実行等、通し番号が振られていなければ出しようが無い

      const originPoint = a.kind === "text" ? a.rects[0] : a.kind === "point" ? a.point : a.rect;
      if (a.kind === "text") {
        const badge = document.createElement("span");
        badge.className = "print-pdf-mark-text";
        badge.textContent = num;
        badge.style.left = `${(originPoint.x * mmPerUnit).toFixed(2)}mm`;
        badge.style.top = `${(originPoint.y * mmPerUnit).toFixed(2)}mm`;
        wrap.appendChild(badge);
      } else if (a.kind === "point") {
        const pin = document.createElement("span");
        pin.className = "print-pdf-mark-point";
        pin.textContent = num;
        pin.style.left = `${(originPoint.x * mmPerUnit).toFixed(2)}mm`;
        pin.style.top = `${(originPoint.y * mmPerUnit).toFixed(2)}mm`;
        wrap.appendChild(pin);
      } else {
        const box = document.createElement("span");
        box.className = "print-pdf-mark-rect";
        box.style.left = `${(a.rect.x * mmPerUnit).toFixed(2)}mm`;
        box.style.top = `${(a.rect.y * mmPerUnit).toFixed(2)}mm`;
        box.style.width = `${(a.rect.w * mmPerUnit).toFixed(2)}mm`;
        box.style.height = `${(a.rect.h * mmPerUnit).toFixed(2)}mm`;
        const numSpan = document.createElement("span");
        numSpan.textContent = num;
        box.appendChild(numSpan);
        wrap.appendChild(box);
      }

      const notes = notesByAnchor.get(a.anchorId) || [];
      if (notes.length) {
        const aside = buildPrintAsideEl(num, notes);
        aside.style.top = `${(originPoint.y * mmPerUnit).toFixed(2)}mm`;
        wrap.appendChild(aside);
      }
    });

    printDocEl.appendChild(wrap);
  });

  void printDocEl.offsetHeight;   // buildPrintDoc()と同じ強制リフロー（float混在時の描画抜け対策の踏襲）
}
