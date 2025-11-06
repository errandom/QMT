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
        <path d="M3 18 L3 16 L6 15 L6 17 Z" opacity="0.95"/>
        <path d="M3 16 L3 14 L7 12.5 L7 14.5 Z" opacity="0.85"/>
        <path d="M3 14 L3 12 L8 10 L8 12 Z" opacity="0.75"/>
        <path d="M3 12 L3 10 L9 7.5 L9 9.5 Z" opacity="0.65"/>
        
        <path d="M21 18 L21 16 L18 15 L18 17 Z" opacity="0.95"/>
        <path d="M21 16 L21 14 L17 12.5 L17 14.5 Z" opacity="0.85"/>
        <path d="M21 14 L21 12 L16 10 L16 12 Z" opacity="0.75"/>
        <path d="M21 12 L21 10 L15 7.5 L15 9.5 Z" opacity="0.65"/>
        
        <path d="M9 7.5 L9 20 L15 20 L15 7.5 Z" opacity="0.3"/>
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
      <path d="M3 18 L3 16 L6 15 L6 17 Z"/>
      <path d="M3 16 L3 14 L7 12.5 L7 14.5 Z"/>
      <path d="M3 14 L3 12 L8 10 L8 12 Z"/>
      <path d="M3 12 L3 10 L9 7.5 L9 9.5 Z"/>
      
      <path d="M21 18 L21 16 L18 15 L18 17 Z"/>
      <path d="M21 16 L21 14 L17 12.5 L17 14.5 Z"/>
      <path d="M21 14 L21 12 L16 10 L16 12 Z"/>
      <path d="M21 12 L21 10 L15 7.5 L15 9.5 Z"/>
      
      <line x1="9" y1="7.5" x2="9" y2="20"/>
      <line x1="15" y1="7.5" x2="15" y2="20"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
    </svg>
  );
}
