'use client';

import React, { useState, useCallback } from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { useAgentStream } from '@/hooks/useAgentStream';
import { fileToBase64 } from '@/lib/api';

const TARGET_PRESETS = [
    { value: 'gen-z-female', label: '10~20대 여성' },
    { value: 'gen-z-male', label: '10~20대 남성' },
    { value: 'millennial', label: '30대' },
    { value: 'gen-x', label: '40~50대' },
    { value: 'general', label: '일반 대중' },
    { value: 'professional', label: '비즈니스/전문가' },
];

const CONTEXT_PRESETS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube-thumbnail', label: 'YouTube 썸네일' },
    { value: 'brand-ad', label: '브랜드 광고' },
    { value: 'presentation', label: '프레젠테이션' },
    { value: 'portfolio', label: '포트폴리오' },
    { value: 'poster', label: '포스터/전단지' },
];

export default function InputPanel() {
    const input = useAgentCanvasStore((s) => s.input);
    const setInput = useAgentCanvasStore((s) => s.setInput);
    const pipelineStatus = useAgentCanvasStore((s) => s.pipelineStatus);
    const { startStream } = useAgentStream();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const { base64, mimeType } = await fileToBase64(file);
        setInput({ imageBase64: base64, imageMimeType: mimeType, fileName: file.name });
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    }, [setInput]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const { base64, mimeType } = await fileToBase64(file);
        setInput({ imageBase64: base64, imageMimeType: mimeType, fileName: file.name });
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    }, [setInput]);

    const isReady = input.imageBase64 && input.intentText?.trim() && input.targetPreset && input.contextPreset;
    const isRunning = pipelineStatus === 'running';

    return (
        <div className="w-72 h-full bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
                <img src="/logo.png" alt="Signum" className="w-5 h-5" />
                <span className="text-sm font-semibold text-[#e5e5e5]">Signum</span>
                <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 rounded ml-auto">AI Agents</span>
            </div>

            {/* 이미지 업로드 */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div>
                    <label className="text-[10px] text-[#888] uppercase tracking-wide">이미지</label>
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="mt-1 border border-dashed border-[#2a2a2a] rounded-lg p-3 text-center cursor-pointer hover:border-[#3a3a3a] transition-colors"
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded" />
                        ) : (
                            <div className="py-6">
                                <p className="text-xs text-[#666]">클릭 또는 드래그</p>
                                <p className="text-[10px] text-[#444] mt-1">PNG, JPG, WEBP</p>
                            </div>
                        )}
                    </div>
                    <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>

                {/* 의도 */}
                <div>
                    <label className="text-[10px] text-[#888] uppercase tracking-wide">의도</label>
                    <textarea
                        value={input.intentText}
                        onChange={(e) => setInput({ intentText: e.target.value })}
                        placeholder="이 이미지로 전달하려는 의도를 설명하세요..."
                        className="mt-1 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#ccc] placeholder-[#444] resize-none focus:outline-none focus:border-violet-500/50"
                        rows={3}
                        disabled={isRunning}
                    />
                </div>

                {/* 타겟 */}
                <div>
                    <label className="text-[10px] text-[#888] uppercase tracking-wide">타겟 오디언스</label>
                    <select
                        value={input.targetPreset}
                        onChange={(e) => setInput({ targetPreset: e.target.value })}
                        className="mt-1 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#ccc] focus:outline-none focus:border-violet-500/50"
                        disabled={isRunning}
                    >
                        <option value="">선택하세요</option>
                        {TARGET_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>

                {/* 컨텍스트 */}
                <div>
                    <label className="text-[10px] text-[#888] uppercase tracking-wide">게시 플랫폼</label>
                    <select
                        value={input.contextPreset}
                        onChange={(e) => setInput({ contextPreset: e.target.value })}
                        className="mt-1 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#ccc] focus:outline-none focus:border-violet-500/50"
                        disabled={isRunning}
                    >
                        <option value="">선택하세요</option>
                        {CONTEXT_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 실행 버튼 */}
            <div className="p-4 border-t border-[#1a1a1a]">
                <button
                    onClick={startStream}
                    disabled={!isReady || isRunning}
                    className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all ${isRunning
                            ? 'bg-violet-500/20 text-violet-300 cursor-wait animate-pulse'
                            : isReady
                                ? 'bg-violet-500 hover:bg-violet-600 text-white active:scale-[0.98]'
                                : 'bg-[#1a1a1a] text-[#444] cursor-not-allowed'
                        }`}
                >
                    {isRunning ? 'Agents 분석 중...' : '🚀 분석 시작'}
                </button>
            </div>
        </div>
    );
}
