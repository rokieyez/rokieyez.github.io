/* 집을 한 채로 본다 — 방마다 규칙이 어긋나지 않았는지 견준다
 *
 * 왜 필요한가:
 *   rokiz.net 은 저장소 둘이 한 도메인을 나눠 쓴다. 방을 하나씩 고치다
 *   보면 이쪽에만 theme-color 를 넣거나, 저쪽 canonical 만 인코딩을
 *   빠뜨리는 일이 생긴다 — 실제로 셋을 그렇게 놓쳤다 (2026-09-03).
 *   눈으로는 방 하나씩만 보이지만, 로봇과 손님은 집 전체를 걸어 다닌다.
 *
 * 무엇을 보나:
 *   ① 모든 쪽이 열리나 (지도에 적힌 곳까지)
 *   ② 쪽마다의 규칙 — 제목·설명·canonical·og·테마색·구조화 표식
 *   ③ canonical 이 지도의 loc 과 글자 그대로 같은가
 *   ④ 쪽 안의 안쪽 링크가 다 살아 있나
 *
 * 쓰는 법:
 *   node tools/check-house.mjs           집 쪽만 (빠르다)
 *   node tools/check-house.mjs --all     지도에 적힌 곳을 전부 (549곳, 느리다)
 *   node tools/check-house.mjs --local    localhost:8777 을 본다
 *
 * 하나라도 어긋나면 1 로 끝난다 — 워크플로가 초록불을 거짓으로 켜지 않게.
 */
process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });

const 전부 = process.argv.includes("--all");
const 집 = process.argv.includes("--local")
  ? "http://localhost:8777" : "https://www.rokiz.net";

const 뽑 = (h, re) => (re.exec(h) || [])[1] || "";
const 흠 = [];
const 티 = (곳, 말) => 흠.push(`${곳} — ${말}`);

/* 집이 지키기로 한 규칙. 방을 새로 열면 여기 한 줄 */
const 방들 = [
  { 이름: "대문",     길: "/",                            표식: 1 },
  { 이름: "지금",     길: "/now/",                        표식: 1 },
  { 이름: "지난 지금", 길: "/now/2026-09.html",            표식: 1, 색인안함: true },
  { 이름: "글방",     길: "/notes/",                      표식: 1 },
  { 이름: "서재",     길: "/books/",                      표식: 1 },
  { 이름: "책 목록",   길: "/books/b/",                     표식: 1 },
  { 이름: "잠긴 문",   길: "/이런-쪽은-없습니다",             상태: 404, 색인안함: true, 건너뜀: true },
];

async function 받기(길) {
  const r = await fetch(집 + 길, { redirect: "follow" });
  return { 상태: r.status, 글: await r.text() };
}

/* ── ① 방마다의 규칙 ────────────────────────────────────────────── */
console.log("── 방마다의 규칙 ──");
for (const 방 of 방들) {
  let r;
  try { r = await 받기(방.길); }
  catch (e) { 티(방.이름, `열지 못했습니다 (${e.message})`); continue; }

  const 바란상태 = 방.상태 || 200;
  if (r.상태 !== 바란상태) 티(방.이름, `${바란상태} 이어야 하는데 ${r.상태}`);
  const h = r.글;

  const 제목 = 뽑(h, /<title>([^<]*)<\/title>/);
  const 설명 = 뽑(h, /name="description" content="([^"]*)"/);
  const 테마 = 뽑(h, /name="theme-color" content="([^"]*)"/);
  const robots = 뽑(h, /name="robots" content="([^"]*)"/);
  const 표식수 = (h.match(/application\/ld\+json/g) || []).length;

  if (테마 !== "#171009") 티(방.이름, `테마색이 ${테마 || "없습니다"} — 집은 #171009`);
  if (!방.건너뜀) {
    if (!제목) 티(방.이름, "제목이 없습니다");
    if (설명.length < 20) 티(방.이름, `설명이 ${설명.length}자 — 검색 결과에 그대로 실립니다`);
    if (방.표식 && 표식수 < 방.표식) 티(방.이름, `구조화 표식이 ${표식수}개 (${방.표식}개여야)`);
    for (const k of ["og:title", "og:url", "og:image", "og:type"]) {
      if (!new RegExp(`property="${k}"`).test(h)) 티(방.이름, `${k} 가 없습니다`);
    }
    /* canonical 은 자기 주소를 가리켜야 한다 */
    const can = 뽑(h, /rel="canonical" href="([^"]*)"/);
    if (!can) 티(방.이름, "canonical 이 없습니다");
    else if (집.startsWith("https") && can !== 집 + 방.길) {
      티(방.이름, `canonical 이 ${can} — ${집 + 방.길} 여야`);
    }
  }
  if (방.색인안함 && robots !== "noindex") 티(방.이름, "noindex 여야 하는데 없습니다");
  if (!방.색인안함 && robots === "noindex") 티(방.이름, "noindex 가 걸려 있습니다");

  console.log(`  ${방.이름.padEnd(8)} ${r.상태} · 표식 ${표식수} · 설명 ${설명.length}자 · ${제목}`);
}

