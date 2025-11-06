interface FlagIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function FlagIcon({ size = 24, className = '', filled = false }: FlagIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <line x1="4" y1="3" x2="4" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M4 3 L18 3 L16 8 L18 13 L4 13 Z" />
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
      <line x1="4" y1="3" x2="4" y2="22"/>
      <path d="M4 3 L18 3 L16 8 L18 13 L4 13 Z"/>
    </svg>
  );
}
