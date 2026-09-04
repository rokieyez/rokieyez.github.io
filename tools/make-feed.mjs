/* 집 전체를 구독하는 피드를 짓는다 — /feed.xml
 *
 * 왜 따로 두나:
 *   서재는 자기 피드(/books/feed.xml)를 스스로 짓는다. 그건 책만 다룬다.
 *   집에는 서재 말고도 방이 있고(지금·글), 「rokiz.net 을 구독한다」는
 *   사람에게는 그 전부가 한 줄기로 와야 한다.
 *
 * 무엇을 담나:
 *   ① 서재 피드의 최근 항목 (책이 꽂히고 기록이 지어진 일)
 *   ② now/ 의 지난 갈무리 (now/<연도>-<달>.html)
 *   ③ 글방의 글 (Supabase 의 notes 표 — 발행한 것만 온다)
 *
 * 언제 다시 돌리나:
 *   글을 올리거나 지금을 갈무리한 뒤. 서재 쪽만 바뀌었으면 안 돌려도
 *   서재 피드는 스스로 최신이다 — 다만 집 피드는 그만큼 뒤처진다.
 *
 * 쓰는 법:  node tools/make-feed.mjs
 */
import { writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { 열쇠, 밑동, esc } from "./집.mjs";

const 뿌리 = join(dirname(fileURLToPath(import.meta.url)), "..");
const 집 = "https://www.rokiz.net";


/* ① 서재 — 배포된 피드를 그대로 읽는다. 서재가 「새로 들어온 것」을 정하는
   규칙을 이쪽에 베껴 두지 않으려는 것이다. 못 읽어도 집 피드는 나온다. */
async function 서재() {
  try {
    const r = await fetch(`${집}/books/feed.xml`);
    if (!r.ok) throw new Error(r.status);
    const xml = await r.text();
    const 덩이 = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
    const 뽑기 = (덩, 이름) =>
      (new RegExp(`<${이름}[^>]*>([\\s\\S]*?)</${이름}>`).exec(덩) || [])[1] || "";
    return 덩이.slice(0, 12).map((덩) => ({
      제목: 뽑기(덩, "title").trim(),
      주소: (/<link[^>]+href="([^"]+)"/.exec(덩) || [])[1] || `${집}/books/`,
      때: 뽑기(덩, "updated").trim(),
      글: 뽑기(덩, "summary").trim(),
      갈래: "books",
      키: (/<id>([^<]+)<\/id>/.exec(덩) || [])[1] || "",
    })).filter((x) => x.제목 && x.때);
  } catch (e) {
    console.warn(`  서재 피드를 읽지 못했습니다 (${e.message}) — 서재 항목 없이 짓습니다`);
    return [];
  }
}

/* ② 지난 지금 — now/<연도>-<달>.html 이 곧 갈무리다.
   파일 이름이 그때를 말해 주므로 안을 뒤질 것이 없다. */
async function 지난지금() {
  const 목록 = await readdir(join(뿌리, "now")).catch(() => []);
  return 목록
    .filter((f) => /^\d{4}-\d{2}\.html$/.test(f))
    .map((f) => {
      const [해, 달] = f.replace(".html", "").split("-");
      return {
        제목: `${해}년 ${Number(달)}월의 지금`,
        주소: `${집}/now/${f}`,
        // 그 달의 첫날 자정으로 잡는다 — 갈무리는 한 달을 통째로 가리킨다
        때: new Date(`${해}-${달}-01T00:00:00Z`).toISOString(),
        글: "그때 무엇을 읽고 무엇을 만들고 있었는지.",
        갈래: "now",
        키: `tag:rokiz.net,2026:now/${해}-${달}`,
      };
    });
}

/* ③ 글 — 글방의 표(notes)에서 곧장 읽는다. 초고는 오지 않는다:
   공개 열쇠로 부르므로 RLS 가 발행한 글만 내준다 — 여기서 거를 것이 없다. */
async function 글() {
  const 집서버 = `${밑동}/notes`;
  try {
    const r = await fetch(
      `${집서버}?select=slug,title,body,published_at&order=published_at.desc&limit=20`,
      { headers: { apikey: 열쇠, Authorization: `Bearer ${열쇠}` } });
    if (!r.ok) throw new Error(r.status);
    return (await r.json())
      .filter((n) => n.published_at)
      .map((n) => ({
        제목: n.title,
        // 글마다 제 쪽이 있다 (tools/make-notes-pages.mjs 가 굽는다)
        주소: `${집}/notes/${encodeURIComponent(n.slug)}.html`,
        때: new Date(n.published_at).toISOString(),
        글: String(n.body || "").replace(/\s+/g, " ").slice(0, 300) || "새 글.",
        갈래: "notes",
        키: `tag:rokiz.net,2026:notes/${n.slug}`,
      }));
  } catch (e) {
    console.warn(`  글방을 읽지 못했습니다 (${e.message}) — 글 없이 짓습니다`);
    return [];
  }
}

const 일들 = [...await 서재(), ...await 지난지금(), ...await 글()]
  .sort((a, b) => (a.때 < b.때 ? 1 : -1))
  .slice(0, 30);

const 갱신 = 일들[0]?.때 || new Date().toISOString();
const 피드 = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ko">
  <title>로키즈의 방</title>
  <subtitle>문마다 다른 방이 있습니다 — 집 전체의 소식</subtitle>
  <link href="${집}/feed.xml" rel="self"/>
  <link href="${집}/"/>
  <id>${집}/</id>
  <updated>${갱신}</updated>
  <author><name>로키즈</name></author>
${일들.map((it) => `  <entry>
    <title>${esc(it.제목)}</title>
    <link href="${esc(it.주소)}"/>
    <id>${esc(it.키 || it.주소)}</id>
    <updated>${esc(it.때)}</updated>
    <category term="${esc(it.갈래)}"/>
    <summary>${esc(it.글)}</summary>
  </entry>`).join("\n")}
</feed>
`;
await writeFile(join(뿌리, "feed.xml"), 피드, "utf8");
const 셈 = 일들.reduce((a, x) => ((a[x.갈래] = (a[x.갈래] || 0) + 1), a), {});
console.log(`집 피드에 ${일들.length}개를 담았습니다 → feed.xml`);
console.log(`  서재 ${셈.books || 0} · 지금 ${셈.now || 0} · 글 ${셈.notes || 0}`);
