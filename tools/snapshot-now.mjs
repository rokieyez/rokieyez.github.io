/* 「지금」을 갈무리한다 — now/<연도>-<달>.html
 *
 * 왜 도구인가:
 *   /now/ 는 덮어쓰는 쪽이라 고칠 때마다 과거가 사라진다. 그래서 크게
 *   바뀔 때마다 복사해 두기로 했는데, 손으로 하려면 ①복사하고 ②서재에
 *   묻는 <script> 를 지우고 ③그때 화면에 있던 값을 글자로 박고 ④제목과
 *   canonical 을 고치고 ⑤noindex 를 걸고 ⑥「지난 지금」 목록에 한 줄
 *   더해야 한다. 여섯 걸음이면 번거롭고, 번거로우면 안 하게 된다.
 *
 * 무엇이 중요한가:
 *   **갈무리는 그때의 사진이어야 한다.** 서재에 묻는 코드를 남겨 두면
 *   갈무리가 오늘 값을 따라가 버려 아무것도 남지 않는다. 그래서 이 도구는
 *   지금 서재에 물어 답을 받아 **글자로 박고** 묻는 코드를 걷어 낸다.
 *
 * 쓰는 법:
 *   node tools/snapshot-now.mjs                이번 달로
 *   node tools/snapshot-now.mjs 2026-09        달을 정해서
 *   node tools/snapshot-now.mjs --force        이미 있어도 덮어쓴다
 *
 * 갈무리한 뒤 /now/ 를 새로 고쳐 쓰면 된다 — 과거는 이미 남았다.
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { 이달 } from "./오늘.mjs";
import { 열쇠, 밑동, esc } from "./집.mjs";

process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 집 = "https://www.rokiz.net";
const 서재 = `${밑동}/books`;
const 덮기 = process.argv.includes("--force");
/* 달은 **도구를 돌리는 사람의 달력**을 따른다. toISOString 은 UTC 라, 매달
   1일 한국 시간 새벽에 갈무리하면 지난달 파일로 저장되어 이미 있는 갈무리를
   덮어쓸 뻔한다 (--force 없이는 멈추지만, 멈추는 것도 곤란하기는 같다). */
const 달 = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a)) || 이달();


/* 알라딘은 표지가 없을 때 「No Image」 그림 주소를 준다 — 표지가 없는 것으로 친다 */
const 표지of = (u) => (u && !/\/noimg/i.test(u) ? u : null);

async function 물어(질의) {
  const r = await fetch(서재 +질의,
    { headers: { apikey: 열쇠, Authorization: `Bearer ${열쇠}` } });
  if (!r.ok) throw new Error(`서재에 묻지 못했습니다 (${r.status})`);
  return r.json();
}

/* ── 그때의 값을 받아 온다 ─────────────────────────────────────── */
const 읽는중 = await 물어(
  "?select=id,title,author,bookmark_page,page_count,cover_url&read_status=eq." +
  encodeURIComponent("읽는 중") + "&order=bookmark_at.desc.nullslast&limit=5");

/* 최근에 꽂은 책은 서재의 피드를 그대로 읽는다 — 「새로 들어온 것」을 정하는
   규칙을 이쪽에 베껴 두지 않으려는 것이다 (/now/ 화면과 같은 뜻). */
let 꽂은책 = [];
try {
  const xml = await (await fetch(`${집}/books/feed.xml`)).text();
  꽂은책 = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((m) => m[1])
    .filter((덩) => /<category term="입고"/.test(덩))
    .slice(0, 5)
    .map((덩) => ({
      /* 피드의 제목은 「미포시오 입고」 꼴이다 — 갈래는 이미 걸러 냈으니
         꼬리말은 뗀다. /now/ 화면의 스크립트와 같은 규칙이어야
         갈무리가 그 쪽과 다르게 보이지 않는다. */
      제목: ((/<title>([\s\S]*?)<\/title>/.exec(덩) || [])[1]?.trim() || "")
              .replace(/\s*입고$/, ""),
      /* 같은 집 안의 주소는 상대로 — 도메인이 바뀌어도 링크가 살아 있다.
         그리고 **책 주소는 아이디 꼴로 굳힌다**: 피드가 주는 것은
         「제목-앞자리여덟」인데, 나중에 주인이 제목을 고치면(「미포시오」가
         「지도와 영토」가 되었다, 2026-09-03) 그 슬러그 쪽은 사라진다.
         갈무리는 되돌아보는 쪽이라 한번 죽은 링크는 영영 죽는다.
         아이디 쪽(b/<uuid>.html)은 이름이 바뀌어도 그대로 있다. */
      주소: (() => {
        const 날것 = ((/<link[^>]+href="([^"]+)"/.exec(덩) || [])[1] || `${집}/books/`)
                       .replace(집, "");
        const id = (/tag:[^<]*?shelved\/([0-9a-f-]{36})/.exec(덩) || [])[1];
        return id ? `/books/b/${id}.html` : 날것;
      })(),
      곁: (/<summary>([\s\S]*?)<\/summary>/.exec(덩) || [])[1]?.trim() || "",
    }))
    .filter((x) => x.제목);
} catch {
  console.warn("  서재 피드를 읽지 못했습니다 — 「최근에 꽂은 책」 없이 갈무리합니다");
}

/* ── 지금 쪽을 갈무리로 옮긴다 ────────────────────────────────── */
const 낼것 = join(뿌리, "now", `${달}.html`);
if (!덮기) {
  try {
    await access(낼것);
    console.error(`이미 있습니다: now/${달}.html — 덮어쓰려면 --force`);
    process.exit(1);
  } catch { /* 없으니 짓는다 */ }
}

