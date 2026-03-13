'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { EncodingSuggestions } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: EncodingSuggestions & { proposalId: string }; streamingText?: string; status: string };
    selected?: boolean;
}

const PRIORITY_DOT: Record<string, { color: string; glow: string }> = {
    high: { color: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
    medium: { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
    low: { color: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
};

// 기대 효과에서 임팩트 레벨을 추정 (키워드 기반)
function estimateImpact(text: string): number {
    const high = ['크게', '대폭', '핵심', '극적', '필수', '높은'];
    const low = ['미세', '약간', '소폭', '부분적'];
    const t = text.toLowerCase();
    if (high.some(k => t.includes(k))) return 90;
    if (low.some(k => t.includes(k))) return 35;
    return 60;
}

export default function RevisionProposalNode({ data, selected }: Props) {
    const isStreaming = data.status === 'streaming' || !data.content;

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[340px] ${selected ? 'border-green-500/50' : 'border-[#2a2a2a]'
            } ${data.status === 'creating' ? 'border-green-500/30 shadow-lg shadow-green-500/10' : ''}`} data-agent="revision">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-green-400 !border-green-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">🔧</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                {isStreaming && (
                    <span className="text-[9px] text-green-400 animate-pulse">분석 중</span>
                )}
                {data.status === 'creating' && (
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 rounded animate-pulse">승인 대기</span>
                )}
            </div>

            {isStreaming ? (
                <div className="p-3 space-y-2.5">
                    <div className="h-3 bg-[#1e1e1e] rounded animate-pulse" style={{ width: '80%' }} />
                    <div className="h-20 bg-[#0a0a0a] rounded-md animate-pulse" />
                    <div className="h-20 bg-[#0a0a0a] rounded-md animate-pulse" />
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                        <span className="text-[9px] text-[#555]">
                            수정 제안 생성 중{data.streamingText ? ` · ${data.streamingText.length}자` : ''}
                        </span>
                    </div>
                </div>
            ) : (
            <div className="p-3 space-y-2.5">{(() => { const s = data.content; return (<>
                {/* 요약 */}
                <p className="text-[11px] text-[#ccc] leading-relaxed">{s.summary}</p>

                {/* 제안 카드들 */}
                {s.suggestions.map((item, i) => {
                    const p = PRIORITY_DOT[item.priority] || PRIORITY_DOT.medium;
                    const impact = estimateImpact(item.expectedImpact);

                    return (
                        <div key={i} className="bg-[#0a0a0a] rounded-md p-2.5 space-y-2">
                            {/* 영역 + 우선순위 dot */}
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.glow}` }}
                                />
                                <span className="text-[11px] text-green-300 font-medium flex-1">{item.area}</span>
                                <span className="text-[8px] text-[#555] uppercase">{item.priority}</span>
                            </div>

                            {/* 제안 내용 */}
                            <p className="text-[10px] text-[#bbb] leading-relaxed">{item.suggestion}</p>

                            {/* 기대 효과 임팩트 바 */}
                            <div>
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[8px] text-[#555] uppercase tracking-wider">기대 효과</span>
                                    <span className="text-[9px] text-[#777]">{item.expectedImpact}</span>
                                </div>
                                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full viz-bar-fill"
                                        style={{
                                            width: `${impact}%`,
                                            background: `linear-gradient(90deg, #22c55e, #4ade80)`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Trade-off */}
                            <div className="flex items-start gap-1">
                                <span className="text-[9px] text-[#444] shrink-0 mt-px">⚖️</span>
                                <span className="text-[9px] text-[#666] leading-relaxed">{item.tradeoff}</span>
                            </div>
                        </div>
                    );
                })}
                </>); })()}
            </div>
            )}

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-green-400 !border-green-600" />
        </div>
    );
}
