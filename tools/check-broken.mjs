/* 고장난 집을 세워 놓고 재 본다 — 끊긴 서재·꺼진 자바스크립트
 *
 * 왜 이 도구인가:
 *   대비와 손가락 크기를 재는 자는 **화면에 떠 있는 것만** 잰다. 그래서
 *   「손과 눈」 회차가 통과라고 한 쪽에서 뒤에 세 가지가 나왔다
 *   (2026-09-03): ①고장 났을 때만 나타나는 글자 ②그때 아직 없던 내용이
 *   생기며 나타난 글자 ③다른 저장소의 쪽. 고장은 일부러 만들어 놓고
 *   재야 한다 — 그것이 이 도구다.
 *
 * 무엇을 하는가:
 *   ① 두 저장소를 임시 자리에 복사하고
 *   ② 서재(Supabase)로 나가는 fetch 를 끊는 조각을 모든 쪽에 끼우고
 *   ③ 작은 서버를 세워 크롬(헤드리스)으로 한 쪽씩 열어
 *   ④ 「말이 있는가 · 대비가 4.5 를 넘는가 · 포커스 고리가 있는가」를 본다
 *
 * 무엇이 중요한가:
 *   **끝나지 않는 기다림을 잡는다.** 「…하는 중」으로 시작해 그대로 멈춘
 *   자리는 빈자리보다 나쁘다 — 묻는 이가 없는데 묻는 중이라고 말한다.
 *
 * 쓰는 법:  node tools/check-broken.mjs [--keep]
 *   --keep : 임시 자리를 지우지 않는다 (직접 열어 보고 싶을 때)
 *
 * 어긋난 곳이 하나라도 있으면 1 로 나간다.
 */
import { mkdtemp, cp, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, relative } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
const 달려 = promisify(execFile);

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 서재뿌리 = join(뿌리, "..", "post-libros");
const 남길까 = process.argv.includes("--keep");

let 탈 = 0;
const 티 = (곳, 말) => { 탈++; console.log(`  ✗ ${곳} — ${말}`); };

/* ── 크롬을 찾는다 (make-notes-cards.mjs 와 같은 자리) ── */
const 크롬후보 = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
];
let 크롬 = null;
for (const c of 크롬후보) {
  try { await readFile(c); 크롬 = c; break; } catch { /* 다음 */ }
}
if (!크롬) {
  console.error("크롬을 찾지 못했습니다 — 이 점검은 헤드리스 크롬이 필요합니다.");
  process.exit(2);
}

/* ── ① 집을 임시 자리에 복사한다 ── */
const 자리 = await mkdtemp(join(tmpdir(), "rokiz-broken-"));
await cp(뿌리, 자리, { recursive: true, filter: (s) => !/\/\.git($|\/)/.test(s) });
await cp(서재뿌리, join(자리, "books"), { recursive: true, filter: (s) => !/\/\.git($|\/)/.test(s) });

/* ── ② 서재로 나가는 길을 끊는다 ── */
await writeFile(join(자리, "_cut.js"), `
(function(){
  var 나쁨 = /supabase\\.co/;
  var 옛 = window.fetch;
  window.fetch = function(u){
    var s = typeof u === "string" ? u : (u && u.url) || "";
    if (나쁨.test(s)) return Promise.reject(new TypeError("Failed to fetch"));
    return 옛.apply(this, arguments);
  };
})();
`, "utf8");

async function 쪽들(d) {
  const 것 = await readdir(d, { withFileTypes: true });
  const 낼것 = [];
  for (const e of 것) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(d, e.name);
    if (e.isDirectory()) 낼것.push(...await 쪽들(p));
    else if (extname(e.name) === ".html") 낼것.push(p);
  }
  return 낼것;
}
for (const f of await 쪽들(자리)) {
  const s = await readFile(f, "utf8");
  if (s.includes("_cut.js")) continue;
  await writeFile(f, s.replace(/<head([^>]*)>/i,
    `<head$1>\n<script src="/_cut.js"></script>`), "utf8");
}

