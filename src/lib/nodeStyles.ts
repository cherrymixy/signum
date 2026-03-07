/**
 * 노드 타입 기반 스타일 설정
 * node.data.type 또는 node.type에 따라 스타일 자동 적용
 */

export type NodeStyleType = 'image' | 'prompt' | 'decode' | 'generate' | 'meaning';

export interface NodeStyleConfig {
  title: string;
  portColor: string;
  edgeColor: string;
  portLabel?: string;
}

const NODE_STYLE_MAP: Record<string, NodeStyleConfig> = {
  image: {
    title: 'Image',
    portColor: '#4a90e2',
    edgeColor: '#4a90e2',
    portLabel: 'image',
  },
  imageUpload: {
    title: 'Image',
    portColor: '#4a90e2',
    edgeColor: '#4a90e2',
    portLabel: 'image',
  },
  prompt: {
    title: 'Prompt',
    portColor: '#6ba3f0',
    edgeColor: '#6ba3f0',
    portLabel: 'prompt',
  },
  decode: {
    title: 'Decode',
    portColor: '#4a90e2',
    edgeColor: '#4a90e2',
    portLabel: 'decoded',
  },
  decodingAnalysis: {
    title: 'Decode',
    portColor: '#4a90e2',
    edgeColor: '#4a90e2',
    portLabel: 'decoded',
  },
  generate: {
    title: 'Generate',
    portColor: '#8bc34a',
    edgeColor: '#8bc34a',
    portLabel: 'output',
  },
  meaning: {
    title: 'Meaning',
    portColor: '#ff9800',
    edgeColor: '#ff9800',
    portLabel: 'context',
  },
};

/**
 * 노드 타입으로부터 스타일 설정 가져오기
 */
export function getNodeStyle(nodeType: string, dataType?: string): NodeStyleConfig {
  // data.type이 우선, 없으면 node.type 사용
  const typeKey = dataType || nodeType;
  return NODE_STYLE_MAP[typeKey] || {
    title: nodeType,
    portColor: '#4a90e2',
    edgeColor: '#4a90e2',
  };
}

/**
 * 엣지 라벨 및 컬러 결정
 */
export function getEdgeLabel(
  sourceType: string,
  targetType: string,
  sourceDataType?: string,
  targetDataType?: string
): string {
  const sourceStyle = getNodeStyle(sourceType, sourceDataType);
  const targetStyle = getNodeStyle(targetType, targetDataType);
  
  // 포트 라벨이 있으면 사용
  if (sourceStyle.portLabel) {
    return sourceStyle.portLabel;
  }
  
  // 기본 규칙
  if (sourceType === 'imageUpload' && targetType === 'decodingAnalysis') {
    return 'image';
  }
  if (sourceType === 'decodingAnalysis') {
    return 'decoded context';
  }
  
  return '';
}

export function getEdgeColor(
  sourceType: string,
  targetType: string,
  sourceDataType?: string,
  targetDataType?: string
): string {
  const sourceStyle = getNodeStyle(sourceType, sourceDataType);
  return sourceStyle.edgeColor;
}

