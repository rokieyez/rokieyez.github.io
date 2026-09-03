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
 *   ⑥ 시간에 닳는 것들 — 도메인·인증서의 남은 날
 *   ⑤ 지어 둔 것이 뒤처지지 않았나 — 이 집에서 무엇을 만드는 일은 전부
 *      손이다(글쪽·카드·지도·피드). 도구를 안 돌리면 발행한 글이 검색에
 *      아예 없고, 새로 꽂은 책도 마찬가지다. 그런데 그것을 알려 주는
 *      것이 없었다. 여기서 DB 와 견주어 잡는다.
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
  { 이름: "글방",     길: "/notes/",                      표식: 1 },
  { 이름: "서재",     길: "/books/",                      표식: 1 },
  { 이름: "책 목록",   길: "/books/b/",                     표식: 1 },
  { 이름: "잠긴 문",   길: "/이런-쪽은-없습니다",             상태: 404, 색인안함: true, 건너뜀: true },
];

/* 지난 지금(now/<연도>-<달>.html)은 늘어난다. 손으로 적어 두면 다음 달 것을
   잊고, 그러면 점검이 그 쪽을 아예 안 본다. 지도에서 찾아 넣는다. */
async function 갈무리찾기() {
  try {
    const r = await fetch(집 + "/sitemap.xml");
    if (!r.ok) return;
    for (const m of (await r.text()).matchAll(/<loc>[^<]*(\/now\/\d{4}-\d{2}\.html)<\/loc>/g)) {
      방들.splice(2, 0, { 이름: `갈무리 ${m[1].slice(5, 12)}`, 길: m[1], 표식: 1, 색인안함: true });
    }
  } catch { /* 지도를 못 읽으면 아래에서 흠으로 잡힌다 */ }
}
await 갈무리찾기();

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

/* ── ⑤ 지어 둔 것이 뒤처지지 않았나 ──────────────────────────────
   이 집에서 만드는 일은 전부 손이다. 글을 발행하고 도구를 안 돌리면
   그 글은 검색에도 미리보기에도 없다 — 발행했는데 아무도 못 읽는다.
   DB 가 진실이고 지도·피드는 그 그림자이므로, 둘을 견주면 잡힌다. */
console.log("\n── 뒤처진 것 ──");
const 열쇠 = "sb_publishable_NI4gjQ3YePIO90H7YjHjfA_m_H0udRy";
const REST = "https://gaeumegwhxxnfvrhbknp.supabase.co/rest/v1";
const 머리 = { apikey: 열쇠, Authorization: "Bearer " + 열쇠 };

/* 몸통 없이 세기만 하는 질의 — 오가는 것이 헤더뿐이다 */
async function 세기(표, 조건 = "") {
  const r = await fetch(`${REST}/${표}?select=id${조건}`,
    { method: "HEAD", headers: { ...머리, Prefer: "count=exact", Range: "0-0" } });
  const m = /\/(\d+)$/.exec(r.headers.get("content-range") || "");
  return m ? Number(m[1]) : null;
}

try {
  /* 글 — 발행한 편수와 지도에 오른 글쪽 수 */
  const 발행 = await 세기("notes", "&published_at=not.is.null");
  const 글쪽 = 모든곳.filter((u) => /\/notes\/[^/]+\.html$/.test(u)).length;
  console.log(`  글    발행 ${발행}편 · 지도의 글쪽 ${글쪽}장`);
  if (발행 !== null && 발행 !== 글쪽) {
    티("글방", `발행 ${발행}편인데 글쪽은 ${글쪽}장 — ` +
       "make-notes-cards · make-notes-pages · make-feed 를 돌리세요");
  }

  /* 책 — 서가의 권수와 지도에 오른 나눔 쪽 수 (지도에는 목록 쪽 하나가 더 있다) */
  const 권 = await 세기("books");
  const 나눔 = 모든곳.filter((u) => /\/books\/b\/[^/]+\.html$/.test(u)).length;
  console.log(`  책    서가 ${권}권 · 지도의 나눔 쪽 ${나눔}장`);
  if (권 !== null && 권 !== 나눔) {
    티("서재", `서가 ${권}권인데 나눔 쪽은 ${나눔}장 — ` +
       "서재 저장소에서 make-book-pages.mjs 를 돌리세요");
  }
} catch (e) {
  /* 조용히 넘어가면 안 된다. 무료 요금제는 오래 안 쓰면 프로젝트가 잠드는데,
     그러면 대문의 셈·글방·서재가 한꺼번에 죽는다 (정적 쪽만 살아남는다).
     이레에 한 번 도는 이 점검이 그것을 알아채는 자리다. */
  티("글방·서재의 DB", `묻지 못했습니다 (${e.message}) — ` +
     "Supabase 가 잠들었을 수 있습니다 (무료 요금제는 오래 안 쓰면 멈춥니다)");
}

