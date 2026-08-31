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

## 규약

- 빌드 단계 없는 정적 HTML — 배포는 `git push`
- 새 방(섹션)을 열 때는 해당 프로젝트 저장소에 Pages를 켜면 경로가 저절로 생긴다
