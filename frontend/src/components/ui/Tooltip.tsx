import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 400);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const positionClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span
      className={clsx('relative inline-flex items-center', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          className={clsx(
            'absolute z-50 w-64 rounded-lg bg-slate-700 border border-slate-600',
            'px-3 py-2 text-xs text-slate-200 shadow-xl animate-fade-in pointer-events-none',
            positionClass
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help transition-colors', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
