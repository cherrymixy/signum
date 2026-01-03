'use client';

import { useState, useCallback } from 'react';

interface CanvasHeaderProps {
  title?: string;
  onTitleChange?: (title: string) => void;
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

// 테마에 따른 클래스 이름 헬퍼
function getThemeClasses(isDark: boolean) {
  return {
    bg: isDark ? 'bg-[#1a1a1a]' : 'bg-white',
    border: isDark ? 'border-[#2a2a2a]' : 'border-[#e5e5e5]',
    text: isDark ? 'text-[#e5e5e5]' : 'text-[#1a1a1a]',
    textSecondary: isDark ? 'text-[#888888]' : 'text-[#666666]',
    hoverBg: isDark ? 'hover:bg-[#222222]' : 'hover:bg-[#f5f5f5]',
    hoverBorder: isDark ? 'hover:border-[#3a3a3a]' : 'hover:border-[#d0d0d0]',
    focusBorder: isDark ? 'focus:border-[#3a3a3a]' : 'focus:border-[#d0d0d0]',
  };
}

export default function CanvasHeader({
  title: initialTitle = '',
  onTitleChange,
  isDarkMode,
  onThemeToggle,
}: CanvasHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const theme = getThemeClasses(isDarkMode);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setIsEditing(false);
      }
      if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    []
  );

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
      {/* 제목 입력 */}
      {isEditing ? (
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          onBlur={() => setIsEditing(false)}
          onKeyDown={handleKeyDown}
          className={`px-3 py-1.5 ${theme.bg} border ${theme.border} rounded-md text-sm ${theme.text} focus:outline-none ${theme.focusBorder} min-w-[200px]`}
          autoFocus
          placeholder="작업물 제목"
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className={`px-3 py-1.5 ${theme.bg} border ${theme.border} rounded-md text-sm ${theme.text} ${theme.hoverBg} ${theme.hoverBorder} transition-colors min-w-[200px] text-left`}
        >
          {title || '작업물 제목'}
        </button>
      )}

      {/* 라이트/다크 모드 전환 */}
      <button
        onClick={onThemeToggle}
        className={`w-8 h-8 flex items-center justify-center ${theme.bg} border ${theme.border} rounded-md ${theme.text} ${theme.hoverBg} ${theme.hoverBorder} transition-colors`}
        title={isDarkMode ? '라이트 모드' : '다크 모드'}
      >
        {isDarkMode ? (
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
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
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
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}

