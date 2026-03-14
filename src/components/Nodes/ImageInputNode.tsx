'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';

interface ImageInputNodeProps {
    data: {
        title: string;
        content: {
            intentText: string;
            targetPreset: string;
            contextPreset: string;
            hasImage: boolean;
        };
        status: string;
    };
    selected?: boolean;
}

export default function ImageInputNode({ data, selected }: ImageInputNodeProps) {
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] max-w-[300px] ${selected ? 'border-white/30' : 'border-[#2a2a2a]'
            }`}>
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
            </div>
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
                    <span className="text-[10px] text-[#666]">컨텍스트</span>
                    <span className="text-[11px] text-[#aaa]">{data.content.contextPreset}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/40 !border-white/60" />
        </div>
    );
}
