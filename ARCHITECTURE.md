# Signum MVP 아키텍처 문서

## A) 폴더 구조 트리

```
signum/
├── package.json                    # 루트 워크스페이스 설정
├── pnpm-workspace.yaml            # pnpm 워크스페이스 설정
├── .env.example                   # 환경 변수 예시
├── README.md                      # 프로젝트 설명 및 실행 방법
│
├── apps/
│   ├── web/                       # Next.js 프론트엔드
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   ├── .env.local.example
│   │   ├── public/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx       # 메인 캔버스 페이지
│   │       ├── components/
│   │       │   ├── Canvas/
│   │       │   │   ├── FlowCanvas.tsx
│   │       │   │   └── CustomNodes.tsx
│   │       │   ├── QuickAccess/
│   │       │   │   └── QuickAccessPanel.tsx
│   │       │   └── NodeComponents/
│   │       │       ├── ImageUploadNode.tsx
│   │       │       └── DecodingAnalysisNode.tsx
│   │       ├── hooks/
│   │       │   └── useCanvasState.ts
│   │       └── lib/
│   │           └── storage.ts     # localStorage 유틸
│   │
│   └── api/                       # Express 백엔드
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── src/
│       │   ├── index.ts           # Express 앱 진입점
│       │   ├── routes/
│       │   │   ├── upload.ts      # 이미지 업로드 라우트
│       │   │   └── analysis.ts    # 디코딩 분석 라우트
│       │   ├── controllers/
│       │   │   ├── uploadController.ts
│       │   │   └── analysisController.ts
│       │   ├── services/
│       │   │   ├── storageService.ts    # 파일 저장 서비스
│       │   │   └── openaiService.ts     # OpenAI API 호출
│       │   ├── middleware/
│       │   │   ├── upload.ts      # multer 설정
│       │   │   └── errorHandler.ts
│       │   ├── utils/
│       │   │   ├── validation.ts  # zod 스키마
│       │   │   └── errors.ts      # 에러 응답 유틸
│       │   └── types/
│       │       └── index.ts       # API 전용 타입
│       └── uploads/               # 업로드된 이미지 저장소
│
└── packages/
    └── shared/                    # 공통 타입 패키지
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts           # 공통 타입 export
            ├── nodes.ts           # 노드 타입 정의
            ├── edges.ts           # 엣지 타입 정의
            └── analysis.ts        # 분석 결과 타입 정의
```

## B) 데이터 모델 (최소 스키마)

### Canvas (프로젝트)
```typescript
interface Canvas {
  id: string;                      // 고유 ID (UUID)
  name?: string;                   // 프로젝트 이름 (옵션)
  nodes: Node[];                   // 노드 배열
  edges: Edge[];                   // 엣지 배열
  createdAt: string;               // ISO 8601 날짜
  updatedAt: string;               // ISO 8601 날짜
}
```

### Node
```typescript
interface Node {
  id: string;                      // 고유 ID (UUID)
  type: 'imageUpload' | 'decodingAnalysis';
  position: { x: number; y: number };
  data: NodeData;                  // 노드 타입별 데이터
}

// 노드 타입별 데이터
type NodeData = 
  | ImageUploadNodeData 
  | DecodingAnalysisNodeData;

interface ImageUploadNodeData {
  imageId?: string;                // 업로드된 이미지 ID
  imageUrl?: string;                // 이미지 URL (프리뷰용)
  fileName?: string;                // 원본 파일명
}

interface DecodingAnalysisNodeData {
  intentText?: string;              // 사용자 의도 텍스트
  targetPreset?: string;            // 타겟 프리셋
  contextPreset?: string;           // 컨텍스트 프리셋
  analysisResult?: AnalysisResult;  // 분석 결과 JSON
  status?: 'idle' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;            // 에러 메시지
}
```

### Edge
```typescript
interface Edge {
  id: string;                      // 고유 ID (UUID)
  source: string;                  // 소스 노드 ID
  target: string;                  // 타겟 노드 ID
  sourceHandle?: string;            // 소스 핸들 ID
  targetHandle?: string;            // 타겟 핸들 ID
  type?: string;                   // 엣지 타입 (기본: 'default')
}
```

### ImageAsset (업로드 이미지 메타)
```typescript
interface ImageAsset {
  id: string;                      // 고유 ID (UUID)
  fileName: string;                // 원본 파일명
  filePath: string;                // 서버 내부 파일 경로
  mimeType: string;                // MIME 타입 (image/jpeg, image/png 등)
  size: number;                    // 파일 크기 (bytes)
  uploadedAt: string;              // ISO 8601 날짜
}
```

