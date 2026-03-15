'use client';

import React, { useState } from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { useContinuationStream } from '@/hooks/useContinuationStream';
import { IntentAnalysis, GapAnalysis, VisualScanResult, EncodingSuggestions, CanvasNode } from '@/types';

function extractContextFromNodes(nodes: CanvasNode[]) {
    const intentNode = nodes.find(n => n.type === 'intentAnalysis');
    const gapNode = nodes.find(n => n.type === 'gapAnalysis');
    const visualScanNode = nodes.find(n => n.type === 'visualScan');
    const revisionNodes = nodes.filter(n => n.type === 'revisionProposal');
    const decodingNodes = nodes.filter(n => n.type === 'decodingHypothesis');

    const nodeTypeCounts: Record<string, number> = {};
    nodes.forEach(n => { nodeTypeCounts[n.type] = (nodeTypeCounts[n.type] || 0) + 1; });

    return {
        intentResult: intentNode?.data.content as IntentAnalysis | undefined,
        gapResult: gapNode?.data.content as GapAnalysis | undefined,
        visualScanResult: visualScanNode?.data.content as VisualScanResult | undefined,
        latestRevision: revisionNodes[revisionNodes.length - 1]?.data.content as (EncodingSuggestions & { proposalId: string }) | undefined,
        decodingCount: decodingNodes.length,
        nodeTypeCounts,
    };
}

type ActiveMode = 'revision' | 'decode' | null;

export default function ContinuationPanel() {
    const pipelineStatus = useAgentCanvasStore((s) => s.pipelineStatus);
    const continuationStatus = useAgentCanvasStore((s) => s.continuationStatus);
    const nodes = useAgentCanvasStore((s) => s.nodes);
    const input = useAgentCanvasStore((s) => s.input);
    const pendingCheckpoint = useAgentCanvasStore((s) => s.pendingCheckpoint);

    const { stream } = useContinuationStream();

    const [activeMode, setActiveMode] = useState<ActiveMode>(null);
    const [inputValue, setInputValue] = useState('');

    // Only show when pipeline is done, no checkpoint active, and not already running continuation
    if (pipelineStatus !== 'done' || pendingCheckpoint || continuationStatus === 'running') return null;

    const ctx = extractContextFromNodes(nodes);
    const isRunning = false; // continuationStatus === 'running' is already excluded by early return above

    const handleRevision = async () => {
        if (!ctx.intentResult || !ctx.gapResult) return;
        setActiveMode(null);
        setInputValue('');
        await stream({
            mode: 'revision',
            intentResult: ctx.intentResult,
            gapResult: ctx.gapResult,
            visualScanResult: ctx.visualScanResult,
            userContext: inputValue.trim(),
            nodeTypeCounts: ctx.nodeTypeCounts,
        });
    };

    const handleDecode = async () => {
        if (!ctx.intentResult || !input.imageBase64 || !inputValue.trim()) return;
        setActiveMode(null);
        setInputValue('');
        await stream({
            mode: 'decode',
            intentResult: ctx.intentResult,
            visualScanResult: ctx.visualScanResult,
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            targetPreset: input.targetPreset,
            contextPreset: input.contextPreset,
            perspectiveLabel: inputValue.trim(),
            nodeTypeCounts: ctx.nodeTypeCounts,
        });
    };

    const handleModeClick = (mode: ActiveMode) => {
        if (activeMode === mode) {
            setActiveMode(null);
            setInputValue('');
        } else {
            setActiveMode(mode);
            setInputValue('');
        }
    };

    return (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40 pb-4 w-full max-w-[600px] px-4 pointer-events-none">
            <div className="pointer-events-auto bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-[#1e1e1e] flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium">분석 완료 — 계속하기</span>
                    {continuationStatus === 'done' && (
                        <span className="ml-auto text-[10px] text-[#555]">재생성 완료</span>
                    )}
                </div>

                <div className="p-3 space-y-2">
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleModeClick('revision')}
                            disabled={isRunning || !ctx.intentResult || !ctx.gapResult}
                            className={`flex-1 px-3 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                                activeMode === 'revision'
                                    ? 'border-green-500/50 bg-green-500/10 text-green-300'
                                    : 'border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#ccc] disabled:opacity-30 disabled:cursor-not-allowed'
                            }`}
                        >
                            🔧 수정 방향 변경
                        </button>
                        <button
                            onClick={() => handleModeClick('decode')}
                            disabled={isRunning || !ctx.intentResult}
                            className={`flex-1 px-3 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                                activeMode === 'decode'
                                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                                    : 'border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#ccc] disabled:opacity-30 disabled:cursor-not-allowed'
                            }`}
                        >
                            👁️ 새 관점 추가
                        </button>
                    </div>

                    {/* Expanded input for revision */}
                    {activeMode === 'revision' && (
                        <div className="flex gap-2 animate-in fade-in duration-150">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRevision()}
                                placeholder="새 수정 방향을 입력하세요 (예: 타이포그래피 집중, 컬러 더 따뜻하게)..."
                                autoFocus
                                className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder-[#444] focus:outline-none focus:border-green-500/40"
                            />
                            <button
                                onClick={handleRevision}
                                disabled={isRunning}
                                className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-[11px] text-green-400 hover:bg-green-500/20 disabled:opacity-30 transition-all whitespace-nowrap"
                            >
                                재생성
                            </button>
                        </div>
                    )}

                    {/* Expanded input for decode */}
                    {activeMode === 'decode' && (
                        <div className="flex gap-2 animate-in fade-in duration-150">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && handleDecode()}
                                placeholder="추가할 관점을 입력하세요 (예: 시니어 세대, 해외 소비자, 경쟁사)..."
                                autoFocus
                                className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[12px] text-[#ccc] placeholder-[#444] focus:outline-none focus:border-sky-500/40"
                            />
                            <button
                                onClick={handleDecode}
                                disabled={isRunning || !inputValue.trim()}
                                className="px-3 py-2 bg-sky-500/10 border border-sky-500/30 rounded-lg text-[11px] text-sky-400 hover:bg-sky-500/20 disabled:opacity-30 transition-all whitespace-nowrap"
                            >
                                추가
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
