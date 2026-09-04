/* 재는 자를 잰다 — check-house.mjs 의 순수 함수 시험
 *
 * 돌리는 법:  node --test tools/check-house.test.mjs
 * 워크플로(check-house.yml)가 집을 걷기 전에 먼저 돌린다.
 *
 * 무엇을 지키나: 「때말」검사가 한 번 제 주석에 속았다 — 그 사연을 첫 번째
 * 시험으로 박아 둔다. 자가 다시 굽으면 여기서 빨간불이 든다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { 뽑, 남은날, 코드만, 사다리 } from "./check-house.mjs";

const 바른사다리 = `
  function agoOf(iso) {
    const 잰 = new Date(iso), 이제 = new Date();
    const d = Math.round((new Date(이제.getFullYear(), 이제.getMonth(), 이제.getDate())
      - new Date(잰.getFullYear(), 잰.getMonth(), 잰.getDate())) / 86400000);
    if (d === 0) return "오늘";
    if (d === 1) return "어제";
    if (d < 30) return \`\${d}일 전\`;
    if (d < 365) return \`\${Math.min(11, Math.floor(d / 30))}달 전\`;
    return \`\${Math.floor(d / 365)}해 전\`;
  }`;

test("바른 사다리의 서명", () => {
  assert.equal(사다리(바른사다리), "어제·30·365·11·해·주없음·달력");
});

test("주석에 적힌 「2주 전」에 속지 않는다 — 실제로 있었던 일", () => {
  const 글 = `/* 예전엔 「2주 전」이라 말했다 */\n// 3주 전 어쩌고\n<!-- 4주 전 -->\n` + 바른사다리;
  assert.equal(사다리(글), 사다리(바른사다리));
});

test("코드에 「주 전」이 남아 있으면 잡는다", () => {
  const 글 = 바른사다리.replace('if (d < 30)', 'if (d < 7) return `${d}일 전`;\n    if (d < 30) return `${Math.floor(d/7)}주 전`;\n    if (false)');
  assert.match(사다리(글), /주있음/);
});

test("「년 전」과 「해 전」을 가른다", () => {
  assert.match(사다리(바른사다리.replace("해 전", "년 전")), /·년·/);
});

test("스물네 시간으로 나누는 쪽은 「경과」로 읽는다", () => {
  const 경과 = 바른사다리.replace(/const d = [\s\S]*?86400000\);/, "const d = Math.floor((이제 - 잰) / 86400000);");
  assert.match(사다리(경과), /경과$/);
});

test("코드만 — 주소의 // 는 주석이 아니다", () => {
  assert.equal(코드만('const u = "https://a.b/c"; // 설명'), 'const u = "https://a.b/c"; ');
});

test("뽑 — 없으면 빈 문자열", () => {
  assert.equal(뽑("<title>집</title>", /<title>([^<]*)<\/title>/), "집");
  assert.equal(뽑("<p>", /<title>([^<]*)<\/title>/), "");
});

test("남은날 — 내일은 1, 어제는 -1", () => {
  const 하루 = 86400000;
  assert.equal(남은날(new Date(Date.now() + 하루).toISOString()), 1);
  assert.equal(남은날(new Date(Date.now() - 하루).toISOString()), -1);
});