/* ── ③ 작은 서버 ── */
const 타입 = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const 서버 = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const 파일 = join(자리, p);
  /* 임시 자리 밖으로 나가는 길은 막는다 */
  if (relative(자리, 파일).startsWith("..")) { res.writeHead(403).end(); return; }
  try {
    const b = await readFile(파일);
    res.writeHead(200, { "content-type": 타입[extname(파일)] || "application/octet-stream" });
    res.end(b);
  } catch { res.writeHead(404).end("없음"); }
});
await new Promise((ok) => 서버.listen(0, "127.0.0.1", ok));
const 항 = `http://127.0.0.1:${서버.address().port}`;

/* ── ④ 재는 조각 — 크롬 안에서 돈다 ── */
const 재는조각 = `(function(){
  /* 등장 애니메이션이 멈춘 화면에서는 무엇이든 opacity 0 이다 — 재기 전에 편다.
     (헤드리스는 CSS 애니메이션을 돌리지 않는다: 2026-09-03 에 이것 때문에
      대비가 전부 1.00 으로 나왔다) */
  document.querySelectorAll("*").forEach(function(e){
    if (getComputedStyle(e).opacity === "0") e.style.setProperty("opacity","1","important");
  });
  function rgb(s){var m=s.match(/[\\d.]+/g)||[];return m.slice(0,3).map(Number).concat(m.length>3?+m[3]:1);}
  function lum(c){var f=c.map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2];}
  function C(a,b){var l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);}
  function 바탕(el){var e=el;while(e){var b=rgb(getComputedStyle(e).backgroundColor);
    if(b[3]>0.9)return b.slice(0,3);e=e.parentElement;}return [23,16,9];}
  function 겹(el){var o=1,e=el;while(e&&e!==document.documentElement){
    o*=parseFloat(getComputedStyle(e).opacity)||0;e=e.parentElement;}return o;}

  var 흐린글=[], 멈춘말=[], 고리없음=[];
  document.querySelectorAll("*").forEach(function(el){
    var t=[].slice.call(el.childNodes).filter(function(n){return n.nodeType===3&&n.textContent.trim();})
      .map(function(n){return n.textContent.trim();}).join(" ");
    if(!t) return;
    var r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
    var cs=getComputedStyle(el); if(cs.visibility==="hidden") return;
    /* 장서인처럼 상표로 면제되는 것은 눈에서 감춘 것으로 표시해 둔다 */
    if(el.closest("[aria-hidden=true]")) return;
    var fg=rgb(cs.color), bg=바탕(el), a=겹(el)*(fg[3]==null?1:fg[3]);
    if(a<=0) return;
    var c=fg.slice(0,3).map(function(v,i){return v*a+bg[i]*(1-a);});
    var 비=C(c,bg), px=parseFloat(cs.fontSize), 굵=parseInt(cs.fontWeight)>=700;
    var 기준=(px>=24||(굵&&px>=18.66))?3:4.5;
    if(비<기준) 흐린글.push({글:t.slice(0,40), 자리:el.className||el.tagName,
                            px:+px.toFixed(1), 대비:+비.toFixed(2)});
    /* 끝나지 않는 기다림 — 말줄임표로 끝나고 그대로 멈춘 자리.
       **말줄임표가 표시다.** 처음에는 「…중」으로 찾았는데 <h2>읽는 중</h2>
       같은 제목과 「방들을 하나씩 여는 중」 같은 본문까지 걸렸다
       (2026-09-03). 기다리는 자리만 말줄임표로 끝난다. */
    if(/[…]$|\\.\\.\\.$/.test(t)) 멈춘말.push(t.slice(0,50));
  });
  /* 포커스 고리 */
  var 목 = [].slice.call(document.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(function(el){var cs=getComputedStyle(el);
      return cs.display!=="none"&&cs.visibility!=="hidden"&&!el.closest("[hidden]")&&!el.hidden
             &&el.getBoundingClientRect().width>0;});
  목.forEach(function(el){
    el.focus();
    var cs=getComputedStyle(el);
    if(cs.outlineStyle==="none"||parseFloat(cs.outlineWidth)<=0)
      고리없음.push((el.tagName+"."+String(el.className).split(" ")[0]));
    el.blur();
  });
  return JSON.stringify({흐린글:흐린글, 멈춘말:멈춘말, 고리없음:고리없음, 닿는것:목.length,
                         글자수:document.body.innerText.replace(/\\s+/g," ").trim().length});
})()`;

