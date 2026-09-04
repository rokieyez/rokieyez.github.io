/* 대문 문 세 짝 안의 셈을 구워 둔다 — index.html
 *
 * 왜:
 *   대문의 문 안에는 그 방의 오늘이 한 줄씩 걸린다 — 「544권 · 27권 읽음」,
 *   「2일 전」, 「1편 · 오늘 놓임」. 이 줄들은 서재와 글방에 그 자리에서
 *   묻는 값이라, 답이 오기 전까지 문 안이 비어 있다. 2026-09-04 에 재어
 *   보니 처음 몇 초 동안 세 문이 모두 빈 채였다 — 처음 오는 사람이 보는
 *   것은 「방이 셋 있다」는 말뿐이고, 그 방에 무엇이 얼마나 있는지는
 *   보이지 않는다. /now/ 와 /notes/ 에 한 것과 같은 수법으로 굽는다.
 *
 * 무엇이 중요한가:
 *   대문에는 「권수는 적지 않는다 — 정적 파일의 숫자는 반드시 거짓이
 *   된다」는 주석이 오래 붙어 있었다. 옳은 걱정이다. 그래서 두 가지를
 *   지킨다.
 *
 *   ① **셀 수 있는 것은 다시 센다.** 「2일 전」처럼 시간이 흐르면 틀리는
 *      말은 글자로 굽지 않고, 그 시각 자체(data-at)를 심어 둔다. 화면은
 *      그것을 **오늘 기준으로** 다시 세어 말한다 — 구운 지 한 달이 지나도
 *      「한 달 전」이라고 바르게 말한다.
 *   ② **다시 셀 수 없는 것은 언제 것인지 밝힌다.** 권수·편수는 늘어나므로
 *      구운 값이 옛것이 될 수 있다. 서재가 답하면 그 자리에서 갈아 끼우고,
 *      끝내 답하지 못하면 그때만 「9.4 기준」이라고 꼬리를 단다.
 *
 * 쓰는 법:  node tools/bake-doors.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { 오늘 } from "./오늘.mjs";
import { 열쇠, 밑동 } from "./집.mjs";

process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 오늘날 = 오늘();

const 머리 = { apikey: 열쇠, Authorization: `Bearer ${열쇠}` };

/* 몸통 없이 세기만 한다 — 서재의 전송량 규칙(books/CLAUDE.md)을 따른다 */
async function 세기(길) {
  const r = await fetch(`${밑동}${길}`, {
    method: "HEAD",
    headers: { ...머리, Prefer: "count=exact", Range: "0-0" },
  });
  const m = /\/(\d+)$/.exec(r.headers.get("content-range") || "");
  return m ? Number(m[1]) : null;
}

async function 하나(길) {
  const r = await fetch(`${밑동}${길}`, { headers: 머리 });
  if (!r.ok) throw new Error(`서재가 ${r.status} 로 답했습니다`);
  const [x] = await r.json();
  return x || null;
}

/* ── 세 문의 값을 받아 온다 ─────────────────────────────────── */
const 읽는중 = encodeURIComponent("읽는 중");

const [전부, 읽음, 갈피, 글] = await Promise.all([
  세기("/books?select=id"),
  세기(`/books?select=id&read_status=eq.${encodeURIComponent("읽음")}`),
  하나(`/books?select=bookmark_at&read_status=eq.${읽는중}` +
       "&bookmark_at=not.is.null&order=bookmark_at.desc&limit=1"),
  (async () => {
    const r = await fetch(
      `${밑동}/notes?select=published_at&order=published_at.desc&limit=1`,
      { headers: { ...머리, Prefer: "count=exact" } });
    if (!r.ok) throw new Error(`글방이 ${r.status} 로 답했습니다`);
    const m = /\/(\d+)$/.exec(r.headers.get("content-range") || "");
    const [n] = await r.json();
    return { 편: m ? Number(m[1]) : 0, 때: n?.published_at || "" };
  })(),
]);

if (!전부) {
  console.error("서재가 권수를 세어 주지 않았습니다 — 굽지 않고 그만둡니다");
  process.exit(1);
}

/* ── 문 안에 글자로 박는다 ──────────────────────────────────── */
const 쪽 = join(뿌리, "index.html");
let s = await readFile(쪽, "utf8");

/* 화면의 스크립트가 만드는 말과 **같은 꼴**이어야 한다 — 서재가 답하는
   순간 문 안의 글자가 눈에 띄게 덜컹이면 구운 뜻이 없다 */
const 책말 = `${전부.toLocaleString()}권 · ${(읽음 || 0).toLocaleString()}권 읽음`;

const 새문 = {
  "d-books": `<em id="d-books" data-baked="${오늘날}">${책말}</em>`,
  /* 시간은 글자로 굽지 않는다 — 시각만 심고 화면이 오늘 기준으로 다시 센다 */
  "d-now": 갈피?.bookmark_at
    ? `<em id="d-now" data-baked="${오늘날}" data-at="${갈피.bookmark_at}"></em>`
    : `<em id="d-now" hidden></em>`,
  "d-notes": 글?.편
    ? `<em id="d-notes" data-baked="${오늘날}" data-count="${글.편}"${
        글.때 ? ` data-at="${글.때}"` : ""}></em>`
    : `<em id="d-notes" hidden></em>`,
};

let 바꾼수 = 0;
for (const [id, 새것] of Object.entries(새문)) {
  const 자리 = new RegExp(`<em id="${id}"[^>]*>[\\s\\S]*?</em>`);
  if (!자리.test(s)) {
    console.warn(`  ${id} 자리를 찾지 못했습니다 — 건너뜁니다`);
    continue;
  }
  s = s.replace(자리, 새것);
  바꾼수++;
}

await writeFile(쪽, s, "utf8");

console.log(`대문의 문 ${바꾼수}짝에 오늘을 구웠습니다 → index.html`);
console.log(`  서재  ${책말}`);
console.log(`  지금  ${갈피?.bookmark_at ? `갈피 ${갈피.bookmark_at.slice(0, 10)}` : "갈피 없음"}`);
console.log(`  글    ${글?.편 ?? 0}편${글?.때 ? ` · 마지막 ${글.때.slice(0, 10)}` : ""}`);
console.log("\n구운 것은 갈무리입니다 — 서재가 답하면 화면이 오늘 것으로 갈아 끼웁니다.");
