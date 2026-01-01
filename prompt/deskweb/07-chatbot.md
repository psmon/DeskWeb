이 프로젝트는 윈도우OS 데스크탑 컨셉을 경량화된 웹OS UX 어플리케이션으로 구현한것으로
사용자는 브라우저에서 데스크탑 환경을 경험할 수 있는 목표로 제작되고 있으며

기존 프로젝트를 분석을 먼저진행후,  추가기능을 구현해주세요

# 추가기능
- 챗봇앱(AI ChatBot)이 이미 구현되어 있습니다.
  - prompt/03-chatbot.md 을통해 초기버전이 작성되었으며 참고해 기능추가
  - 기존에는 웹자체 LLM을 이용하며, 첫번째 선택옵션(기본선택됨)은 WebLLM이아닌(다운로드필요없이 바로사용) API 방식을 LLM모델 이용하게 개선
  - 이용할 LLM API 스펙 은 아래에 명시되어있습니다. 그대로 활용하면 됩니다. 다만 콤보박스 모델명은 "openai/gpt-oss-20b" 로 표시해주세요
  - stream 방식을 사용해 답변시 실시간 답변이 표시되도록해주세요 - 기존구현된 코드 참고


# LLM API 스펙
```
## 요청
curl -X 'POST' \
  'https://mcp.webnori.com/api/llm/chat/completions' \
  -H 'accept: text/plain' \
  -H 'Content-Type: application/json' \
  -d '{
  "model": "openai/gpt-oss-20b",
  "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello, how are you?"}
  ],
  "max_tokens": 5000,
  "temperature": 0.7,
  "stream": false
}'

## 응답
{
  "id": "chatcmpl-te3cp0st6jo2qkhmxrpp79",
  "object": "chat.completion",
  "created": 1763373983,
  "model": "openai/gpt-oss-20b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing great—thanks for asking. How can I help you today?"
      },
      "finish_reason": "stop",
      "delta": null
    }
  ],
  "usage": {
    "prompt_tokens": 86,
    "completion_tokens": 30,
    "total_tokens": 116
  }
}
```


# 로컬 테스트
- 구현이 다되며 docker-compose.yml , deskweb-dev 모드로 실행해주세요
  - 실행및 빌드시 발생하는 오류를 모두 해결해주세요
  - 실행이되면 브라우저에서 접속및 정상동작하는지 확인해주세요
  - 실행 확인을 위해 개발모드에서 작동이 잘되는지 확인을 위한 로그를 개발시 꼼꼼히 작성해주세요
  - 코드수정후 반영시 도커재시작없이 docker exec deskweb-dev qx compile 명령을 활용해주세요 - dev모드
- 기본 로컬테스트가 수행되면 직접확인후 피드백 예정으로 추가 수정이 있을수 있습니다. 작동중인 어플리케이션을 유지해주세요

## 기존 프로젝트 분석
- README.md 파일에 이 프로젝트에대한 설명이 있습니다.
- source 경로에 프로젝트가 생성되었으며 qooxdoo 프레임워크를 사용하고 있습니다.


## 추가지침 
- 응답 포맺이 Markdown 형식으로 오도록 LLM API 요청시 system 메시지에 "Respond in Markdown format." 문구를 추가해주세요
- 응답 포맺이 Markdown 형식이므로, 답변을 표시할때 마크다운 렌더러를 사용해 표시해주세요
  - qooxdoo 프레임워크에서 마크다운 렌더러를 사용할수있는 방법을 찾아 적용해주세요
  - 만약 qooxdoo 프레임워크에서 마크다운 렌더러를 사용할수없다면, 외부 라이브러리를 활용해도 무방합니다.
  - 단, 외부 라이브러리를 사용할경우, 해당 라이브러리를 프로젝트에 포함시키는 방법도 함께 제시해주세요
  - Mermaid 다이어그램도 지원되도록 구현해주세요
- mermaid 렌더링이 안되는듯 원인파악후 개선
- AI ChatBot 영역이 마우스로 드래그해서 복사가 될수 있도록 개선 ( 현재 선택및 복사불가)