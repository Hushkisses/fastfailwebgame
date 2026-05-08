# 홈서버 배포 (윈도우 + Caddy)

포트포워딩(80, 443 → 이 PC)과 도메인 DNS(A 레코드 → 공인 IP)는 이미 했다고 가정합니다.

> 컨펌·시연용으로 “**페이지는 24시간 열려 있고, 멀티는 본인 PC가 켜져 있을 때만**” 가는 구조를 원하면 [`deploy/README-cloudflare.md`](./README-cloudflare.md) 를 보세요. (정적 = Cloudflare Pages, 게임 서버 = 본인 PC)

## 1. API/Web 도메인 나누기

- **웹** 예: `game.내도메인.com` → 정적 파일(Vite `dist`)
- **API** 예: `api.내도메인.com` → 이 PC의 Node 게임 서버 `localhost:2567`

DNS에서 둘 다 **같은 공인 IP**로 A 레코드를 추가합니다.

### 도메인 패널에서 꼭 확인할 것 (`p-e.kr` 예)

- **`www`만** 등록해 두면 `www.paldarmgi.p-e.kr` 만 열립니다.
- Caddy는 **`game`** / **`api`** 처럼 **웹·API용 호스트 각각** DNS A 레코드가 있어야 합니다. 레지스트라에서 다음을 **같은 IP**(집 공인 IP)로 추가하세요.
  - 호스트 이름 **`game`** → `game.paldarmgi.p-e.kr`
  - 호스트 이름 **`api`** → `api.paldarmgi.p-e.kr`
- `game.www....` 처럼 **패널에 없는 이름**으로 브라우저에 치면 `DNS_PROBE_FINISHED_NXDOMAIN` 이 납니다. `caddy.env`의 `GAME_*_HOST` 와 DNS 이름을 **완전히 동일**하게 맞춥니다.

## 2. 클라이언트 프로덕션 빌드

프로젝트 **루트**에서 PowerShell:

```powershell
.\deploy\build-client-prod.ps1 -ApiWssUrl "wss://api.내도메인.com"
```

(`api.` 부분은 위에서 정한 API 호스트와 동일해야 합니다.)

## 3. Caddy 설정

`deploy/caddy.env` 파일에서 다음만 맞추면 됩니다 (없으면 `caddy.env.example` 을 복사).

- `GAME_WEB_HOST` — 브라우저로 열 주소 (예: `game.내도메인.com`)
- `GAME_API_HOST` — 소켓 전용 (예: `api.내도메인.com`)
- `GAME_DIST_ROOT` — **`apps/client/dist` 전체 경로** (이 레포는 한글 경로일 수 있음; 슬래시 `C:/...` 권장)

로컬에 `caddy.env` 초안이 있을 수 있으며, **`game.여기에도메인.com` 같은 문구를 실제 도메인으로 바꿔야** 합니다.

## 4. 게임 서버 실행

별도 터미널에서 프로젝트 루트:

```powershell
npm run dev
```

(또는 `apps/server` 빌드 후 `npm start`. 포트는 기본 **2567**.)

## 5. Caddy 실행

**관리자 권한** PowerShell에서 (443 바인딩 때문일 수 있음):

```powershell
cd 프로젝트경로
.\deploy\run-caddy.ps1
```

브라우저에서 `https://GAME_WEB_HOST` 로 접속합니다.

## 지금 이 레포를 쓸 때 당신이 할 일 (체크리스트)

1. **DNS** — 도메인 관리 사이트에서 `game` · `api` A 레코드를 **집 공인 IP**로 추가 (위 절 참고). 저장 후 `Resolve-DnsName game.paldarmgi.p-e.kr` 등으로 IP가 나오는지 확인.
2. **클라 재빌드** — 호스트를 바꿨으면 꼭 다시 빌드합니다.  
   `.\deploy\build-client-prod.ps1 -ApiWssUrl "wss://api.paldarmgi.p-e.kr"` (`GAME_API_HOST` 와 동일한 호스트.)
3. **`deploy/caddy.env`** — `GAME_WEB_HOST` / `GAME_API_HOST` / `GAME_DIST_ROOT` 가 실제 도메인·dist 경로와 일치하는지 확인 (이미 레포에 예시가 있으면 그대로 두거나 본인 이름으로 수정).
4. **게임 서버** — 프로젝트 루트에서 `npm run dev` (또는 배포용 `npm start`)로 **2567** 포트가 떠 있어야 합니다.
5. **Caddy** — 관리자 PowerShell에서 프로젝트 루트로 이동 후 `.\deploy\run-caddy.ps1`
6. 브라우저에서 **`https://` + `GAME_WEB_HOST`** 로 접속합니다.

## 문제 해결

- **인증서 오류**: 80/443 이 밖에서 이 PC까지 오는지, 방화벽, 다른 프로그램의 80 점유 확인.
- **게임 접속 안 됨**: 빌드 시 `-ApiWssUrl` 이 `wss://` + `GAME_API_HOST` 와 정확히 같은 호스트인지 확인.
- **`DNS_PROBE_FINISHED_NXDOMAIN`**: 해당 호스트에 대한 A 레코드가 없습니다. 브라우저 주소줄의 도메인과 DNS 패널의 호스트 이름을 맞추세요.