/* 피드 — 집 피드는 손으로 지으므로 서재 피드보다 옛것이 되기 쉽다 */
try {
  const 때 = async (u) => {
    const t = await (await fetch(집 + u)).text();
    return (/<updated>([^<]+)<\/updated>/.exec(t) || [])[1] || null;
  };
  const [집때, 서재때] = await Promise.all([때("/feed.xml"), 때("/books/feed.xml")]);
  console.log(`  피드  집 ${집때?.slice(0, 10)} · 서재 ${서재때?.slice(0, 10)}`);
  if (집때 && 서재때 && new Date(집때) < new Date(서재때)) {
    티("집 피드", `서재 피드(${서재때.slice(0, 10)})보다 옛것입니다(${집때.slice(0, 10)}) — ` +
       "make-feed.mjs 를 돌리세요");
  }
} catch (e) { 티("피드", e.message); }

/* 대문의 「지금은 N이 열려 있습니다」가 실제 문 개수와 맞는가.
   한 번 어긋난 적이 있다 — og 와 twitter 만 「하나」에서 멈춰 있었다. */
try {
  const h = (await 받기("/")).글;
  const 문수 = (h.match(/<a class="door"/g) || []).length;
  const 수사 = { 1: "하나가", 2: "둘이", 3: "셋이", 4: "넷이", 5: "다섯이" }[문수];
  const 말들 = [...h.matchAll(/지금은 ([^ ]+) 열려 있습니다/g)].map((m) => m[1]);
  console.log(`  대문  문 ${문수}개 · 「${[...new Set(말들)].join("」「")}」`);
  for (const 말 of new Set(말들)) {
    if (수사 && 말 !== 수사) 티("대문", `문은 ${문수}개인데 「${말} 열려 있습니다」라고 적혀 있습니다`);
  }
  if (말들.length < 3) 티("대문", `그 문장이 ${말들.length}곳에만 있습니다 — 본문·og·twitter 셋이어야`);
} catch (e) { 티("대문", e.message); }

/* ── ⑥ 시간에 닳는 것 ────────────────────────────────────────────
   집이 아무리 반듯해도 땅문서가 만료되면 통째로 사라진다. 여섯 달 전부터
   세어 두면 잊을 수가 없다. */
console.log("\n── 남은 날 ──");
const 남은날 = (iso) => Math.round((new Date(iso) - Date.now()) / 86400000);

/* 도메인 — whois 는 어디에나 있지 않지만 RDAP 는 그냥 HTTP 다 */
try {
  const r = await fetch("https://rdap.verisign.com/net/v1/domain/rokiz.net");
  if (r.ok) {
    const 끝 = (await r.json()).events?.find((e) => e.eventAction === "expiration")?.eventDate;
    if (끝) {
      const d = 남은날(끝);
      console.log(`  도메인   ${끝.slice(0, 10)} — ${d}일`);
      /* 90일: 닷네임의 갱신 안내가 오는 무렵이고, 잊어도 두어 번 더 알린다 */
      if (d < 90) 티("도메인", `${d}일 뒤(${끝.slice(0, 10)}) 만료됩니다 — 닷네임에서 갱신하세요`);
    }
  }
} catch (e) { console.log(`  도메인   묻지 못했습니다 (${e.message})`); }

