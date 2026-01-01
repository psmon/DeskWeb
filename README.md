# DeskWeb Workspace

웹 기반 데스크톱 애플리케이션 프로젝트 모음입니다.

## 프로젝트 구조

```
DeskWeb/
├── deskweb/          # 메인 웹 데스크톱 애플리케이션
├── docs/             # 공용 문서
├── prompt/           # AI 프롬프트 모음
└── refsrc/           # 참조 소스 및 스펙
```

## 프로젝트

| 프로젝트 | 설명 | 문서 |
|---------|------|------|
| [deskweb](./deskweb) | Windows XP 스타일 웹 데스크톱 | [README](./deskweb/README.md) |

## 빠른 시작

각 프로젝트 폴더로 이동하여 빌드 및 실행:

```bash
cd deskweb
npm install
docker-compose --profile dev up -d
```

## 라이선스

MIT License