let s = await readFile(join(뿌리, "now", "index.html"), "utf8");

/* ① 서재에 묻는 코드를 통째로 걷는다. 남겨 두면 갈무리가 오늘 값을
      따라가 버려 아무것도 남지 않는다 — 갈무리의 뜻이 사라진다. */
const 바닥 = s.indexOf("<footer>");
const 열림 = s.indexOf("<script>", 바닥);
if (열림 > 0) {
  const 닫힘 = s.indexOf("</script>", 열림) + "</script>".length;
  s = s.slice(0, 열림) + s.slice(닫힘);
}
/* 아무것도 묻지 않으니 미리 이어 둘 곳도 없다 */
s = s.replace(/^\s*<link rel="preconnect" href="https:\/\/gaeumegwhxxnfvrhbknp[^>]*>\n/m, "");

/* ② 그때 화면에 있던 값을 글자로 박는다 */
const [해, 월] = 달.split("-");
const 달이름 = `${해}년 ${Number(월)}월`;

s = s.replace(/<p class="when"[^>]*>[\s\S]*?<\/p>/,
  `<p class="when">${달이름}의 갈무리입니다 — 아래 값은 그때 화면에 있던 그대로입니다</p>`);

const 읽는중줄 = 읽는중.length
  ? 읽는중.map((b) => {
      const 표지 = 표지of(b.cover_url);
      const 쪽 = (b.bookmark_page && b.page_count)
        ? ` — ${b.page_count}쪽 중 ${b.bookmark_page}쪽` : "";
      const 몫 = (b.bookmark_page && b.page_count)
        ? Math.max(1, Math.round(b.bookmark_page / b.page_count * 100)) : null;
      return `      <li${표지 ? ' class="withcover"' : ""}>
${표지 ? `        <img src="${esc(표지)}" alt="" loading="lazy" decoding="async">\n` : ""}        <span class="t"><b><a href="/books/#book/${b.id}">${esc(b.title)}</a></b>
          <i> ${esc(b.author || "지은이 미상")}${쪽}</i>${
        몫 ? `\n          <span class="prog"><i style="width:${몫}%"></i></span>` : ""}</span>
      </li>`;
    }).join("\n")
  : '      <li class="empty">그때는 펼쳐 둔 책이 없었습니다.</li>';
s = s.replace(/ {4}<ul id="reading">[\s\S]*?<\/ul>/,
  `    <ul>\n${읽는중줄}\n    </ul>`);

const 꽂은줄 = 꽂은책.length
  ? 꽂은책.map((b) =>
      `      <li><b><a href="${esc(b.주소)}">${esc(b.제목)}</a></b><i> ${esc(b.곁)}</i></li>`).join("\n")
  : '      <li class="empty">그때는 새로 꽂은 책이 없었습니다.</li>';
s = s.replace(/ {4}<ul id="shelved">[\s\S]*?<\/ul>/,
  `    <ul>\n${꽂은줄}\n    </ul>`);

/* ③ 갈무리 안에서 「지난 지금」을 되풀이하지 않는다 */
s = s.replace(/ {2}<section id="past"[\s\S]*?<\/section>\n/, "");

/* ④ 갈무리는 색인하지 않는다 — 지금 쪽과 내용이 겹친다 */
const 주소 = `${집}/now/${달}.html`;
s = s.replace(/<link rel="canonical"[^>]*>/,
  `<meta name="robots" content="noindex">\n  <link rel="canonical" href="${주소}">`);
s = s.replace(/<title>[^<]*<\/title>/, `<title>${달이름}의 지금 — 로키즈의 방</title>`);
s = s.replace(/<h1>[^<]*<\/h1>/, `<h1>${달이름}의 지금</h1>`);
s = s.replace(/"url":"[^"]*\/now\/"/, `"url":"${주소}"`);
s = s.replace(/"name":"지금 — 로키즈의 방"/, `"name":"${달이름}의 지금 — 로키즈의 방"`);
s = s.replace(/<meta property="og:url" content="[^"]*">/,
  `<meta property="og:url" content="${주소}">`);

/* ⑤ 지금 쪽으로 돌아가는 길 */
s = s.replace(/<footer>rokiz\.net · /, '<footer><a href="/now/">지금</a> · ');

await writeFile(낼것, s, "utf8");
console.log(`${달이름}의 지금을 갈무리했습니다 → now/${달}.html`);
console.log(`  읽는 중 ${읽는중.length}권 · 최근에 꽂은 책 ${꽂은책.length}권`);

/* ── 「지난 지금」 목록에 한 줄 ────────────────────────────────── */
const 지금쪽 = join(뿌리, "now", "index.html");
let n = await readFile(지금쪽, "utf8");
if (n.includes(`/now/${달}.html`)) {
  console.log("  「지난 지금」에 이미 걸려 있습니다");
} else {
  const 한줄 = `      <li><a href="/now/${달}.html">${달이름}</a></li>`;
  if (/<section id="past"[^>]*>/.test(n)) {
    n = n.replace(/<section id="past"[^>]*>/, '<section id="past">')   // hidden 을 걷는다
         .replace(/(<section id="past">[\s\S]*?<ul>\n)/, `$1${한줄}\n`);
  } else {
    console.warn("  「지난 지금」 절을 찾지 못했습니다 — 손으로 한 줄 더하세요");
  }
  await writeFile(지금쪽, n, "utf8");
  console.log(`  「지난 지금」에 걸었습니다: ${달이름}`);
}

console.log("\n이제 /now/ 를 새로 고쳐 쓰면 됩니다 — 과거는 이미 남았습니다.");
console.log("그다음 node tools/make-notes-pages.mjs 로 지도를, make-feed.mjs 로 피드를 다시 지으세요.");
