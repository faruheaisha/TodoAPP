import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface BrandLogoProps {
  /**
   * Fallback variant when theme is set to "system" and cannot be detected at runtime.
   * Defaults to light.
   */
  defaultVariant?: 'light' | 'dark';
  /** width in px (height scales with viewBox) */
  width?: number;
}

/**
 * BrandLogo – renders the TodoApp word-mark with the check-mark symbol.
 * Picks the correct SVG asset based on current theme (light/dark).
 */
export default function BrandLogo({ defaultVariant = 'light', width = 140 }: BrandLogoProps) {
  const theme = useSettingsStore((s) => s.theme); // 'light' | 'dark' | 'system'

  // Determine active variant
  let variant: 'light' | 'dark' = defaultVariant;
  if (theme === 'light') variant = 'light';
  else if (theme === 'dark') variant = 'dark';
  else if (typeof window !== 'undefined') {
    // system – match prefers-color-scheme
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    variant = mq.matches ? 'dark' : 'light';
  }

  const src = `/logos/todoapp_logo_${variant}.svg`;
  return (
    <img
      src={src}
      width={width}
      height={(width / 140) * 28}
      alt="TodoApp logo"
      style={{ display: 'block' }}
    />
  );
}
