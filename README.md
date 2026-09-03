# rokiz.net 루트 사이트

`www.rokiz.net`의 대문. GitHub Pages 사용자 사이트(`rokieyez.github.io`)라서
이 계정의 다른 프로젝트 사이트들이 자동으로 같은 도메인의 경로가 된다.

- `/` — 이 저장소 (대문)
- `/books` — [서가 뒤의 방](https://github.com/rokieyez/books) (개인 서재)

## 도메인

- 등록처: 닷네임 (dotname.co.kr)
- `www` → CNAME `rokieyez.github.io`
- 루트(`rokiz.net`) → GitHub Pages A 레코드 4개 (185.199.108–111.153)
- 커스텀 도메인 지정은 저장소의 `CNAME` 파일이 담당한다 — 지우지 말 것

## 로봇이 보는 것

- `robots.txt` 는 **오리진 루트에서만 읽힌다** — `/books/robots.txt` 는 아무도 안 본다.
  그래서 도메인을 가진 이 저장소가 온 집안의 로봇 규칙을 맡는다.
- 지도는 방마다 하나씩이고 `robots.txt` 가 둘을 나란히 가리킨다:
  - `/sitemap.xml` — 이 저장소의 쪽 (지금은 대문 하나)
  - `/books/sitemap.xml` — 서재가 `node tools/make-book-pages.mjs` 로 스스로 짓는다 (책 544권)
- **방을 새로 열면 `/sitemap.xml` 에 한 줄 더한다.** 그 방이 스스로 지도를 지으면
  `robots.txt` 에 `Sitemap:` 줄을 하나 더 얹는 쪽이 낫다.
- `og.png` (1200×630) 는 링크를 나눌 때 보이는 얼굴이다. 없으면 카톡·슬랙이
  회색 상자를 띄운다. 대문 디자인이 바뀌면 이것도 다시 그릴 것.
- `404.html` 에는 `noindex` 를 둔다 — 「잠긴 문」이 검색 결과에 뜨면 안 된다.

## 규약

- 빌드 단계 없는 정적 HTML — 배포는 `git push`
- 새 방(섹션)을 열 때는 해당 프로젝트 저장소에 Pages를 켜면 경로가 저절로 생긴다
- **`footer` 를 `position: fixed` 로 바닥에 붙이지 말 것.** 화면이 낮으면
  (폰을 눕히면 360px) 본문 위에 겹쳐 앉는다 — 실제로 그랬다 (2026-09-03).
  `body` 를 `grid-template-rows: 1fr auto` 로 두어 흐름 안에서 비켜나게 한다.
