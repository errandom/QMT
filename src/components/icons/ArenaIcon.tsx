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
        <ellipse cx="12" cy="12" rx="10" ry="10" opacity="0.2"/>
        <ellipse cx="12" cy="12" rx="8.5" ry="8.5" opacity="0.3"/>
        <ellipse cx="12" cy="12" rx="7" ry="7" opacity="0.4"/>
        <ellipse cx="12" cy="12" rx="5.5" ry="5.5" opacity="0.5"/>
        <ellipse cx="12" cy="12" rx="4" ry="4" opacity="0.6"/>
        <path d="M12 2C12 2 10 4 10 6" opacity="0.7"/>
        <path d="M12 2C12 2 14 4 14 6" opacity="0.7"/>
        <path d="M2 12C2 12 4 10 6 10" opacity="0.7"/>
        <path d="M2 12C2 12 4 14 6 14" opacity="0.7"/>
        <path d="M22 12C22 12 20 10 18 10" opacity="0.7"/>
        <path d="M22 12C22 12 20 14 18 14" opacity="0.7"/>
        <path d="M12 22C12 22 10 20 10 18" opacity="0.7"/>
        <path d="M12 22C12 22 14 20 14 18" opacity="0.7"/>
        <circle cx="12" cy="12" r="2.5" opacity="0.8"/>
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
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="8"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="12" cy="12" r="2"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  );
}
