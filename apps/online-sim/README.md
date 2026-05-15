# 온라인 시뮬레이터 (`@game/online-sim`)

## 사전 준비

- **실행 중인 게임 서버**가 필요합니다. 저장소 루트에서 `npm run dev`로 서버(및 필요 시 클라이언트)를 띄운 뒤 시뮬레이터를 실행하세요.
- `online-sim-config.example.json`을 복사해 `online-sim-config.json`을 만든 뒤, `url`·봇 그룹 등을 환경에 맞게 수정하세요.

## 관리자 비밀번호

- `adminPassword`를 비우면 라운드는 **관리자 UI에서 직접** 시작·종료해야 합니다.
- 자동으로 라운드를 시작·종료하려면 `adminPassword`에 값을 넣으세요. 서버의 `config/admin-config.json`에 정의된 관리자 비밀번호와 동일하게 맞추면 됩니다.
- 이 경우 `roundDurationMs`는 **실시간 기준**으로 `adminStart` 직후부터 **이만큼(ms) 지난 뒤 `adminEnd`**가 호출됩니다. 예제 기본값은 **3분(180000)** 입니다.

## 기회주의(opportunistic) 전략 요약

- **입장 순서**를 줄의 앞뒤로 봅니다. **같은 층**에서 바로 앞 슬롯(먼저 입장한 사람 중 같은 층에 있는 **가장 가까운 한 명**)이 아직 이번 칸에서 움직이기 전이면 **대기**합니다.
- 그 사람의 **`resolution` 결과**가 반영되면: **한 칸 성공**이면 `ledger`에 쌓인 안전한 쪽을 따라가고, **실패(트레일)**면 알려진 불안전한 쪽의 **반대**로 갑니다. (`ObservationLedger` + `syncFromRoom`)
- 같은 층에서 앞선 플레이어가 없을 때도 가끔은 정보 없이 움직여야 하므로, **`firstMoveEpsilon`** 확률로 아주 드물게 “맹선(무작위 선행)”을 허용합니다.

## 실행

저장소 루트에서:

```bash
npm run sim:online
```

또는 이 패키지 디렉터리에서 `npm run sim`을 사용할 수 있습니다.
