---
date: 2026-08-07
agent: secure-catalog
type: review
mode: log-eval
trigger: "플레이리스트 확보"
---

# secure-catalog 첫 보강 (bitmidi 메타 확보)

## 실행 요약
새 엔진 `secure-catalog`(`nas-app/scripts/secure-catalog.mjs`)를 추가하고 첫 보강 2회 실행.
기존 인덱스(`bitmidi.json`) 기반으로 bitmidi.com `/api/midi/all`에서 신규 곡 메타를 확보.

- 1차: `node scripts/secure-catalog.mjs 10` → 신규 10곡 (1839 → 1849)
- 2차: `node scripts/secure-catalog.mjs 400` → 신규 400곡 (1849 → 2249)

## 결과
- 확보 총계: **2,249곡** (중복 URL 0, 커서 page 41).
- 장르 분포: 게임354·팝록413·영화339·애니328·캐럴202·인기165·클래식165·재즈147·**기타136**.
- 반영 경로: `bitmidi.json`(파일 관리 인덱스) → 미디플레이어 재시작 시 `TrackDb.SeedBitmidi`가
  파일 서명 변화 감지 → `INSERT OR IGNORE` 자동 재시드. 수동 마이그레이션 불필요.
- 특성: 파일(.mid) 미다운로드, 메타(URL)만 확보. 재생은 백엔드 프록시 스트리밍.

## 평가
- **코드 안전성**: bitmidi 호스트 화이트리스트 유지, URL 중복 제거, 요청 15s 타임아웃 + 지수 백오프(502 스로틀 대응). 양호.
- **아키텍처 정합성**: 회당 ≤1,000곡 커서 방식으로 장시간 방지, DB 재시드 멱등. 요구사항 부합.
- **테스트 가능성**: 커서/장르분류 heuristic — 분류 정확도는 근사(기타 버킷 fallback). 개선 여지: 장르 키워드 프로파일 정교화.

## 다음 단계 제안
- 죽은 링크 검사(별도 pass, 확보 이후) — 사용자 요청상 후순위.
- 장르 분류 정확도 향상(현재 기타 6%) — 상류 태그/조회수 신호 활용 검토.
- 반복 보강으로 상류 ~113k곡 점진 커버.
