interface PlayboardIconProps {
  size?: number;
  className?: string;
}

export function PlayboardIcon({ size = 24, className = '' }: PlayboardIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="14" rx="1" strokeWidth="2"/>
      <line x1="2" y1="17" x2="4" y2="20" strokeWidth="2"/>
      <line x1="22" y1="17" x2="20" y2="20" strokeWidth="2"/>
      <line x1="4" y1="20" x2="20" y2="20" strokeWidth="2"/>
      <path d="M12 6 L16 10 L12 14 L8 10 Z" strokeWidth="1.5" fill="none"/>
      <path d="M6 8 L9 10 M15 10 L18 8" strokeWidth="1.5"/>
      <circle cx="12" cy="10" r="0.8" fill="currentColor"/>
      <circle cx="8" cy="10" r="0.8" fill="currentColor"/>
      <circle cx="16" cy="10" r="0.8" fill="currentColor"/>
    </svg>
  );
}
