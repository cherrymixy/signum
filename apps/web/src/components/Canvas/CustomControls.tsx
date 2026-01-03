'use client';

import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';

interface CustomControlsProps {
  isDarkMode?: boolean;
}

export default function CustomControls({ isDarkMode = true }: CustomControlsProps) {
  const theme = {
    bg: isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white',
    border: isDarkMode ? 'border-[#2a2a2a]' : 'border-[#e5e5e5]',
    text: isDarkMode ? 'text-[#e5e5e5]' : 'text-[#1a1a1a]',
    hoverBg: isDarkMode ? 'hover:bg-[#222222]' : 'hover:bg-[#f5f5f5]',
    hoverBorder: isDarkMode ? 'hover:border-[#3a3a3a]' : 'hover:border-[#d0d0d0]',
  };
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView();
  }, [fitView]);

  return (
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      <button
        onClick={handleZoomOut}
        className={`w-8 h-8 flex items-center justify-center ${theme.bg} border ${theme.border} rounded-md ${theme.text} ${theme.hoverBg} ${theme.hoverBorder} transition-colors`}
        title="줌 아웃"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <button
        onClick={handleZoomIn}
        className={`w-8 h-8 flex items-center justify-center ${theme.bg} border ${theme.border} rounded-md ${theme.text} ${theme.hoverBg} ${theme.hoverBorder} transition-colors`}
        title="줌 인"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
    </div>
  );
}

