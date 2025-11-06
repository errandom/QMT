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
        <rect x="2" y="8" width="7" height="12" opacity="0.7"/>
        <rect x="10" y="5" width="12" height="15" opacity="0.8"/>
        <path d="M10 5L16 2L22 5V20H10V5Z" opacity="0.9"/>
        <rect x="3" y="10" width="1.5" height="2" opacity="0.4"/>
        <rect x="3" y="13" width="1.5" height="2" opacity="0.4"/>
        <rect x="3" y="16" width="1.5" height="2" opacity="0.4"/>
        <rect x="6" y="10" width="1.5" height="2" opacity="0.4"/>
        <rect x="6" y="13" width="1.5" height="2" opacity="0.4"/>
        <rect x="6" y="16" width="1.5" height="2" opacity="0.4"/>
        <rect x="12" y="7" width="1.5" height="2" opacity="0.4"/>
        <rect x="12" y="10" width="1.5" height="2" opacity="0.4"/>
        <rect x="12" y="13" width="1.5" height="2" opacity="0.4"/>
        <rect x="12" y="16" width="1.5" height="2" opacity="0.4"/>
        <rect x="15" y="7" width="1.5" height="2" opacity="0.4"/>
        <rect x="15" y="10" width="1.5" height="2" opacity="0.4"/>
        <rect x="15" y="13" width="1.5" height="2" opacity="0.4"/>
        <rect x="15" y="16" width="1.5" height="2" opacity="0.4"/>
        <rect x="18.5" y="7" width="1.5" height="2" opacity="0.4"/>
        <rect x="18.5" y="10" width="1.5" height="2" opacity="0.4"/>
        <rect x="18.5" y="13" width="1.5" height="2" opacity="0.4"/>
        <rect x="18.5" y="16" width="1.5" height="2" opacity="0.4"/>
        <path d="M2 20H22" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <ellipse cx="16" cy="12" rx="3" ry="2" opacity="0.3"/>
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
      <rect x="2" y="8" width="7" height="12"/>
      <rect x="10" y="5" width="12" height="15"/>
      <path d="M10 5L16 2L22 5"/>
      <line x1="2" y1="20" x2="22" y2="20" strokeWidth="2"/>
      <rect x="3" y="10" width="1.5" height="2"/>
      <rect x="3" y="13" width="1.5" height="2"/>
      <rect x="3" y="16" width="1.5" height="2"/>
      <rect x="6" y="10" width="1.5" height="2"/>
      <rect x="6" y="13" width="1.5" height="2"/>
      <rect x="6" y="16" width="1.5" height="2"/>
      <rect x="12" y="7" width="1.5" height="2"/>
      <rect x="12" y="10" width="1.5" height="2"/>
      <rect x="12" y="13" width="1.5" height="2"/>
      <rect x="12" y="16" width="1.5" height="2"/>
      <rect x="15" y="7" width="1.5" height="2"/>
      <rect x="15" y="10" width="1.5" height="2"/>
      <rect x="15" y="13" width="1.5" height="2"/>
      <rect x="15" y="16" width="1.5" height="2"/>
      <rect x="18.5" y="7" width="1.5" height="2"/>
      <rect x="18.5" y="10" width="1.5" height="2"/>
      <rect x="18.5" y="13" width="1.5" height="2"/>
      <rect x="18.5" y="16" width="1.5" height="2"/>
      <ellipse cx="16" cy="12" rx="3" ry="2"/>
    </svg>
  );
}
