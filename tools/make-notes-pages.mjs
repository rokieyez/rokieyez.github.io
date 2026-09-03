/* 발행한 글을 정적 쪽으로 굽고, 집 지도를 다시 그린다
 *   → notes/<슬러그>.html, sitemap.xml
 *
 * 왜 필요한가:
 *   글은 Supabase 의 notes 표에 살고, 화면은 자바스크립트로 그린다.
 *   그런데 링크 미리보기를 만드는 쪽(카카오톡·슬랙)과 검색엔진은
 *   자바스크립트를 돌리지 않는다 — 글을 아무리 발행해도 그들 눈에는
 *   빈 쪽 하나뿐이다. 서재가 책마다 나눔 쪽을 두는 것과 같은 까닭이다.
 *
 * 무엇을 만드나:
 *   글 한 편이 통째로 든 쪽. 제목·날짜·본문이 진짜 글자로 있고,
 *   og 태그와 ld+json(BlogPosting)이 붙는다.
 *
 * 초고는 굽지 않는다:
 *   공개 열쇠로 부르므로 RLS 가 발행한 글만 내준다 — 여기서 거를 것이
 *   없다. 내린 글의 쪽은 다음 실행 때 지워진다.
 *
 * 지도도 여기서 짓는 까닭:
 *   집 지도에 들어갈 쪽 중 손으로 못 세는 것은 글뿐이다. 글을 굽는 자리에서
 *   같이 그리면 지도가 뒤처질 일이 없다 — 서재가 나눔 쪽과 지도를 한 도구로
 *   짓는 것과 같다. 방(/, /now/)은 손으로 여는 것이니 아래 목록에 적어 둔다.
 *
 * 쓰는 법:  node tools/make-notes-pages.mjs
 */
