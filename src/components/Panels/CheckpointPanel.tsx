'use client';

import React, { useState } from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';

export default function CheckpointPanel() {
    const pendingCheckpoint = useAgentCanvasStore((s) => s.pendingCheckpoint);
    const checkpoints = useAgentCanvasStore((s) => s.checkpoints);
    const respondToCheckpoint = useAgentCanvasStore((s) => s.respondToCheckpoint);
    const [customInput, setCustomInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    if (!pendingCheckpoint) return null;

    const { checkpointId, question, options, context } = pendingCheckpoint;

    // 전체 체크포인트 중 현재 순서
    const total = checkpoints.length;
    const currentIndex = checkpoints.findIndex((c) => c.checkpointId === checkpointId);
    const label = total > 1 ? `에이전트 확인 요청 ${currentIndex + 1}/${total}` : '에이전트 확인 요청';

    const handleRespond = async (response: string) => {
        if (submitting) return;
        setSubmitting(true);
        setErrorMsg('');
        try {
            await respondToCheckpoint(checkpointId, response);
            // 성공 시 store가 pendingCheckpoint = null로 설정 → 패널 언마운트
        } catch (err: any) {
            setErrorMsg('전송 실패 — 다시 시도해주세요');
            setSubmitting(false);
        }
    };

    const handleCustomSubmit = () => {
        const trimmed = customInput.trim();
        if (trimmed) handleRespond(trimmed);
    };

    return (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-50 pb-6 w-full max-w-[560px] px-4 pointer-events-none">
            <div className="pointer-events-auto bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${submitting ? 'bg-amber-400 animate-ping' : 'bg-violet-400 animate-pulse'}`} />
                        <span className="text-[10px] text-violet-400 uppercase tracking-wider font-medium">{label}</span>
                    </div>
                    <div className="ml-auto">
                        {errorMsg ? (
                            <span className="text-[10px] text-red-400">{errorMsg}</span>
                        ) : submitting ? (
                            <span className="text-[10px] text-amber-400">전송 중...</span>
                        ) : (
                            <div className="flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-[#333] animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1 h-1 rounded-full bg-[#333] animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1 h-1 rounded-full bg-[#333] animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    {/* Question */}
                    <p className="text-[13px] text-[#e5e5e5] leading-relaxed font-medium">{question}</p>

                    {/* Context */}
                    {context && (
                        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2">
                            <p className="text-[9px] text-[#555] uppercase tracking-wider mb-0.5">분석 컨텍스트</p>
                            <p className="text-[11px] text-[#888] leading-relaxed">{context}</p>
                        </div>
                    )}

                    {/* Option buttons */}
                    <div className="flex flex-col gap-1.5">
                        {options.map((option, i) => (
                            <button
                                key={i}
                                onClick={() => handleRespond(option)}
                                disabled={submitting}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-[12px] transition-all ${
                                    submitting
                                        ? 'border-[#1e1e1e] text-[#444] cursor-not-allowed'
                                        : 'border-[#2a2a2a] text-[#ccc] hover:border-violet-500/40 hover:bg-violet-500/5 hover:text-[#e5e5e5] cursor-pointer'
                                }`}
                            >
                                <span className="text-[#555] mr-2 font-mono">{i + 1}.</span>
                                {option}
                            </button>
                        ))}
                    </div>

                    {/* Custom input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                            placeholder="직접 방향을 입력하세요..."
                            disabled={submitting}
                            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder-[#444] focus:outline-none focus:border-violet-500/40 disabled:opacity-50"
                        />
                        <button
                            onClick={handleCustomSubmit}
                            disabled={!customInput.trim() || submitting}
                            className="px-3 py-2 bg-violet-500/10 border border-violet-500/30 rounded-lg text-[11px] text-violet-400 hover:bg-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            전송
                        </button>
                    </div>

                    {/* Skip */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => handleRespond('')}
                            disabled={submitting}
                            className="text-[10px] text-[#444] hover:text-[#666] transition-colors disabled:opacity-50"
                        >
                            건너뛰기 (3분 후 자동 재개)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