/* ── ② 지도와 canonical 이 같은 글자인가 ────────────────────────── */
console.log("\n── 지도 ──");
const 지도들 = ["/sitemap.xml", "/books/sitemap.xml"];
const 모든곳 = [];
for (const 지 of 지도들) {
  try {
    const { 상태, 글 } = await 받기(지);
    if (상태 !== 200) { 티(지, `${상태}`); continue; }
    const 곳 = [...글.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (!곳.length) 티(지, "곳이 하나도 없습니다 — 빈 지도입니다");
    모든곳.push(...곳);
    console.log(`  ${지} — ${곳.length}곳`);
  } catch (e) { 티(지, e.message); }
}

/* 표본(또는 --all 이면 전부)의 canonical 이 지도의 loc 과 같은 글자인지.
   한쪽만 날것 한글이면 검색엔진 눈에 서로 다른 두 주소가 된다. */
const 볼곳 = 전부 ? 모든곳 : 모든곳.filter((_, i) => i % 97 === 0).slice(0, 12);
console.log(`\n── canonical 대조 (${볼곳.length}곳) ──`);
let 어긋남 = 0;
for (const u of 볼곳) {
  try {
    const r = await fetch(u);
    if (r.status !== 200) { 티(u, `지도에 있는데 ${r.status}`); continue; }
    const can = 뽑(await r.text(), /rel="canonical" href="([^"]*)"/);
    if (can && can !== u) { 티(u, `canonical 이 다른 글자입니다 → ${can}`); 어긋남++; }
  } catch (e) { 티(u, e.message); }
}
console.log(`  어긋난 곳 ${어긋남}`);

/* ── ③ 방에서 방으로 가는 안쪽 링크가 살아 있나 ────────────────── */
console.log("\n── 안쪽 링크 ──");
const 본곳 = new Set();
let 죽음 = 0;
for (const 방 of 방들) {
  if (방.건너뜀) continue;
  const { 글: h } = await 받기(방.길);
  const 길들 = [...new Set([...h.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]))]
    .filter((u) => !/\.(svg|png|ico|webmanifest|xml|txt|css|js)$/.test(u));
  for (const u of 길들) {
    if (본곳.has(u)) continue;
    본곳.add(u);
    try {
      const r = await fetch(집 + u, { method: "HEAD" });
      if (r.status >= 400) { 티(방.이름, `죽은 링크 ${u} (${r.status})`); 죽음++; }
    } catch (e) { 티(방.이름, `${u} — ${e.message}`); 죽음++; }
  }
}
console.log(`  걸어 본 길 ${본곳.size} · 죽은 링크 ${죽음}`);

/* ── 끝 ──────────────────────────────────────────────────────── */
if (흠.length) {
  console.log(`\n어긋난 곳 ${흠.length}:`);
  흠.forEach((x) => console.log(`  · ${x}`));
  process.exitCode = 1;
} else {
  console.log("\n집이 한 채로 서 있습니다 — 어긋난 곳 없음");
}