import { writeFile, readFile, readdir, rm, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* 알림 글이 끊겨도 하던 일은 끝낸다 (`| head` 로 잘려도 파일은 온전하게) */
process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 자리 = join(뿌리, "notes");
const 집 = "https://www.rokiz.net";
const 집서버 = "https://gaeumegwhxxnfvrhbknp.supabase.co/rest/v1";
const 서버 = 집서버 + "/notes";
const 열쇠 = "sb_publishable_NI4gjQ3YePIO90H7YjHjfA_m_H0udRy";

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const 날짜 = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/* 읽는 데 걸리는 시간 — 한국어는 분당 500자 어림. 아주 짧은 글에 「1분」이
   붙으면 오히려 우스우니 300자 아래는 적지 않는다 (0 을 돌려준다).
   목록(notes/index.html 의 그리기)과 **같은 규칙이어야** 목록에서 본 숫자와
   글쪽에서 본 숫자가 다르지 않다. */
const 분 = (글) => {
  const 자 = String(글 || "").replace(/\s/g, "").length;
  return 자 >= 300 ? Math.max(1, Math.round(자 / 500)) : 0;
};

/* 본문은 평문이다 — 빈 줄이 문단의 경계, 한 줄 바꿈은 그대로 살린다.
   화면(notes/index.html)의 문단() 과 같은 규칙이어야 두 곳이 다르게
   보이지 않는다. 글자는 반드시 이스케이프해서 넣는다. */
const 문단 = (글) => String(글 || "")
  .split(/\n{2,}/)
  .map((덩) => 덩.trim())
  .filter(Boolean)
  .map((덩) => `<p>${덩.split("\n").map(esc).join("<br>")}</p>`)
  .join("\n    ");

/* 서재의 나눔 쪽 이름. post-libros/tools/make-book-pages.mjs 의 슬러그몸() ·
   js/app.js 의 shareSlug() 와 글자 그대로 같은 규칙이어야 한다 — 어긋나면
   없는 파일을 가리킨다. (서재의 404 가 뒤의 여덟 자를 주워 살려 주긴 한다) */
function 책슬러그(b) {
  const 몸 = String(b.title || "무제")
    .replace(/[\u2018\u2019\u201C\u201D\u300C\u300D\u300E\u300F]/g, "")
    .replace(/[^0-9A-Za-z\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "") || "무제";
  return `${몸}-${b.id.slice(0, 8)}`;
}

const 쪽만들기 = (n, 앞, 뒤, 책) => {
  const 주소 = `${집}/notes/${encodeURIComponent(n.slug)}.html`;
  const 요약 = String(n.body || "").replace(/\s+/g, " ").trim().slice(0, 155) || n.title;
  /* 글마다 다른 얼굴 — tools/make-notes-cards.mjs 가 구운 카드가 있으면
     그것을 건다. 없으면 집의 og.png 로 돌아간다: 카드를 아직 안 구웠다고
     미리보기가 아예 없는 것보다는 낫다. */
  const 얼굴 = 카드있음.has(n.slug)
    ? `${집}/notes/card/${encodeURIComponent(n.slug)}.png`
    : `${집}/og.png`;
  const 표식 = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: n.title,
    url: 주소,
    inLanguage: "ko",
    datePublished: n.published_at,
    ...(n.updated_at && n.updated_at !== n.published_at ? { dateModified: n.updated_at } : {}),
    author: { "@type": "Person", name: "로키즈" },
    publisher: { "@type": "Organization", name: "로키즈의 방", url: `${집}/` },
    image: 얼굴,
    ...(요약 ? { description: 요약 } : {}),
    ...((n.tags || []).length ? { keywords: n.tags.join(", ") } : {}),
  };
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(n.title)} — 로키즈의 방</title>
<meta name="description" content="${esc(요약)}">
<meta name="theme-color" content="#171009">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${주소}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/atom+xml" title="로키즈의 방" href="/feed.xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="rokiz.net">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(n.title)}">
<meta property="og:description" content="${esc(요약)}">
<meta property="og:url" content="${주소}">
<meta property="og:image" content="${얼굴}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="${esc(n.published_at)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(n.title)}">
<meta name="twitter:description" content="${esc(요약)}">
<meta name="twitter:image" content="${얼굴}">
<script type="application/ld+json">${JSON.stringify(표식).replace(/</g, "\\u003c")}</script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Cormorant:ital,wght@1,500&display=swap">
<style>
  :root { --dark:#171009; --paper:#E9DFC9; --dim:#9C8E74; --brass:#E0B15E; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    background: var(--dark); color: var(--paper);
    font-family: "Gowun Batang", "Noto Serif KR", serif; line-height: 1.9;
    display: grid; grid-template-rows: 1fr auto; place-items: start center;
    word-break: keep-all; overflow-wrap: break-word;
  }
  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none;
    background: radial-gradient(48% 34% at 50% 10%, rgba(224,177,94,.08), transparent 70%);
  }
  /* 글은 읽으라고 있는 것이다 — 한 줄이 62자를 넘지 않게 */
  article { position: relative; padding: 56px 24px 32px; max-width: 62ch; width: 100%; }
  .latin { font-family: "Cormorant", serif; font-style: italic;
           font-size: 13px; letter-spacing: .22em; color: var(--dim); margin: 0 0 8px; }
  h1 { margin: 0 0 6px; font-size: clamp(26px, 5.5vw, 36px); font-weight: 700;
       letter-spacing: .04em; line-height: 1.45; }
  time { display: block; margin-bottom: 40px; font-size: 12px;
         color: var(--dim); opacity: .85; letter-spacing: .06em; }
  /* 읽는 데 걸리는 시간 — 날짜 옆에 조용히. <time> 이 이미 .85 를 쓰고 있으니
     여기서 또 흐리게 하지 않는다 (곱해져서 안 읽힌다) */
  time .mins { margin-left: 7px; }
  p { margin: 0 0 18px; font-size: 15.5px; }
  /* 결 — 날짜 밑에 조용히. 누르면 글방에서 그 결만 걸러 본다 */
  .tags { margin: -32px 0 40px; font-size: 11.5px; letter-spacing: .06em; }
  .tags a { color: var(--dim); border-bottom-color: rgba(156,142,116,.28); }
  .tags a::before { content: "#"; opacity: .55; }
  .tags a:hover, .tags a:focus-visible { color: var(--brass); border-bottom-color: var(--brass); }
  /* 이웃한 글 — 다 읽고 나면 갈 곳이 목록뿐이었다.
     글이 하나뿐이면 두 자리 다 비고, 그때는 아무것도 그려지지 않는다. */
  .near {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    margin: 46px 0 0; padding-top: 22px; border-top: 1px solid rgba(224,177,94,.14);
  }
  .near a { display: block; font-size: 14px; line-height: 1.6; border: 0; }
  .near a:hover, .near a:focus-visible { color: #F0CE8C; outline: none; }
  .near i {
    display: block; font-style: normal; margin-bottom: 3px;
    font-size: 11px; letter-spacing: .1em; color: var(--dim); opacity: .85;
  }
  .near .next { text-align: right; }
  @media (max-width: 460px) { .near { grid-template-columns: 1fr; } .near .next { text-align: left; } }
  /* 이 글이 말하는 책 — 글방과 서재를 잇는 한 칸 */
  .bookcard {
    display: flex; gap: 15px; align-items: flex-start;
    margin: 40px 0 0; padding: 16px 17px;
    border: 1px solid rgba(224,177,94,.18); border-radius: 3px;
    background: rgba(224,177,94,.03);
  }
  .bookcard img { width: 58px; border-radius: 2px; flex: none; }
  .bookcard .t { font-size: 15px; line-height: 1.65; }
  .bookcard .t a { border-bottom-color: rgba(224,177,94,.3); }
  .bookcard .t i { display: block; font-style: normal; font-size: 12.5px; color: var(--dim); opacity: .85; }
  .bookcard .lbl {
    display: block; margin-bottom: 3px;
    font-size: 10.5px; letter-spacing: .12em; color: var(--dim); opacity: .85;
  }
  .back { display: inline-block; margin-top: 30px; font-size: 13px; }
  a { color: var(--brass); text-decoration: none;
      border-bottom: 1px solid rgba(224,177,94,.32); padding-bottom: 1px; }
  a:hover, a:focus-visible { border-bottom-color: var(--brass); outline: none; }
  footer { padding: 0 24px 28px; font-size: 11.5px; color: var(--dim);
           opacity: .85; letter-spacing: .1em; text-align: center; }
  footer a { border-bottom-color: rgba(156,142,116,.3); color: inherit; }
  /* 손가락이 닿는 자리를 넓힌다 — 보이는 크기는 그대로 두고 ::after 로만
     (WCAG 2.2 의 최소는 24×24, 바닥글 글자는 그보다 작다) */
  footer a { position: relative; }
  footer a::after { content: ""; position: absolute; left: -7px; right: -7px; top: -9px; bottom: -9px; }
  /* ── 키보드로 걷는 사람 (2026-09-03) ────────────────────────────
     이 집은 곳곳에서 outline 을 끄고 제 방식으로 대답한다 — 문은 살짝
     들리고, 테가 밝아지고, 글자 색이 바뀐다. 그 대답은 그대로 두되,
     **어디서든 반드시 보이는 고리**를 하나 깐다. outline:none 을
     하나씩 걷는 대신 한 줄로 덮는 까닭은, 새 단추를 만들 때마다
     또 꺼질 자리이기 때문이다. !important 는 여기서 옳다.
     마우스로 누른 사람에게는 뜨지 않는다 (:focus 가 아니라 :focus-visible). */
  :focus-visible {
    outline: 2px solid var(--brass) !important;
    outline-offset: 2px;
  }
</style>
</head>
<body>
<article>
  <p class="latin">SCRIPTA</p>
  <h1>${esc(n.title)}</h1>
  <time datetime="${esc(String(n.published_at).slice(0, 10))}">${날짜(n.published_at)}${
    분(n.body) ? `<span class="mins">· ${분(n.body)}분</span>` : ""}</time>
  ${(n.tags || []).length ? `<p class="tags">${(n.tags || [])
      .map((t) => `<a href="./#결/${encodeURIComponent(t)}">${esc(t)}</a>`).join(" ")}</p>` : ""}
  ${문단(n.body)}
${책 ? `<aside class="bookcard">
    ${책.cover_url && !/\/noimg/i.test(책.cover_url)
      ? `<img src="${esc(책.cover_url)}" alt="" loading="lazy" decoding="async">` : ""}
    <span class="t"><span class="lbl">이 글이 말하는 책</span>
      <a href="/books/b/${encodeURIComponent(책슬러그(책))}.html">${esc(책.title)}</a>
      <i>${esc([책.author || "지은이 미상", 책.publisher, 책.published_year].filter(Boolean).join(" · "))}</i></span>
  </aside>` : ""}
  ${앞 || 뒤 ? `<nav class="near">
    ${뒤 ? `<a class="prev" href="${encodeURIComponent(뒤.slug)}.html"><i>이전 글</i>${esc(뒤.title)}</a>` : "<span></span>"}
    ${앞 ? `<a class="next" href="${encodeURIComponent(앞.slug)}.html"><i>다음 글</i>${esc(앞.title)}</a>` : "<span></span>"}
  </nav>` : ""}
  <p><a class="back" href="./">글 목록</a></p>
</article>
<footer>rokiz.net · <a href="/">대문</a> · <a href="/books/">서재</a> · <a href="/now/">지금</a></footer>
</body>
</html>
`;
};

/* ── 지음 ─────────────────────────────────────────────────────────── */
const r = await fetch(
  `${서버}?select=slug,title,body,published_at,updated_at,book_id,tags&order=published_at.desc`,
  { headers: { apikey: 열쇠, Authorization: `Bearer ${열쇠}` } });
if (!r.ok) throw new Error(`글방을 읽지 못했습니다 (${r.status}) ${await r.text()}`);
const 글들 = (await r.json()).filter((n) => n.published_at);

/* 글이 말하는 책 — 서재에서 한 번에 받아 온다. 글마다 따로 묻지 않는다
   (544권짜리 표를 글 수만큼 두드릴 까닭이 없다). */
const 책id = [...new Set(글들.map((n) => n.book_id).filter(Boolean))];
const 책들 = new Map();
if (책id.length) {
  const r2 = await fetch(
    `${집서버}/books?select=id,title,author,publisher,published_year,cover_url` +
    `&id=in.(${책id.join(",")})`,
    { headers: { apikey: 열쇠, Authorization: `Bearer ${열쇠}` } }).catch(() => null);
  if (r2?.ok) for (const b of await r2.json()) 책들.set(b.id, b);
  else console.warn("  서재에 책을 묻지 못했습니다 — 책 없이 글쪽을 짓습니다");
}

await mkdir(자리, { recursive: true });

/* 구워 둔 카드 목록 — 글쪽의 og:image 를 무엇으로 걸지 여기서 정한다 */
const 카드있음 = new Set(
  (await readdir(join(자리, "card")).catch(() => []))
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.slice(0, -4)));

/* 내린 글의 쪽은 남겨 두지 않는다 — 없는 글이 검색에 남는 것이
   빈 링크보다 나쁘다. index.html 은 목록이므로 건드리지 않는다. */
const 살아있음 = new Set(글들.map((n) => `${n.slug}.html`));
살아있음.add("index.html");
for (const f of await readdir(자리).catch(() => [])) {
  if (f.endsWith(".html") && !살아있음.has(f)) {
    await rm(join(자리, f));
    console.log(`  내린 글의 쪽을 지웠습니다: ${f}`);
  }
}

/* 글들은 새것부터 온다 — 바로 앞자리가 더 새 글(다음 글),
   바로 뒷자리가 더 옛 글(이전 글)이다 */
for (let i = 0; i < 글들.length; i++) {
  await writeFile(join(자리, `${글들[i].slug}.html`),
                  쪽만들기(글들[i], 글들[i - 1], 글들[i + 1],
                          글들[i].book_id ? 책들.get(글들[i].book_id) : null), "utf8");
}
console.log(`${글들.length}편의 글을 쪽으로 구웠습니다 → notes/`);
글들.forEach((n) => console.log(`  ${n.slug}.html — ${n.title}`));

/* ── 목록의 씨앗 (notes/index.html) ────────────────────────────────
   글방은 서재(Supabase)에 물어 목록을 그린다. 그래서 서재가 답하지 않거나
   자바스크립트가 꺼져 있으면 방이 통째로 빈다 — 발행한 글이 바로 옆에
   <슬러그>.html 로 놓여 있는데도. 「못 읽은 것은 목록이지 글이 아니다.」
   화면의 그리기() 가 만드는 <li> 와 같은 꼴로 구워 둔다. 두 곳이 다르면
   서재가 답하는 순간 목록이 눈에 띄게 덜컹인다.
   **초고는 굽지 않는다** — 글들은 이미 published_at 이 있는 것만 남았다. */
{
  const 씨앗 = 글들.map((n) => {
    const 맛 = String(n.body || "").replace(/\s+/g, " ").trim();
    const 자 = String(n.body || "").replace(/\s/g, "").length;
    const 결 = (n.tags || []).map((t) => `<b>${esc(t)}</b>`).join("");
    return `      <li><a href="${encodeURIComponent(n.slug)}.html">${esc(n.title)}</a>`
      + `<time datetime="${esc(String(n.published_at).slice(0, 10))}">${날짜(n.published_at)}`
      + (자 >= 300 ? `<span class="mins">· ${Math.max(1, Math.round(자 / 500))}분</span>` : "")
      + (결 ? `<span class="tags">${결}</span>` : "")
      + `</time>`
      + (맛 ? `<p class="peek">${esc(맛.slice(0, 140))}</p>` : "")
      + `</li>`;
  }).join("\n");

  const 방쪽 = join(자리, "index.html");
  const 옛 = await readFile(방쪽, "utf8");
  const 틀 = /(<!--구운목록-->)[\s\S]*?(<!--\/구운목록-->)/;
  if (!틀.test(옛)) {
    console.warn("  notes/index.html 에서 구운목록 자리를 찾지 못했습니다 — 씨앗을 건너뜁니다");
  } else {
    const 새 = 옛.replace(틀, `$1\n${씨앗}\n    $2`);
    if (새 !== 옛) {
      await writeFile(방쪽, 새, "utf8");
      console.log(`  목록의 씨앗 ${글들.length}줄을 구웠습니다 → notes/index.html`);
    } else {
      console.log("  목록의 씨앗은 이미 최신입니다");
    }
  }
}

/* ── 집 지도 ──────────────────────────────────────────────────────
   /books/ 아래 544권은 그쪽 저장소가 스스로 지도를 지으므로 여기 적지 않는다.
   robots.txt 가 두 지도를 나란히 가리킨다. 방을 새로 열면 아래 한 줄. */
/* lastmod 는 「이 쪽이 마지막으로 바뀐 날」이다. 도구를 돌린 날을 적으면
   글 한 편을 올릴 때마다 대문과 지금까지 「바뀌었다」고 말하게 된다 —
   거짓 신호가 되풀이되면 검색엔진은 이 값 자체를 무시한다.
   git 이 그 파일의 마지막 손길을 정확히 알고 있으니 그것을 쓴다.
   git 이 없거나 아직 안 담긴 파일이면 오늘로 돌아간다. */
const 오늘 = new Date().toISOString().slice(0, 10);
const 바뀐날 = (파일) => {
  try {
    const d = execFileSync("git", ["log", "-1", "--format=%cs", "--", 파일],
                           { cwd: 뿌리, encoding: "utf8" }).trim();
    return d || 오늘;
  } catch { return 오늘; }
};
const 방 = [
  { 곳: `${집}/`,       때: 바뀐날("index.html"),       잦기: "monthly", 무게: "1.0" },
  { 곳: `${집}/now/`,   때: 바뀐날("now/index.html"),   잦기: "weekly",  무게: "0.8" },
  /* 글방은 목록이라 새 글이 놓이면 실제로 달라진다 — 파일보다 글이 정확하다 */
  { 곳: `${집}/notes/`, 때: 글들[0] ? String(글들[0].published_at).slice(0, 10)
                                    : 바뀐날("notes/index.html"),
    잦기: "weekly", 무게: "0.8" },
];
/* 지난 갈무리(now/<연도>-<달>.html)도 한 쪽씩 걸어 둔다 */
for (const f of (await readdir(join(뿌리, "now")).catch(() => [])).sort().reverse()) {
  if (!/^\d{4}-\d{2}\.html$/.test(f)) continue;
  방.push({ 곳: `${집}/now/${f}`, 때: 바뀐날(`now/${f}`),
            잦기: "yearly", 무게: "0.4" });
}
const 글쪽 = 글들.map((n) => ({
  곳: `${집}/notes/${encodeURIComponent(n.slug)}.html`,
  때: String(n.updated_at || n.published_at).slice(0, 10),   // 글은 DB 가 안다
  잦기: "yearly", 무게: "0.7",
}));
const 지도 = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 손으로 고치지 마세요 — tools/make-notes-pages.mjs 가 짓습니다.
     방을 새로 열면 그 도구의 「방」 목록에 한 줄 더합니다. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...방, ...글쪽].map((u) => `  <url>
    <loc>${u.곳}</loc>
    <lastmod>${u.때}</lastmod>
    <changefreq>${u.잦기}</changefreq>
    <priority>${u.무게}</priority>
  </url>`).join("\n")}
</urlset>
`;
await writeFile(join(뿌리, "sitemap.xml"), 지도, "utf8");
console.log(`집 지도에 ${방.length + 글쪽.length}곳을 담았습니다 → sitemap.xml`);
