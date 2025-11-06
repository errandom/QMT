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
        <ellipse cx="12" cy="12" rx="10" ry="7" opacity="0.3"/>
        <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="6" y="7" width="12" height="10" rx="1" opacity="0.2"/>
        <rect x="6" y="7" width="12" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="12" y1="7" x2="12" y2="17" stroke="currentColor" strokeWidth="1"/>
        <circle cx="12" cy="12" r="1.5" fill="none" stroke="currentColor" strokeWidth="1"/>
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
      <ellipse cx="12" cy="12" rx="10" ry="7"/>
      <ellipse cx="12" cy="12" rx="9" ry="6"/>
      <rect x="6" y="7" width="12" height="10" rx="1"/>
      <line x1="12" y1="7" x2="12" y2="17"/>
      <circle cx="12" cy="12" r="1.5"/>
    </svg>
  );
}
