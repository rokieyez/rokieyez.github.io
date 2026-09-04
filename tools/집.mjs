/* 도구들이 함께 쓰는 것 — 한 벌만 둔다
 *
 * 왜: HTML 이스케이프(esc)가 여섯 파일에 복붙돼 있었고, 그중 하나
 * (make-notes-cards)는 따옴표를 빠뜨리고 있었다. 공개 열쇠와 REST 주소도
 * 일곱 파일이 각자 들고 있어, 열쇠를 돌리면 열두 곳을 손봐야 했다.
 * 규칙이 두 벌이 되면 반드시 어긋난다 — 여기 한 벌로 모은다.
 *
 * 열쇠는 공개용(sb_publishable_)이다 — RLS 가 지키므로 코드에 두어도 된다
 * (README 「공개 열쇠 — 무엇이고, 갈 때 어디를 함께 가나」). 정적 HTML 넉 장은
 * 여기서 받아 갈 수 없어 각자 든다 — check-house 의 「열쇠」검사가 그 넷과
 * 이 파일이 같은 열쇠인지 견준다.
 *
 * check-house.mjs 만은 여기서 받아 가지 않는다 — 서재 저장소의 워크플로가
 * 그 파일 하나만 curl 로 받아 돌리므로 혼자 서야 한다. */
export const 열쇠 = "sb_publishable_NI4gjQ3YePIO90H7YjHjfA_m_H0udRy";
export const 밑동 = "https://gaeumegwhxxnfvrhbknp.supabase.co/rest/v1";
export const 머리 = { apikey: 열쇠, Authorization: `Bearer ${열쇠}` };

/* 속성값 안에도 넣으므로 따옴표까지 바꾼다 */
export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
