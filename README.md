# Signum - Image Decoding Analysis MVP

노드링크 기반 이미지 디코딩 예측 웹서비스의 MVP 버전입니다.

## 🏗️ 아키텍처

이 프로젝트는 monorepo 구조로 구성되어 있습니다:

- **apps/web**: Next.js (App Router) + TypeScript + Tailwind CSS + React Flow
- **apps/api**: Express + TypeScript
- **packages/shared**: 공통 타입 정의

## 🚀 시작하기

### 사전 요구사항

- Node.js 18 이상
- pnpm (설치: `npm install -g pnpm`)

### 설치 및 실행

1. **의존성 설치**
   ```bash
   pnpm install
   ```

2. **환경 변수 설정**

   `apps/api/.env` 파일을 생성하고 다음 내용을 추가하세요:
   ```env
   API_PORT=3001
   API_URL=http://localhost:3001
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   `apps/web/.env.local` 파일을 생성하고 다음 내용을 추가하세요:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **개발 서버 실행**
   ```bash
   pnpm dev
   ```

   이 명령어는 다음을 동시에 실행합니다:
   - 웹 앱: http://localhost:3000
   - API 서버: http://localhost:3001

## 📖 사용 방법

### 기본 워크플로우

1. **노드 생성**
   - 우측 "Quick Access" 패널에서 원하는 노드 타입을 드래그하여 캔버스에 드롭합니다.
   - 제공되는 노드 타입:
     - **Image Upload**: 이미지 업로드 및 미리보기
     - **Decoding Analysis**: 이미지 분석 실행 및 결과 표시

2. **이미지 업로드**
   - Image Upload 노드를 클릭하거나 이미지를 드래그하여 업로드합니다.
   - 업로드가 완료되면 썸네일이 표시됩니다.

3. **노드 연결**
   - Image Upload 노드의 오른쪽 핸들을 Decoding Analysis 노드의 왼쪽 핸들로 드래그하여 연결합니다.

4. **분석 실행**
   - Decoding Analysis 노드에서 다음 정보를 입력합니다:
     - **의도 텍스트**: 이미지가 어떻게 해석될지에 대한 의도
     - **타겟 프리셋**: 분석 대상 (예: 20대 여성, 일반, 디자이너 등)
     - **컨텍스트 프리셋**: 사용 컨텍스트 (예: SNS 썸네일, 에디토리얼, 포스터 등)
   - "Analyze" 버튼을 클릭하여 분석을 실행합니다.

5. **결과 확인**
   - 분석이 완료되면 노드 내부에 다음 섹션들이 표시됩니다:
     - 관찰 사항 (observation)
     - 함의 (connotation)
     - 디코딩 가설 (decoding_hypotheses)
     - 리스크 (risks)
     - 편집 제안 (edit_suggestions)

## 🔧 기술 스택

### 프론트엔드
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- React Flow (노드 기반 UI)

### 백엔드
- Express
- TypeScript
- OpenAI API (GPT-4o 멀티모달)
- Multer (파일 업로드)
- Zod (입력 검증)

### 공통
- pnpm workspace (monorepo)
- 공통 타입 패키지 (`@signum/shared`)

## 📁 프로젝트 구조

```
signum/
├── apps/
│   ├── web/          # Next.js 프론트엔드
│   └── api/          # Express 백엔드
├── packages/
│   └── shared/       # 공통 타입 정의
└── README.md
```

자세한 구조는 `ARCHITECTURE.md`를 참조하세요.

## 🔐 환경 변수

### API 서버 (`apps/api/.env`)
- `API_PORT`: API 서버 포트 (기본값: 3001)
- `API_URL`: API 서버 URL
- `OPENAI_API_KEY`: OpenAI API 키 (필수)

### 웹 앱 (`apps/web/.env.local`)
- `NEXT_PUBLIC_API_URL`: API 서버 URL (기본값: http://localhost:3001)

## 📝 API 엔드포인트

### 이미지 업로드
- **POST** `/api/upload`
- Content-Type: `multipart/form-data`
- Body: `file` (이미지 파일)

### 이미지 조회
- **GET** `/api/images/:imageId`

### 디코딩 분석
- **POST** `/api/analysis`
- Body:
  ```json
  {
    "imageId": "uuid-string",
    "intentText": "의도 텍스트",
    "targetPreset": "20s_female",
    "contextPreset": "SNS_thumbnail"
  }
  ```

자세한 API 스펙은 `ARCHITECTURE.md`를 참조하세요.

## 🎯 주요 기능

- ✅ 드래그 앤 드롭으로 노드 생성
- ✅ 이미지 업로드 및 미리보기
- ✅ 노드 간 연결 (엣지)
- ✅ OpenAI 멀티모달 API를 통한 이미지 분석
- ✅ 분석 결과 구조화된 표시
- ✅ 캔버스 상태 localStorage 자동 저장

## 🐛 문제 해결

### 이미지 업로드 실패
- API 서버가 실행 중인지 확인하세요.
- 파일 크기가 10MB 이하인지 확인하세요.
- 지원되는 이미지 형식: JPEG, PNG, GIF, WebP

### 분석 실패
- OpenAI API 키가 올바르게 설정되었는지 확인하세요.
- Image Upload 노드와 Decoding Analysis 노드가 연결되어 있는지 확인하세요.
- 모든 필수 필드가 입력되었는지 확인하세요.

## 📄 라이선스

이 프로젝트는 MVP 버전입니다.



