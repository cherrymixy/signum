'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';

interface Props {
    data: {
        agentId: string;
        title: string;
        content: {
            summary: string;
            generatedImageBase64?: string;
            generatedImageMimeType?: string;
            error?: boolean;
        };
        status: string;
    };
    selected?: boolean;
}

export default function ExecutionNode({ data, selected }: Props) {
    const c = data.content;
    const hasImage = c.generatedImageBase64 && !c.error;

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border ${hasImage ? 'min-w-[320px] max-w-[360px]' : 'min-w-[240px]'
            } ${selected ? 'border-pink-500/50' : 'border-[#2a2a2a]'} ${c.error ? 'border-red-500/30' : ''
            }`} data-agent="executor">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-pink-400 !border-pink-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">🚀</span>
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
                {c.error && <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 rounded">오류</span>}
            </div>
            <div className="p-3 space-y-2">
                {hasImage && (
                    <div className="rounded-lg overflow-hidden border border-[#2a2a2a]">
                        <img
                            src={`data:${c.generatedImageMimeType};base64,${c.generatedImageBase64}`}
                            alt="생성된 수정 이미지"
                            className="w-full h-auto"
                        />
                    </div>
                )}
                <p className={`text-[11px] leading-relaxed ${c.error ? 'text-red-400' : 'text-[#ccc]'}`}>
                    {c.summary}
                </p>
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-pink-400 !border-pink-600" />
        </div>
    );
}
