# DeskWeb 빌드 가이드

이 문서는 DeskWeb 애플리케이션을 로컬 환경과 Docker 환경에서 빌드하고 실행하는 방법을 설명합니다.

## 목차

- [로컬 환경 빌드](#로컬-환경-빌드)
- [Docker 환경 빌드](#docker-환경-빌드)
- [Docker Compose 사용](#docker-compose-사용)
- [배포 가이드](#배포-가이드)

---

## 로컬 환경 빌드

### 필수 요구사항

- Node.js v14 이상
- npm 또는 yarn

### 1. 개발 환경 설정

```bash
# qooxdoo 컴파일러 전역 설치
npm install -g @qooxdoo/compiler

# 프로젝트 디렉토리로 이동
cd /mnt/d/Code/Webnori/DeskWeb

# 의존성 설치 (필요한 경우)
npm install
```

### 2. 개발 모드 실행

```bash
# 소스 모드로 컴파일
qx compile

# 개발 서버 시작
qx serve --listen-port=8080

# 브라우저에서 접속
# http://localhost:8080/deskweb/
```

### 3. 프로덕션 빌드

```bash
# 프로덕션 빌드 생성
qx compile --target=build

# 빌드 결과물 위치
# compiled/build/
```

### 4. 캐시 정리

```bash
# 컴파일 캐시 삭제
qx clean

# 재컴파일
qx compile
```

---

## Docker 환경 빌드

Docker를 사용하면 일관된 환경에서 애플리케이션을 빌드하고 실행할 수 있습니다.

### 필수 요구사항

- Docker Engine 20.10 이상
- Docker Compose v2.0 이상 (선택사항)

### Docker 이미지 종류

프로젝트는 두 가지 Dockerfile을 제공합니다:

1. **Dockerfile** - 프로덕션 빌드용 (multi-stage build)
2. **Dockerfile.dev** - 개발 환경용 (hot-reload)

---

### 프로덕션 환경 (Dockerfile)

#### 1. 이미지 빌드

```bash
# 프로덕션 이미지 빌드
docker build -t deskweb:latest .

# 특정 태그로 빌드
docker build -t deskweb:1.0.0 .

# 빌드 로그 확인
docker build -t deskweb:latest . --progress=plain
```

#### 1-1 이미지 PUSH

```
docker push psmon/webos:tagname

docker tag deskweb:latest psmon/webos:latest
docker push psmon/webos:latest

```


#### 2. 컨테이너 실행

```bash
# 기본 실행 (포트 80)
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  deskweb:latest

# 다른 포트로 실행
docker run -d \
  --name deskweb-prod \
  -p 8080:80 \
  deskweb:latest

# 재시작 정책 적용
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  --restart unless-stopped \
  deskweb:latest
```

#### 3. 접속 확인

```bash
# 로컬 접속
curl http://localhost/deskweb/

# 헬스체크
curl http://localhost/health

# 브라우저 접속
# http://localhost/deskweb/
```

#### 4. 컨테이너 관리

```bash
# 로그 확인
docker logs deskweb-prod

# 실시간 로그
docker logs -f deskweb-prod

# 컨테이너 상태 확인
docker ps | grep deskweb

# 컨테이너 중지
docker stop deskweb-prod

# 컨테이너 시작
docker start deskweb-prod

# 컨테이너 재시작
docker restart deskweb-prod

# 컨테이너 삭제
docker rm -f deskweb-prod
```

#### 5. 이미지 관리

```bash
# 이미지 목록 확인
docker images | grep deskweb

# 이미지 삭제
docker rmi deskweb:latest

# 사용하지 않는 이미지 정리
docker image prune -f

# 모든 빌드 캐시 정리
docker builder prune -f
```

---

### 개발 환경 (Dockerfile.dev)

#### 1. 개발 이미지 빌드

```bash
# 개발 이미지 빌드
docker build -f Dockerfile.dev -t deskweb:dev .
```

#### 2. 개발 컨테이너 실행

```bash
# 소스 코드 마운트하여 실행
docker run -d \
  --name deskweb-dev \
  -p 8080:8080 \
  -v $(pwd)/source:/app/source:ro \
  -v $(pwd)/compile.json:/app/compile.json:ro \
  -v $(pwd)/Manifest.json:/app/Manifest.json:ro \
  deskweb:dev

# 브라우저 접속
# http://localhost:8080/deskweb/
```

#### 3. 실시간 개발

```bash
# 컨테이너 내부에서 명령 실행
docker exec -it deskweb-dev sh

# 컨테이너 안에서 재컴파일
docker exec deskweb-dev qx compile

# 로그 확인
docker logs -f deskweb-dev
```

---

## Docker Compose 사용

Docker Compose를 사용하면 더 간편하게 애플리케이션을 관리할 수 있습니다.

### 1. 프로덕션 모드 실행

```bash
# 프로덕션 서비스 시작
docker-compose up -d

# 빌드 후 시작
docker-compose up -d --build

# 로그 확인
docker-compose logs -f deskweb-prod

# 접속: http://localhost/deskweb/
```

### 2. 개발 모드 실행

```bash
# 개발 프로파일로 시작
docker-compose --profile dev up -d

# 빌드 후 시작
docker-compose --profile dev up -d --build

# 로그 확인
docker-compose logs -f deskweb-dev

# 접속: http://localhost:8080/deskweb/
```

### 3. 두 모드 동시 실행

```bash
# 프로덕션 + 개발 동시 실행
docker-compose --profile dev up -d

# 프로덕션: http://localhost/deskweb/
# 개발: http://localhost:8080/deskweb/
```

### 4. 서비스 관리

```bash
# 모든 서비스 중지
docker-compose down

# 볼륨까지 삭제
docker-compose down -v

# 특정 서비스만 재시작
docker-compose restart deskweb-prod

# 서비스 상태 확인
docker-compose ps

# 리소스 사용량 확인
docker-compose stats
```

### 5. 스케일링

```bash
# 여러 인스턴스 실행 (프로덕션)
docker-compose up -d --scale deskweb-prod=3

# 로드 밸런서와 함께 사용 권장
```

---

## 배포 가이드

### 1. 프로덕션 빌드 최적화

#### Dockerfile 최적화 팁

```dockerfile
# Multi-stage build 활용
# - 빌드 단계: 전체 Node.js 이미지
# - 실행 단계: 경량 nginx 이미지
# 결과: 이미지 크기 최소화
```

#### 이미지 크기 확인

```bash
# 이미지 크기 확인
docker images deskweb:latest

# 상세 정보 확인
docker inspect deskweb:latest | grep Size
```

### 2. Docker Hub에 푸시

```bash
# Docker Hub 로그인
docker login

# 태그 생성
docker tag deskweb:latest username/deskweb:latest
docker tag deskweb:latest username/deskweb:1.0.0

# 푸시
docker push username/deskweb:latest
docker push username/deskweb:1.0.0
```

### 3. 프라이빗 레지스트리 사용

```bash
# 프라이빗 레지스트리 태그
docker tag deskweb:latest registry.example.com/deskweb:latest

# 푸시
docker push registry.example.com/deskweb:latest

# 풀
docker pull registry.example.com/deskweb:latest
```

### 4. 환경별 배포

#### 개발 환경

```bash
docker-compose -f docker-compose.yml --profile dev up -d
```

#### 스테이징 환경

```bash
docker-compose -f docker-compose.staging.yml up -d
```

#### 프로덕션 환경

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 고급 사용법

### 1. 빌드 인자 사용

```bash
# 빌드 시 인자 전달
docker build \
  --build-arg NODE_VERSION=18 \
  -t deskweb:latest .
```

### 2. 네트워크 설정

```bash
# 커스텀 네트워크 생성
docker network create deskweb-network

# 네트워크에 연결하여 실행
docker run -d \
  --name deskweb-prod \
  --network deskweb-network \
  -p 80:80 \
  deskweb:latest
```

### 3. 볼륨 마운트

```bash
# 로그 디렉토리 마운트
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  -v $(pwd)/logs:/var/log/nginx \
  deskweb:latest
```

### 4. 환경 변수 설정

```bash
# 환경 변수 파일 사용
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  --env-file .env \
  deskweb:latest
```

### 5. 리소스 제한

```bash
# CPU 및 메모리 제한
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  --memory="512m" \
  --cpus="1.0" \
  deskweb:latest
```

---

## 문제 해결

### 1. 빌드 실패

```bash
# 캐시 없이 빌드
docker build --no-cache -t deskweb:latest .

# 특정 단계까지만 빌드
docker build --target builder -t deskweb:builder .
```

### 2. 컨테이너 디버깅

```bash
# 컨테이너 내부 접속
docker exec -it deskweb-prod sh

# 파일 시스템 확인
docker exec deskweb-prod ls -la /usr/share/nginx/html

# nginx 설정 확인
docker exec deskweb-prod cat /etc/nginx/conf.d/default.conf

# nginx 설정 테스트
docker exec deskweb-prod nginx -t

# nginx 재시작
docker exec deskweb-prod nginx -s reload
```

### 3. 로그 분석

```bash
# 에러 로그만 확인
docker logs deskweb-prod 2>&1 | grep -i error

# 최근 100줄만 확인
docker logs --tail 100 deskweb-prod

# 타임스탬프 포함
docker logs -t deskweb-prod
```

### 4. 포트 충돌 해결

```bash
# 사용 중인 포트 확인
netstat -tuln | grep 80
lsof -i :80

# 다른 포트 사용
docker run -d \
  --name deskweb-prod \
  -p 8080:80 \
  deskweb:latest
```

### 5. 이미지 레이어 분석

```bash
# 이미지 히스토리 확인
docker history deskweb:latest

# 상세 레이어 정보
docker inspect deskweb:latest
```

---

## 성능 최적화

### 1. 빌드 속도 향상

```bash
# BuildKit 사용
DOCKER_BUILDKIT=1 docker build -t deskweb:latest .

# 병렬 빌드
docker build --parallel -t deskweb:latest .
```

### 2. 이미지 크기 최적화

```bash
# alpine 베이스 이미지 사용 (이미 적용됨)
# multi-stage build 사용 (이미 적용됨)

# 불필요한 파일 제거
# .dockerignore 파일 활용 (이미 적용됨)
```

### 3. 런타임 성능

```bash
# nginx worker 프로세스 설정
# nginx.conf에서 worker_processes 조정

# gzip 압축 활성화 (이미 적용됨)
```

---

## CI/CD 통합

### GitHub Actions 예시

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t deskweb:latest .

      - name: Push to Docker Hub
        run: |
          docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }}
          docker push deskweb:latest
```

### GitLab CI 예시

```yaml
build:
  stage: build
  script:
    - docker build -t deskweb:latest .
    - docker push deskweb:latest
```

---

## 보안 고려사항

### 1. 이미지 스캔

```bash
# Trivy로 취약점 스캔
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image deskweb:latest
```

### 2. 비 root 사용자

nginx alpine 이미지는 기본적으로 nginx 사용자로 실행됩니다.

### 3. 읽기 전용 파일 시스템

```bash
# 읽기 전용으로 실행
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  --read-only \
  --tmpfs /var/cache/nginx \
  --tmpfs /var/run \
  deskweb:latest
```

---

## 모니터링

### 1. 컨테이너 상태 모니터링

```bash
# 리소스 사용량 실시간 확인
docker stats deskweb-prod

# 헬스체크 상태
docker inspect --format='{{.State.Health.Status}}' deskweb-prod
```

### 2. 로그 수집

```bash
# JSON 로그 드라이버 사용
docker run -d \
  --name deskweb-prod \
  -p 80:80 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  deskweb:latest
```

---

## 참고 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [nginx 공식 문서](https://nginx.org/en/docs/)
- [qooxdoo 문서](https://qooxdoo.org/documentation/)

---

## 라이선스

MIT License
