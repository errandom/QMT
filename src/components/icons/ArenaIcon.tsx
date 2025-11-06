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
        <path d="M3 20h18v2H3v-2z"/>
        <path d="M4 9v9h2V9H4z"/>
        <path d="M8 9v9h2V9H8z"/>
        <path d="M14 9v9h2V9h-2z"/>
        <path d="M18 9v9h2V9h-2z"/>
        <path d="M2 7l10-5 10 5v2H2V7z" opacity="0.85"/>
        <circle cx="12" cy="14" r="3" fill="white" opacity="0.2"/>
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
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <line x1="3" y1="20" x2="21" y2="20"/>
      <line x1="5" y1="9" x2="5" y2="18"/>
      <line x1="9" y1="9" x2="9" y2="18"/>
      <line x1="15" y1="9" x2="15" y2="18"/>
      <line x1="19" y1="9" x2="19" y2="18"/>
      <path d="M2 9l10-5 10 5v0H2z"/>
      <circle cx="12" cy="14" r="3"/>
    </svg>
  );
}
