/* 글마다 링크 미리보기 그림을 굽는다 — notes/card/<슬러그>.png (1200×630)
 *
 * 왜 필요한가:
 *   글을 카톡·슬랙에 건네면 지금은 모두 같은 og.png 가 뜬다. 열 편을
 *   나눠도 미리보기는 똑같은 그림 하나 — 어느 글인지 알 수 없다.
 *   서재가 책마다 표지를 걸어 얼굴을 달리하는 것과 같은 까닭이다.
 *
 * 어떻게 굽나:
 *   HTML 로 카드 한 장을 그리고 헤드리스 크롬으로 사진을 찍는다.
 *   canvas 라이브러리를 새로 들이지 않으려는 것이다 — 정적 사이트에
 *   빌드 단계를 만들지 않는다는 규약이 있고, 크롬은 이 기계에 이미 있다.
 *   글꼴도 화면과 같은 것(고운바탕)이 그대로 쓰인다.
 *
 * 언제 돌리나:
 *   글을 발행하거나 제목을 고친 뒤. 이미 있는 카드는 다시 굽지 않는다
 *   (--force 를 붙이면 전부 다시). 내린 글의 카드는 지워진다.
 *
 * 쓰는 법:  node tools/make-notes-cards.mjs [--force]
 */
import { writeFile, readdir, rm, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
const 달려 = promisify(execFile);

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 자리 = join(뿌리, "notes", "card");
const 서버 = "https://gaeumegwhxxnfvrhbknp.supabase.co/rest/v1/notes";
const 열쇠 = "sb_publishable_NI4gjQ3YePIO90H7YjHjfA_m_H0udRy";
const 크롬 = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const 다시 = process.argv.includes("--force");

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* 카드 한 장. 서재의 회고 카드와 같은 밤빛이라 집의 얼굴이 이어진다.
   제목이 길면 저절로 작아진다 — 넘쳐서 잘리는 것보다 낫다. */
const 카드 = (n) => {
  const 자 = String(n.title || "").length;
  const 크기 = 자 <= 12 ? 76 : 자 <= 20 ? 62 : 자 <= 30 ? 50 : 42;
  /* 넉넉히 주고 자르는 일은 CSS 에 맡긴다 — 글자 수로 미리 자르면
     「밤 11시가 넘」처럼 말 중간에서 뚝 끊기고 말줄임표도 안 붙는다.
     -webkit-line-clamp 는 두 줄에서 … 를 달아 준다. */
  const 첫줄 = String(n.body || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const d = new Date(n.published_at);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Cormorant:ital,wght@1,500&display=swap">
<style>
  * { margin: 0; box-sizing: border-box }
  html, body { width: 1200px; height: 630px }
  body {
    background: #171009; color: #E9DFC9;
    font-family: "Gowun Batang", serif;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 96px; position: relative; overflow: hidden;
  }
  /* 열쇠구멍에서 새어 나오는 빛 — 대문과 같은 몸짓 */
  body::before {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(46% 60% at 22% 0%, rgba(224,177,94,.13), transparent 68%);
  }
  .latin {
    font-family: "Cormorant", serif; font-style: italic;
    font-size: 25px; letter-spacing: .32em; color: #9C8E74; margin-bottom: 22px;
  }
  h1 {
    font-size: ${크기}px; font-weight: 700; line-height: 1.4; letter-spacing: .02em;
    word-break: keep-all; max-width: 940px;
  }
  .peek {
    margin-top: 26px; font-size: 25px; line-height: 1.7; color: #9C8E74;
    word-break: keep-all; max-width: 880px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .foot {
    position: absolute; left: 96px; right: 96px; bottom: 54px;
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 21px; color: #9C8E74; letter-spacing: .06em;
  }
  .foot .site { color: #E0B15E }
  /* 아래로 흐르는 놋빛 실 — 카드가 그냥 검은 판이 되지 않게 */
  .rule { position: absolute; left: 0; bottom: 0; height: 5px; width: 100%;
          background: linear-gradient(90deg, rgba(224,177,94,.55), rgba(224,177,94,.05)) }
</style></head>
<body>
  <p class="latin">SCRIPTA</p>
  <h1>${esc(n.title)}</h1>
  ${첫줄 ? `<p class="peek">${esc(첫줄)}</p>` : ""}
  <div class="foot">
    <span class="site">rokiz.net/notes</span>
    <span>${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일</span>
  </div>
  <div class="rule"></div>
</body></html>
`;
};

/* ── 굽기 ─────────────────────────────────────────────────────── */
const r = await fetch(`${서버}?select=slug,title,body,published_at&order=published_at.desc`,
  { headers: { apikey: 열쇠, Authorization: `Bearer ${열쇠}` } });
if (!r.ok) throw new Error(`글방을 읽지 못했습니다 (${r.status})`);
const 글들 = (await r.json()).filter((n) => n.published_at);

await mkdir(자리, { recursive: true });

/* 내린 글의 카드는 남기지 않는다 */
const 살아있음 = new Set(글들.map((n) => `${n.slug}.png`));
for (const f of await readdir(자리).catch(() => [])) {
  if (f.endsWith(".png") && !살아있음.has(f)) {
    await rm(join(자리, f));
    console.log(`  내린 글의 카드를 지웠습니다: ${f}`);
  }
}

let 구움 = 0, 건너뜀 = 0;
for (const n of 글들) {
  const 낼것 = join(자리, `${n.slug}.png`);
  if (!다시) {
    try { await access(낼것); 건너뜀++; continue; } catch { /* 없으니 굽는다 */ }
  }
  const 임시 = join(tmpdir(), `rokiz-card-${Date.now()}-${구움}.html`);
  await writeFile(임시, 카드(n), "utf8");
  /* --virtual-time-budget 은 글꼴이 내려올 때까지 크롬의 시계를 붙잡아 둔다.
     이것이 없으면 글꼴이 오기 전에 찍혀 대체 글꼴로 굳은 카드가 나온다. */
  await 달려(크롬, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--window-size=1200,630", "--force-device-scale-factor=1",
    "--virtual-time-budget=8000",
    `--screenshot=${낼것}`, `file://${임시}`,
  ]).catch((e) => { throw new Error(`카드를 굽지 못했습니다 (${n.slug}): ${e.message}`); });
  await rm(임시).catch(() => {});
  구움++;
  console.log(`  구웠습니다: card/${n.slug}.png — ${n.title}`);
}
console.log(`카드 ${구움}장을 구웠습니다${건너뜀 ? ` (이미 있어 건너뛴 것 ${건너뜀}장)` : ""} → notes/card/`);
if (건너뜀 && !다시) console.log("  제목이나 첫 문장을 고쳤으면 --force 로 다시 구우세요");