### AnalysisResult (JSON)
```typescript
interface AnalysisResult {
  observation: AnalysisItem[];      // 관찰 사항
  connotation: AnalysisItem[];     // 함의
  decoding_hypotheses: DecodingHypothesis[];  // 디코딩 가설
  risks: AnalysisItem[];           // 리스크
  edit_suggestions: AnalysisItem[]; // 편집 제안
}

// 분석 항목 (string 또는 객체 형태)
type AnalysisItem = string | {
  title: string;
  detail: string;
};

interface DecodingHypothesis {
  label: string;                   // 가설 라벨
  probability: number;             // 확률 (0~1)
  rationale: string;               // 근거
}
```

## C) API 스펙 (엔드포인트 + req/res 예시 + 에러 규격)

### 1. 이미지 업로드

**POST** `/api/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  ```
  file: File (이미지 파일)
  ```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "imageId": "uuid-string",
    "fileName": "example.jpg",
    "mimeType": "image/jpeg",
    "size": 123456,
    "url": "/api/images/uuid-string"
  }
```

**Error Response (400 Bad Request):**
```json
{
  "error": {
    "code": "INVALID_FILE",
    "message": "이미지 파일만 업로드 가능합니다."
  }
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "error": {
    "code": "UPLOAD_FAILED",
    "message": "파일 업로드 중 오류가 발생했습니다."
  }
}
```

---

### 2. 이미지 조회

**GET** `/api/images/:imageId`

**Response (200 OK):**
- Content-Type: `image/jpeg` (또는 해당 이미지 타입)
- Body: 이미지 바이너리 데이터

**Error Response (404 Not Found):**
```json
{
  "error": {
    "code": "IMAGE_NOT_FOUND",
    "message": "이미지를 찾을 수 없습니다."
  }
}
```

---

### 3. 디코딩 분석 실행

**POST** `/api/analysis`

**Request:**
```json
{
  "imageId": "uuid-string",
  "intentText": "이 이미지가 20대 여성에게 어떻게 해석될지 분석해줘",
  "targetPreset": "20s_female",
  "contextPreset": "SNS_thumbnail"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "analysisId": "uuid-string",
    "result": {
      "observation": [
        "이미지에는 밝은 색상의 배경과 중심 인물이 있습니다.",
        {
          "title": "구도 분석",
          "detail": "삼분할 법칙에 따라 인물이 왼쪽 1/3 지점에 배치되어 있습니다."
        }
      ],
      "connotation": [
        "자유로움과 활력을 상징하는 색상 구성",
        "젊은 세대의 라이프스타일을 반영"
      ],
      "decoding_hypotheses": [
        {
          "label": "브랜드 마케팅 이미지",
          "probability": 0.85,
          "rationale": "명확한 제품 배치와 브랜드 로고의 존재"
        },
        {
          "label": "개인 SNS 콘텐츠",
          "probability": 0.15,
          "rationale": "캐주얼한 구도와 자연스러운 표정"
        }
      ],
      "risks": [
        "특정 연령대에서 부정적 해석 가능성",
        "색상 대비가 강해 눈의 피로를 유발할 수 있음"
      ],
      "edit_suggestions": [
        "배경 밝기 조정으로 인물 강조",
        "텍스트 오버레이 추가 고려"
      ]
    }
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "필수 필드가 누락되었습니다: imageId"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": {
    "code": "IMAGE_NOT_FOUND",
    "message": "분석할 이미지를 찾을 수 없습니다."
  }
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "분석 중 오류가 발생했습니다."
  }
}
```

---

### 에러 응답 규격 (통일)

모든 에러 응답은 다음 형식을 따릅니다:

```typescript
interface ErrorResponse {
  error: {
    code: string;        // 에러 코드 (대문자 스네이크 케이스)
    message: string;     // 사용자 친화적 에러 메시지
  };
}
```

**에러 코드 목록:**
- `VALIDATION_ERROR`: 입력 검증 실패
- `INVALID_FILE`: 잘못된 파일 형식
- `UPLOAD_FAILED`: 파일 업로드 실패
- `IMAGE_NOT_FOUND`: 이미지를 찾을 수 없음
- `ANALYSIS_FAILED`: 분석 실행 실패
- `OPENAI_API_ERROR`: OpenAI API 호출 실패
- `INTERNAL_SERVER_ERROR`: 서버 내부 오류



