/* 검색엔진에 「여기가 바뀌었다」고 알린다 — IndexNow
 *
 * 무엇인가:
 *   빙·Yandex·Seznam 이 함께 쓰는 규약. 지도를 기다리는 대신 바뀐 주소를
 *   곧바로 알려 준다. **구글과 네이버는 이 규약을 쓰지 않는다** — 그쪽은
 *   각자의 웹마스터 도구(Search Console · 서치어드바이저)에 지도를
 *   제출해야 하고, 그건 사람이 로그인해서 해야 하는 일이다.
 *
 * 열쇠:
 *   /9ea4480d4cbad8983eaf5ad7e326b82c.txt 가 그 열쇠다. 이 파일이 사이트에 있어야
 *   「이 주소들의 주인이 맞다」고 인정받는다. 지우지 말 것.
 *
 * 쓰는 법:
 *   node tools/indexnow.mjs            지도에 적힌 주소를 전부 알린다
 *   node tools/indexnow.mjs --dry      보내지 않고 무엇을 보낼지만 보여준다
 *
 * 자주 부를 것 없다 — 쪽을 새로 열거나 크게 고친 뒤 한 번이면 된다.
 */
const 열쇠 = "9ea4480d4cbad8983eaf5ad7e326b82c";
const 집 = "www.rokiz.net";
const 마른연습 = process.argv.includes("--dry");

/* 두 지도를 다 읽는다 — 대문 것과 서재 것 */
async function 주소들() {
  const out = [];
  for (const 지도 of [`https://${집}/sitemap.xml`, `https://${집}/books/sitemap.xml`]) {
    const r = await fetch(지도);
    if (!r.ok) { console.warn(`  ${지도} 를 읽지 못했습니다 (${r.status})`); continue; }
    const xml = await r.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    console.log(`  ${지도} → ${locs.length}개`);
    out.push(...locs);
  }
  return [...new Set(out)];
}

const urls = await 주소들();
if (!urls.length) { console.error("알릴 주소가 없습니다"); process.exit(1); }
console.log(`\n모두 ${urls.length}개 주소`);

if (마른연습) {
  console.log("(마른 연습 — 보내지 않았습니다)");
  console.log(urls.slice(0, 5).map((u) => "  " + decodeURIComponent(u)).join("\n"));
  process.exit(0);
}

/* 한 번에 1만 개까지 받는다 — 우리 규모에서는 한 번이면 끝난다 */
const r = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: 집,
    key: 열쇠,
    keyLocation: `https://${집}/${열쇠}.txt`,
    urlList: urls,
  }),
});
console.log(`\n${r.status} ${r.statusText}`);
console.log(r.status === 200 || r.status === 202
  ? "받아들여졌습니다 — 색인은 저쪽 사정에 달렸습니다"
  : await r.text());
