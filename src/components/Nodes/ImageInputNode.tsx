'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';

interface GapAnnotation {
    bbox: { x: number; y: number; w: number; h: number };
    severity: 'high' | 'medium' | 'low';
    dimension: string;
}

interface ImageInputNodeProps {
    data: {
        title: string;
        content: {
            intentText: string;
            targetPreset: string;
            contextPreset: string;
            hasImage: boolean;
            gapAnnotations?: GapAnnotation[];
        };
        status: string;
    };
    selected?: boolean;
}

const SEVERITY_COLORS = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
};

export default function ImageInputNode({ data, selected }: ImageInputNodeProps) {
    const imageBase64 = useAgentCanvasStore((s) => s.input.imageBase64);
    const imageMimeType = useAgentCanvasStore((s) => s.input.imageMimeType);

    const annotations: GapAnnotation[] = data.content?.gapAnnotations || [];
    const hasAnnotations = annotations.length > 0;

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border ${hasAnnotations ? 'min-w-[280px] max-w-[320px]' : 'min-w-[240px] max-w-[300px]'} ${selected ? 'border-white/30' : 'border-[#2a2a2a]'}`}>
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
                {hasAnnotations && (
                    <span className="ml-auto text-[9px] text-orange-400 bg-orange-500/10 px-1.5 rounded">
                        {annotations.length}개 Gap 위치
                    </span>
                )}
            </div>

            {/* 이미지 + bbox 오버레이 */}
            {imageBase64 && (
                <div className="relative mx-3 mt-3 rounded overflow-hidden border border-[#2a2a2a]">
                    <img
                        src={`data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`}
                        alt="분석 이미지"
                        className="w-full h-auto block"
                        style={{ maxHeight: '180px', objectFit: 'cover' }}
                    />
                    {hasAnnotations && (
                        <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 1 1"
                            preserveAspectRatio="none"
                        >
                            {annotations.map((ann, i) => {
                                const color = SEVERITY_COLORS[ann.severity] || SEVERITY_COLORS.low;
                                return (
                                    <rect
                                        key={i}
                                        x={ann.bbox.x}
                                        y={ann.bbox.y}
                                        width={ann.bbox.w}
                                        height={ann.bbox.h}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="0.015"
                                        strokeDasharray={ann.severity === 'high' ? 'none' : '0.04 0.02'}
                                        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
                                    />
                                );
                            })}
                        </svg>
                    )}
                </div>
            )}

            <div className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#666]">의도</span>
                    <span className="text-[11px] text-[#aaa] truncate flex-1">{data.content.intentText}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#666]">타겟</span>
                    <span className="text-[11px] text-[#aaa]">{data.content.targetPreset}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#666]">플랫폼</span>
                    <span className="text-[11px] text-[#aaa]">{data.content.contextPreset}</span>
                </div>

                {/* Gap 어노테이션 범례 */}
                {hasAnnotations && (
                    <div className="pt-1.5 border-t border-[#1e1e1e] space-y-1">
                        {annotations.slice(0, 3).map((ann, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <div
                                    className="w-2 h-2 rounded-sm shrink-0 border"
                                    style={{
                                        borderColor: SEVERITY_COLORS[ann.severity],
                                        backgroundColor: SEVERITY_COLORS[ann.severity] + '22',
                                    }}
                                />
                                <span className="text-[9px] text-[#666] truncate">{ann.dimension}</span>
                            </div>
                        ))}
                        {annotations.length > 3 && (
                            <span className="text-[9px] text-[#555]">+{annotations.length - 3}개 더</span>
                        )}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/40 !border-white/60" />
        </div>
    );
}
