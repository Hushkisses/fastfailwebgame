# 오프라인 시뮬레이터

서버·클라우드플레어 없이 **로컬에서만** 솔로 룰(`LocalRoom`과 동일한 `resolveChoice` / `soloBalance`)로 봇을 돌리고, CSV·JSON·HTML 통계를 만듭니다.

## 준비

저장소 루트에서:

```bash
npm install
```

## 설정 JSON

- `sim-config.example.json`을 복사해 `sim-config.json`을 만들고 수정하거나, 예제 파일을 그대로 둔 채 실행해도 됩니다(기본은 `sim-config.json`이 없으면 예제를 읽습니다).
- 각 **그룹**마다 `count`(인원), `thinkMs`(고민 시간 분포), `hintBaseChance`, `afterHintThinkScale`, `preferSingleStep` 등을 조절합니다.

## 실행

저장소 루트에서:

```bash
npm run sim:offline
```

또는 이 패키지 디렉터리에서:

```bash
npm run sim
```

다른 설정 파일:

```bash
npm run sim:offline -- --config path/to/my-sim-config.json
```

`--config` 경로는 **현재 작업 디렉터리 기준** 상대 경로입니다.

## 출력

`outputDir`은 **설정 JSON 파일이 있는 폴더**를 기준으로 한 상대 경로입니다(기본 예제: `out` → `apps/offline-sim/out/`). 다음 파일이 생성됩니다.

| 파일 | 설명 |
|------|------|
| `results.csv` | 런별 상세 |
| `results.jsonl` | 런별 JSON 한 줄 |
| `summary.json` | 그룹별 요약 |
| `report.html` | 브라우저에서 여는 오프라인 표(정렬 가능) |

`report.html`은 `file://`로 열어도 동작합니다(외부 네트워크 요청 없음).
