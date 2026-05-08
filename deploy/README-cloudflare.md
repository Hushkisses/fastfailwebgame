# Cloudflare Pages 로 정적 배포 (게임 서버는 본인 PC에 유지)

“웹 페이지는 항상 열려 있고, 멀티가 필요할 때만 본인 PC에서 게임 서버를 켠다”는 구조입니다.

```
[ 사용자 브라우저 ]
      ├── HTML/CSS/JS  ←── Cloudflare Pages (정적, 24시간)
      └── WebSocket    ──→ wss://api.paldarmgi.p-e.kr  → 본인 PC (게임 서버 + Caddy)
```

본인 PC가 꺼져 있을 때는 **페이지는 열리고**, **소켓만 실패**해서 닉네임 카드에 “게임 서버에 연결할 수 없습니다” 안내가 뜹니다. Caddy + Node 서버를 켜는 순간부터 멀티가 정상 동작합니다.

---

## 0. 준비

레포 안에 이미 적용된 것:

- `apps/client/public/_redirects` — SPA 라우팅용 (`/*` → `/index.html`)
- 닉네임 카드에 서버 연결 실패 시 친절한 에러 메시지 표시
- `deploy/build-client-prod.ps1` — `VITE_SERVER_URL` 박아 넣고 빌드

API 호스트 DNS와 포트포워딩(80/443), Caddy 셋업은 [`deploy/README.md`](./README.md) 참고. 즉, **WS 도메인(`api.paldarmgi.p-e.kr`)** 은 그대로 사용합니다.

---

## 1. 정적 빌드

프로젝트 루트에서:

```powershell
.\deploy\build-client-prod.ps1 -ApiWssUrl "wss://api.paldarmgi.p-e.kr"
```

→ `apps/client/dist` 가 생성됩니다. 이 폴더를 그대로 Cloudflare Pages 에 올립니다.

---

## 2. 옵션 A — 직접 업로드 (가장 빠름, 깃허브 X)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Upload assets**
2. 프로젝트 이름 정하기 (예: `paldarmgi-game`)
3. **`apps/client/dist` 폴더 통째로 드래그**
4. 잠시 기다리면 `프로젝트명.pages.dev` URL 발급
5. 사람들에게 그 URL을 공유

코드 바뀐 뒤에는

```powershell
.\deploy\build-client-prod.ps1 -ApiWssUrl "wss://api.paldarmgi.p-e.kr"
```

다시 한 뒤, 같은 프로젝트의 **Deployments → Create deployment → Upload** 로 새 `dist` 를 올리면 갱신됩니다.

---

## 2. 옵션 B — 깃허브 자동 배포

이 옵션은 푸시할 때마다 Cloudflare Pages가 자동으로 빌드합니다.

### 한 번만 하는 것

1. GitHub 에 비공개 저장소를 만들고 이 레포를 푸시 (Cursor 의 Source Control 탭에서 가능).
2. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git** → 저장소 선택.
3. 빌드 설정:

| 항목 | 값 |
|------|-----|
| **Production branch** | `main` (또는 본인이 쓰는 브랜치) |
| **Framework preset** | None (또는 Vite) |
| **Build command** | `npm run build:prod` |
| **Build output directory** | `apps/client/dist` |
| **Root directory** | `/` |
| **Environment variables** | `VITE_SERVER_URL` = `wss://api.paldarmgi.p-e.kr` |
| **Node version** | 20 (Settings → Environment variables → `NODE_VERSION=20`) |

> `npm run build:prod` 는 `package.json` 에 정의되어 있고, `--workspace @game/client` 로 클라이언트만 빌드합니다.

### 그 뒤로

- 코드 고침 → `git commit` → `git push` → Cloudflare Pages 가 자동 빌드/배포.

---

## 3. (선택) 본인 도메인 붙이기

Cloudflare Pages 의 **Custom domains** 에서 도메인을 추가하면 발급된 `*.pages.dev` 외에 **본인 도메인**으로도 접속할 수 있습니다.

- 예: `game.paldarmgi.p-e.kr` 를 Cloudflare Pages 에 연결.
- 그러면 기존 `wss://api.paldarmgi.p-e.kr` 는 그대로 본인 PC를 가리키고, 정적 페이지만 Cloudflare 가 담당합니다.

기존 `caddy.env` 의 `GAME_WEB_HOST` 는 **더 이상 필요하지 않습니다.** Caddy 는 이제 `api.paldarmgi.p-e.kr` 만 처리하면 됩니다 (필요 없다면 `Caddyfile` 의 `{$GAME_WEB_HOST}` 블록을 비활성해도 됩니다).

---

## 4. 본인이 멀티 켤 때 (지금까지와 동일)

```powershell
# 터미널 1 — 게임 서버 (Colyseus, :2567)
npm run dev

# 터미널 2 — Caddy (api.paldarmgi.p-e.kr 처리)
.\deploy\run-caddy.ps1
```

Cloudflare Pages 의 URL 로 들어온 사람도 **이 두 개가 떠 있을 때 자동으로 본인 PC 게임 서버에 붙습니다.** 끄면 페이지는 열리지만 “게임 서버에 연결할 수 없습니다” 안내가 뜹니다.

---

## 5. 흔한 문제

- **빌드 실패 (Cloudflare 로그에서)**: Node 버전이 너무 낮을 수 있음. `NODE_VERSION=20` 환경변수 추가.
- **빌드는 됐는데 빈 화면 / 자산 404**: `Build output directory` 가 정확히 `apps/client/dist` 인지 확인.
- **소켓 연결 실패만 계속**: `VITE_SERVER_URL` 환경변수와 `caddy.env` 의 `GAME_API_HOST` 가 **정확히 동일한 wss 호스트** 인지 확인. 변경 후엔 **재빌드 필수**.
- **혼합 콘텐츠 차단**: Pages 는 자동 HTTPS. 게임 서버도 반드시 `wss://` (Caddy 가 이미 인증서 발급 완료).
