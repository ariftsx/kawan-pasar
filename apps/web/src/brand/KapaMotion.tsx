'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Starts Kapa's CSS animation only while it is on screen (sets `data-playing`). Under
 * prefers-reduced-motion it never starts. Without JavaScript Kapa simply stays still.
 */
export function KapaMotion({ children }: { children: ReactNode }): ReactNode {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) el.setAttribute('data-playing', '');
        else el.removeAttribute('data-playing');
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);
  return (
    <span ref={ref} className="kapa-motion">
      {children}
    </span>
  );
}
