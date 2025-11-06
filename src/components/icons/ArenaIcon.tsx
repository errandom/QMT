interface ArenaIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function ArenaIcon({ size = 24, className = '', filled = false }: ArenaIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <path d="M3 20V12L12 6L21 12V20H3Z" opacity="0.8"/>
        <rect x="4" y="12" width="2.5" height="8" opacity="0.4"/>
        <rect x="7.5" y="12" width="2.5" height="8" opacity="0.4"/>
        <rect x="11" y="12" width="2" height="8" opacity="0.4"/>
        <rect x="14" y="12" width="2.5" height="8" opacity="0.4"/>
        <rect x="17.5" y="12" width="2.5" height="8" opacity="0.4"/>
        <path d="M2 20H22" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M12 6L21 12H3L12 6Z" fill="currentColor" opacity="0.6"/>
      </svg>
    );
  }

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor" 
      strokeWidth="1.5"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 6L3 12V20H21V12L12 6Z"/>
      <line x1="2" y1="20" x2="22" y2="20" strokeWidth="2"/>
      <rect x="4" y="12" width="2.5" height="8"/>
      <rect x="7.5" y="12" width="2.5" height="8"/>
      <rect x="11" y="12" width="2" height="8"/>
      <rect x="14" y="12" width="2.5" height="8"/>
      <rect x="17.5" y="12" width="2.5" height="8"/>
      <path d="M3 12L12 6L21 12"/>
    </svg>
  );
}
