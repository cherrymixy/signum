'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { useAgentStream } from '@/hooks/useAgentStream';
import { fileToBase64 } from '@/lib/api';
import { loadCreatorProfile } from '@/lib/creatorProfile';

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

const MAX_IMAGE_MB = 8;

export default function InputPanel() {
    const input = useAgentCanvasStore((s) => s.input);
    const setInput = useAgentCanvasStore((s) => s.setInput);
    const pipelineStatus = useAgentCanvasStore((s) => s.pipelineStatus);
    const pipelineError = useAgentCanvasStore((s) =>
        s.pipelineStatus === 'error' ? s.activityLog.find((l) => l.action === 'error')?.detail : undefined
    );
    const compareStatus = useAgentCanvasStore((s) => s.compareStatus);
    const setCompareImage = useAgentCanvasStore((s) => s.setCompareImage);
    const runCompareAnalysis = useAgentCanvasStore((s) => s.runCompareAnalysis);
    const { startStream } = useAgentStream();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [comparePreviewUrl, setComparePreviewUrl] = useState<string | null>(null);
    const [profileCount, setProfileCount] = useState<number>(0);

    useEffect(() => {
        const profile = loadCreatorProfile();
        if (profile?.totalCount) setProfileCount(profile.totalCount);
    }, []);

    const applyFile = useCallback(async (file: File) => {
        setFileError(null);
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
            setFileError(`이미지는 ${MAX_IMAGE_MB}MB 이하여야 합니다 (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            return;
        }
        const { base64, mimeType } = await fileToBase64(file);
        setInput({ imageBase64: base64, imageMimeType: mimeType, fileName: file.name });
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    }, [setInput]);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await applyFile(file);
    }, [applyFile]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        await applyFile(file);
    }, [applyFile]);

    const handleCompareFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const { base64, mimeType } = await fileToBase64(file);
        setCompareImage(base64, mimeType);
        setComparePreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    }, [setCompareImage]);

    const missingImage = !input.imageBase64;
    const missingIntent = !input.intentText?.trim();
    const isReady = !missingImage && !missingIntent;
    const isRunning = pipelineStatus === 'running';
    const isDone = pipelineStatus === 'done';

    return (
        <div className="w-72 h-full bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
                <img src="/logo.png" alt="Signum" className="w-5 h-5" />
                <span className="text-sm font-semibold text-[#e5e5e5]">Signum</span>
                <div className="ml-auto flex items-center gap-1.5">
                    {profileCount > 0 && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 rounded" title={`${profileCount}회 분석 이력 반영 중`}>
                            ◉ {profileCount}회
                        </span>
                    )}
                    <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 rounded">AI Agents</span>
                </div>
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
                        {CONTEXT_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 파일 에러 */}
            {fileError && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400">
                    {fileError}
                </div>
            )}

            {/* 파이프라인 에러 */}
            {pipelineStatus === 'error' && pipelineError && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400">
                    오류: {pipelineError}
                </div>
            )}

            {/* A/B 비교 섹션 — 파이프라인 완료 후 표시 */}
            {isDone && (
                <div className="px-4 pb-3 border-t border-[#1a1a1a] pt-3 space-y-2">
                    <label className="text-[10px] text-[#888] uppercase tracking-wide">A/B 비교 이미지</label>
                    <div
                        className="border border-dashed border-[#2a2a2a] rounded-lg p-2 text-center cursor-pointer hover:border-sky-500/40 transition-colors"
                        onClick={() => document.getElementById('compare-file-input')?.click()}
                    >
                        {comparePreviewUrl ? (
                            <img src={comparePreviewUrl} alt="비교 이미지" className="w-full h-20 object-cover rounded" />
                        ) : (
                            <p className="text-[10px] text-[#555] py-2">비교할 이미지 업로드</p>
                        )}
                    </div>
                    <input id="compare-file-input" type="file" accept="image/*" onChange={handleCompareFile} className="hidden" />
                    {comparePreviewUrl && (
                        <button
                            onClick={runCompareAnalysis}
                            disabled={compareStatus === 'running'}
                            className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                                compareStatus === 'running'
                                    ? 'bg-sky-500/20 text-sky-300 cursor-wait animate-pulse'
                                    : compareStatus === 'done'
                                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                                    : 'bg-sky-500/80 hover:bg-sky-500 text-white active:scale-[0.98]'
                            }`}
                        >
                            {compareStatus === 'running' ? '비교 분석 중...' : compareStatus === 'done' ? '✓ 비교 완료' : '⚡ A/B 비교 분석'}
                        </button>
                    )}
                </div>
            )}

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
                {!isRunning && !isReady && (
                    <p className="mt-2 text-[10px] text-[#555] text-center">
                        {missingImage ? '이미지를 업로드하세요' : '의도를 입력하세요'}
                    </p>
                )}
            </div>
        </div>
    );
}
