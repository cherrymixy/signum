'use client';

import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { QuestionData, CanvasNode } from '@/types';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';

interface Props {
    id: string;
    data: { agentId?: string; title: string; content: QuestionData; status: string };
    selected?: boolean;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    exploring: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '탐색 중' },
    answered: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: '해결됨' },
    deferred: { color: '#888', bg: 'rgba(136,136,136,0.12)', label: '보류' },
};

function assembleContext(nodes: CanvasNode[]): string {
    const parts: string[] = [];
    const intent = nodes.find(n => n.type === 'intentAnalysis')?.data.content;
    if (intent) parts.push(`의도: ${intent.coreMessage} / 감성: ${intent.emotionalTone}`);
    const gap = nodes.find(n => n.type === 'gapAnalysis')?.data.content;
    if (gap) parts.push(`갭 분석: 일치도 ${gap.overallAlignmentScore}% / ${gap.criticalFindings}`);
    const revision = nodes.find(n => n.type === 'revisionProposal')?.data.content;
    if (revision) parts.push(`수정 제안 요약: ${revision.summary}`);
    return parts.join('\n');
}

export default function QuestionNode({ id, data, selected }: Props) {
    const c = data.content;
    const isHuman = !data.agentId || data.agentId === 'human';
    const st = STATUS_STYLES[c.status] || STATUS_STYLES.exploring;
    const updateNodeData = useAgentCanvasStore((s) => s.updateNodeData);
    const nodes = useAgentCanvasStore((s) => s.nodes);

    const [questionText, setQuestionText] = useState(c.question || '');
    const [isAsking, setIsAsking] = useState(false);
    const [error, setError] = useState('');

    const handleAsk = async () => {
        const q = questionText.trim();
        if (!q || isAsking) return;
        setIsAsking(true);
        setError('');
        updateNodeData(id, { content: { ...c, question: q, status: 'exploring' } });

        try {
            const res = await fetch('/api/agents/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, analysisContext: assembleContext(nodes) }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || '오류');
            updateNodeData(id, { content: { ...c, question: q, answer: json.answer, status: 'answered' } });
        } catch (e: any) {
            setError(e.message || '답변 생성 실패');
            updateNodeData(id, { content: { ...c, question: q, status: 'exploring' } });
        } finally {
            setIsAsking(false);
        }
    };

    // Agent-created node: read-only display
    if (!isHuman) {
        return (
            <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] max-w-[280px] ${selected ? 'border-amber-500/50' : 'border-[#2a2a2a]'}`}>
                <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />
                <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                    <span className="text-xs">❓</span>
                    <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex gap-2">
                        <div className="w-[3px] rounded-full bg-amber-500 shrink-0" />
                        <p className="text-[12px] text-amber-200 leading-relaxed font-medium">{c.question}</p>
                    </div>
                    {c.answer && (
                        <div className="bg-[#0a0a0a] rounded-md p-2">
                            <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider mb-0.5">답변</p>
                            <p className="text-[10px] text-[#ccc] leading-relaxed">{c.answer}</p>
                        </div>
                    )}
                </div>
                <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />
            </div>
        );
    }

    // Human-created node: interactive
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[320px] ${selected ? 'border-amber-500/50' : 'border-[#2a2a2a]'}`}>
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />

            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">❓</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">AI에게 질문</span>
                {c.status === 'answered' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: st.color, backgroundColor: st.bg }}>해결됨</span>
                )}
            </div>

            <div className="p-3 space-y-2">
                {/* Question input */}
                {c.status !== 'answered' ? (
                    <textarea
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                        placeholder="분석 결과에 대해 질문하세요..."
                        disabled={isAsking}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-2.5 py-2 text-[11px] text-[#ccc] placeholder-[#444] resize-none focus:outline-none focus:border-amber-500/40 min-h-[60px] disabled:opacity-50"
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="flex gap-2">
                        <div className="w-[3px] rounded-full bg-amber-500 shrink-0" />
                        <p className="text-[11px] text-amber-200 leading-relaxed">{c.question}</p>
                    </div>
                )}

                {/* Answer */}
                {c.answer && (
                    <div className="bg-[#0a0a0a] rounded-md p-2">
                        <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider mb-0.5">AI 답변</p>
                        <p className="text-[10px] text-[#ccc] leading-relaxed">{c.answer}</p>
                    </div>
                )}

                {/* Error */}
                {error && <p className="text-[10px] text-red-400">{error}</p>}

                {/* Button */}
                {c.status !== 'answered' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleAsk(); }}
                        disabled={!questionText.trim() || isAsking}
                        className="w-full py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-[11px] text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        {isAsking ? '답변 생성 중...' : 'AI에게 묻기'}
                    </button>
                )}
                {c.status === 'answered' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setQuestionText('');
                            updateNodeData(id, { content: { question: '', answer: undefined, status: 'exploring' } });
                        }}
                        className="w-full py-1 text-[10px] text-[#444] hover:text-[#666] transition-colors"
                    >
                        새 질문하기
                    </button>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />
        </div>
    );
}