/* 인증서 — GitHub Pages 가 스스로 갈지만, 갈지 못하면 집이 안 열린다 */
try {
  const { connect } = await import("node:tls");
  const 끝 = await new Promise((풀림, 깨짐) => {
    const 줄 = connect({ host: "www.rokiz.net", port: 443, servername: "www.rokiz.net" },
      () => { const c = 줄.getPeerCertificate(); 줄.end(); 풀림(c?.valid_to); });
    줄.setTimeout(10000, () => { 줄.destroy(); 깨짐(new Error("시간 초과")); });
    줄.on("error", 깨짐);
  });
  const d = 남은날(끝);
  console.log(`  인증서   ${new Date(끝).toISOString().slice(0, 10)} — ${d}일`);
  /* 14일: Let's Encrypt 는 30일 전부터 갈려 하므로, 여기까지 왔으면 정말 안 되는 것 */
  if (d < 14) 티("인증서", `${d}일 남았습니다 — GitHub Pages 가 스스로 갈지 못하고 있습니다`);
} catch (e) { console.log(`  인증서   보지 못했습니다 (${e.message})`); }

/* 「지금」은 낡으면 안 되는 쪽이다. 그런데 손으로만 바뀌므로, 반년쯤
   손대지 않아도 화면은 태연히 「지금은 …하고 있습니다」라고 말한다.
   쪽에 「언제 적었나」를 박아 두면 그것부터 낡으니(README 의 규칙),
   대신 git 에게 묻는다. 얕은 클론에서는 알 수 없으므로 조용히 건너뛴다. */
try {
  const { execFileSync } = await import("node:child_process");
  /* git 이 없거나 저장소 밖이면 stderr 로 「깃 저장소가 아닙니다」를 쏟는다.
     받아 와서 돌리는 자리(서재 저장소)가 바로 그런 곳이라, 결과에 아무
     영향이 없는 오류 글이 로그에 남아 사람을 놀라게 한다 — 삼킨다. */
  const 조용히 = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  const 잰다 = (파일) =>
    (execFileSync("git", ["log", "-1", "--format=%cs", "--", 파일], 조용히).trim() || null)
      && Math.round((Date.now() - new Date(
           execFileSync("git", ["log", "-1", "--format=%cs", "--", 파일], 조용히).trim())) / 86400000);
  const 깊이 = execFileSync("git", ["rev-list", "--count", "HEAD"], 조용히).trim();
  if (!깊이 || Number(깊이) <= 1) {
    console.log("  지금     히스토리가 없어 묵은 날을 셀 수 없습니다 " +
                "(루트 저장소에서 fetch-depth: 0 으로 돌 때만 셉니다)");
  } else {
    const 묵음 = 잰다("now/index.html");
    console.log(`  지금     ${묵음}일째 그대로`);
    /* 90일: 「지금」이 석 달째 같은 말을 하고 있으면 그것은 지금이 아니다 */
    if (묵음 !== null && 묵음 > 90) {
      티("지금", `${묵음}일째 손대지 않았습니다 — /now/ 는 낡으면 안 되는 쪽입니다 ` +
         "(고치기 전에 now/<연도>-<달>.html 로 갈무리하세요)");
    }
  }
} catch { /* git 이 없으면 셀 것이 없다 */ }

/* 공개 열쇠가 여러 곳에 흩어져 있다 — 하나만 갈고 나머지를 잊으면
   그 쪽만 조용히 죽는다. 살아 있는 쪽들이 같은 열쇠를 쓰는지 본다. */
try {
  const 열쇠들 = new Set();
  for (const 길 of ["/", "/notes/", "/now/", "/404.html"]) {
    const h = (await 받기(길)).글;
    for (const m of h.matchAll(/sb_publishable_[A-Za-z0-9_-]+/g)) 열쇠들.add(m[0]);
  }
  console.log(`  열쇠     쓰는 곳이 다 같은가 — ${열쇠들.size}가지`);
  if (열쇠들.size > 1) 티("열쇠", `쪽마다 다른 열쇠를 쓰고 있습니다 (${열쇠들.size}가지)`);
} catch (e) { console.log(`  열쇠     보지 못했습니다 (${e.message})`); }

/* ── 끝 ──────────────────────────────────────────────────────── */
if (흠.length) {
  console.log(`\n어긋난 곳 ${흠.length}:`);
  흠.forEach((x) => console.log(`  · ${x}`));
  process.exitCode = 1;
} else {
  console.log("\n집이 한 채로 서 있습니다 — 어긋난 곳 없음");
}
