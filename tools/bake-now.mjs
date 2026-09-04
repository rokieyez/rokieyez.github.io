/* 「지금」의 읽는 중 목록을 구워 둔다 — now/index.html
 *
 * 왜:
 *   /now/ 의 「읽는 중」은 서재에 그 자리에서 묻는다. 그래서 서재가 답하지
 *   않거나 자바스크립트가 꺼져 있으면 그 자리가 통째로 빈다 (바로 아래
 *   「최근에 꽂은 책」은 우리 서버의 feed.xml 을 읽으므로 멀쩡한데도).
 *   글방에 한 것과 같은 수법으로, 그때의 목록을 글자로 구워 둔다.
 *
 * 무엇이 중요한가:
 *   **구운 것은 갈무리지 오늘이 아니다.** 서재가 답하면 오늘 것으로 갈아
 *   끼우고, 못 답할 때만 이것을 편다 — 그때는 언제 구운 것인지 밝힌다.
 *   그래서 굽는 날짜를 <ul data-baked> 에 함께 적는다.
 *
 * 쓰는 법:  node tools/bake-now.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { 오늘 } from "./오늘.mjs";

process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 서재 = "https://gaeumegwhxxnfvrhbknp.supabase.co/rest/v1/books";
const 열쇠 = "sb_publishable_NI4gjQ3YePIO90H7YjHjfA_m_H0udRy";

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
/* 알라딘은 표지가 없을 때 「No Image」 그림 주소를 준다 — 표지가 없는 것으로 친다 */
const 진짜표지 = (u) => (u && !/\/noimg/i.test(u) ? u : null);

/* 화면의 스크립트가 만드는 <li> 와 **같은 꼴**이어야 한다.
   두 곳이 다르면 서재가 답하는 순간 목록이 눈에 띄게 덜컹인다. */
function 한줄(b) {
  const 갈피 = (b.bookmark_page && b.page_count)
    ? ` — ${b.page_count}쪽 중 ${b.bookmark_page}쪽` : "";
  const 표지 = 진짜표지(b.cover_url);
  const 막대 = (b.bookmark_page && b.page_count)
    ? `<span class="prog"><i style="width:${
        Math.max(1, Math.round(b.bookmark_page / b.page_count * 100))}%"></i></span>` : "";
  const 글 = `<b><a href="/books/#book/${esc(b.id)}">${esc(b.title || "무제")}</a></b>`
           + `<i> ${esc(b.author || "지은이 미상")}${esc(갈피)}</i>${막대}`;
  if (!표지) return `      <li>${글}</li>`;
  return `      <li class="withcover">`
    + `<img src="${esc(표지)}" alt="" loading="lazy" decoding="async">`
    + `<span class="t">${글}</span></li>`;
}

const r = await fetch(
  서재 + "?select=id,title,author,bookmark_page,page_count,cover_url"
  + "&read_status=eq." + encodeURIComponent("읽는 중")
  + "&order=bookmark_at.desc.nullslast&limit=6",
  { headers: { apikey: 열쇠, Authorization: `Bearer ${열쇠}` } });
if (!r.ok) {
  console.error(`서재에 묻지 못했습니다 (${r.status}) — 굽지 않고 그만둡니다`);
  process.exit(1);
}
const 책들 = await r.json();

const 쪽 = join(뿌리, "now", "index.html");
const 옛 = await readFile(쪽, "utf8");
const 틀 = /(<ul id="reading"[^>]*>)[\s\S]*?(<\/ul>)/;
if (!틀.test(옛)) {
  console.error("now/index.html 에서 읽는 중 목록을 찾지 못했습니다");
  process.exit(1);
}
const 오늘날 = 오늘();
const 속 = 책들.length
  ? "\n" + 책들.map(한줄).join("\n") + "\n    "
  : `<li class="empty">그때는 펼쳐 둔 책이 없었습니다.</li>`;
const 새 = 옛.replace(틀, `<ul id="reading" data-baked="${오늘날}">${속}$2`);

if (새 === 옛) {
  console.log("읽는 중 갈무리는 이미 최신입니다");
} else {
  await writeFile(쪽, 새, "utf8");
  console.log(`읽는 중 ${책들.length}권을 구웠습니다 (${오늘날}) → now/index.html`);
  책들.forEach((b) => console.log(`  ${b.title}`));
}