async function 재기(길) {
  const { stdout } = await 달려(크롬, [
    "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--window-size=390,900", "--virtual-time-budget=9000",
    "--run-all-compositor-stages-before-draw",
    `--dump-dom`, 항 + 길,
  ], { maxBuffer: 40 * 1024 * 1024 }).catch(() => ({ stdout: "" }));
  /* --dump-dom 은 스크립트가 돈 뒤의 DOM 을 준다. 다만 계산된 색을 알 수
     없으므로, 재는 일은 evaluate 로 해야 한다 — 크롬의 --dump-dom 에는
     그 길이 없다. 대신 쪽 안에 조각을 심고 그 결과를 DOM 에 적게 한다. */
  return stdout;
}

/* 재는 조각을 각 쪽에 심는다 — 결과를 <title> 뒤 <meta> 로 적어 두고 DOM 에서 읽는다 */
for (const f of await 쪽들(자리)) {
  const s = await readFile(f, "utf8");
  if (s.includes("id=\"__잰것\"")) continue;
  await writeFile(f, s.replace("</body>",
    `<script>addEventListener("load",function(){setTimeout(function(){
       var d=document.createElement("i"); d.id="__잰것"; d.style.display="none";
       try{ d.textContent = ${재는조각}; }catch(e){ d.textContent='{"터짐":"'+e.message+'"}'; }
       document.body.appendChild(d);
     },2500);});</script>\n</body>`), "utf8");
}

const 볼곳 = [
  ["대문", "/"], ["지금", "/now/"], ["글방", "/notes/"],
  ["잠긴 문", "/404.html"], ["서재", "/books/"], ["서재의 없는 문", "/books/404.html"],
];
console.log(`고장난 집을 세웠습니다 — 서재로 가는 길을 끊고 ${볼곳.length}곳을 봅니다\n`);

for (const [이름, 길] of 볼곳) {
  const dom = await 재기(길);
  const m = /<i id="__잰것"[^>]*>([\s\S]*?)<\/i>/.exec(dom);
  if (!m) { 티(이름, "재지 못했습니다 (쪽이 열리지 않았거나 스크립트가 멎었습니다)"); continue; }
  let v;
  try { v = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); }
  catch (e) { 티(이름, `잰 것을 읽지 못했습니다 (${e.message})`); continue; }
  if (v.터짐) { 티(이름, `재다가 멎었습니다 — ${v.터짐}`); continue; }

  console.log(`  ${이름.padEnd(12)} 글자 ${String(v.글자수).padStart(5)}자 · 닿는 것 ${String(v.닿는것).padStart(3)}개`);
  /* 고장난 쪽이 아무 말도 안 하면 그것이 가장 큰 탈이다 */
  if (v.글자수 < 40) 티(이름, `끊긴 채로 아무 말도 하지 않습니다 (글자 ${v.글자수}자)`);
  v.멈춘말.forEach((t) => 티(이름, `끝나지 않는 기다림 — 「${t}」`));
  v.흐린글.forEach((x) => 티(이름, `흐린 글자 ${x.대비} (${x.px}px, .${x.자리}) — 「${x.글}」`));
  if (v.고리없음.length) 티(이름, `포커스 고리가 없는 곳 ${v.고리없음.length}개 — ${[...new Set(v.고리없음)].slice(0, 4).join(", ")}`);
}

서버.close();
if (남길까) console.log(`\n임시 자리를 남겨 둡니다: ${자리}`);
else await rm(자리, { recursive: true, force: true });

console.log(탈 ? `\n어긋난 곳 ${탈}군데` : "\n끊겨도 집은 말을 합니다 — 어긋난 곳 없음");
process.exit(탈 ? 1 : 0);
