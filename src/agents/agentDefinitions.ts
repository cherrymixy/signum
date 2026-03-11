import { AgentDefinition } from '@/types';

export const AGENT_DEFINITIONS: AgentDefinition[] = [
    {
        id: 'orchestrator',
        name: 'Orchestrator',
        role: '자율 조율',
        color: '#c084fc',
        icon: '🧠',
        description: '분석 상태를 판단하고 다음 행동을 결정합니다.',
    },
    {
        id: 'intent',
        name: 'Intent Agent',
        role: '의도 구조화',
        color: '#a78bfa',
        icon: '💡',
        description: '창작자의 의도를 핵심 메시지, 감성 톤, 행동 유도로 구조화합니다.',
    },
    {
        id: 'decoder',
        name: 'Decoder Agent',
        role: '해석 가설 생성',
        color: '#38bdf8',
        icon: '👁️',
        description: '타겟 페르소나 관점에서 이미지 해석 가설을 생성합니다.',
    },
    {
        id: 'gap',
        name: 'Gap Analyst',
        role: '차이 분석',
        color: '#fb923c',
        icon: '⚡',
        description: '의도와 해석 사이의 차이를 식별하고 심각도를 평가합니다.',
    },
    {
        id: 'revision',
        name: 'Revision Agent',
        role: '수정안 생성',
        color: '#4ade80',
        icon: '🔧',
        description: 'Gap을 줄이기 위한 구체적인 시각적 수정 방향을 제안합니다.',
    },
    {
        id: 'executor',
        name: 'Executor Agent',
        role: '수정 실행',
        color: '#f472b6',
        icon: '🚀',
        description: '승인된 수정안을 실행하고 결과를 평가합니다.',
    },
];

export function getAgentDef(agentId: string): AgentDefinition {
    return AGENT_DEFINITIONS.find((a) => a.id === agentId) || AGENT_DEFINITIONS[0];
}
