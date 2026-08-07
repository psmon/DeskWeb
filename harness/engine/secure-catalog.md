---
name: secure-catalog
type: engine
triggers:
  - "카탈로그 확보"
  - "bitmidi 확보"
  - "플레이리스트 확보"
  - "확보 보강"
---

# Engine: secure-catalog (플레이리스트 확보)

미디플레이어의 파일-관리 인덱스(`nas-app/frontend/public/bitmidi.json`)를 기반으로
bitmidi.com에서 **신규 곡 메타데이터를 회당 최대 1,000곡 추가 확보**한다.
죽은 링크 검사는 범위 밖 — **확보 우선**.

## 실행

```bash
cd nas-app
node scripts/secure-catalog.mjs [maxNew]   # 기본/최대 1000
```

- **입력**: `frontend/public/bitmidi.json`(기존 확보 인덱스) + `scripts/.secure-catalog.state.json`(페이지 커서).
- **동작**:
  1. 기존 `url` 집합으로 중복 제거, 기존 제목에서 **장르별 키워드 프로파일** 학습.
  2. bitmidi.com `/api/midi/all?page=N`(총 ~113k곡)을 커서부터 순회, 신규 곡만 수집(≤maxNew).
  3. 키워드 프로파일로 장르 분류(불명확 → `기타`), 제목 정리.
  4. `bitmidi.json`에 append(한 줄 1객체, diff 친화적), 커서를 state에 저장.
- **반영**: 미디플레이어(AOT) 재시작 시 `TrackDb.SeedBitmidi`가 파일 서명 변화를 감지해
  `INSERT OR IGNORE`로 **자동 재시드** → 페이징/FTS5 검색에 신규 곡 노출. 수동 마이그레이션 불필요.

## 보강 반복

매 실행이 커서를 전진시키므로 **여러 번 돌리면 상류 카탈로그를 점진 커버**한다.
한 번에 다 확보하지 않는다(장시간 방지) — 보강할 때마다 1,000곡 이내.

## 로그

실행 후 `harness/logs/secure-catalog/{yyyy-MM-dd-HH-mm}-run.md`에 신규 확보 수·장르 분포·다음 커서를 기록.

## 주의

- bitmidi.com은 산발적 502로 스로틀 → 스크립트가 지수 백오프로 재시도, 15s 요청 타임아웃.
- 네트워크 필요. 파일(.mid)은 내려받지 않음 — **메타데이터(URL)만 확보**, 재생은 백엔드 프록시 스트리밍.
