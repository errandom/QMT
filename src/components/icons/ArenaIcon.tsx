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
        <path d="M3 16 L3 14 L6 13 L6 15 Z" opacity="0.9"/>
        <path d="M3 14 L3 12 L7 10.5 L7 12.5 Z" opacity="0.85"/>
        <path d="M3 12 L3 10 L8 8 L8 10 Z" opacity="0.8"/>
        <path d="M3 10 L3 8 L9 5.5 L9 7.5 Z" opacity="0.75"/>
        <path d="M3 8 L3 6 L10 3 L10 5 Z" opacity="0.7"/>
        
        <path d="M21 16 L21 14 L18 13 L18 15 Z" opacity="0.9"/>
        <path d="M21 14 L21 12 L17 10.5 L17 12.5 Z" opacity="0.85"/>
        <path d="M21 12 L21 10 L16 8 L16 10 Z" opacity="0.8"/>
        <path d="M21 10 L21 8 L15 5.5 L15 7.5 Z" opacity="0.75"/>
        <path d="M21 8 L21 6 L14 3 L14 5 Z" opacity="0.7"/>
        
        <path d="M10 3 L14 3 L14 21 L10 21 Z" opacity="0.3"/>
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
      <path d="M3 16 L3 14 L6 13 L6 15 Z"/>
      <path d="M3 14 L3 12 L7 10.5 L7 12.5 Z"/>
      <path d="M3 12 L3 10 L8 8 L8 10 Z"/>
      <path d="M3 10 L3 8 L9 5.5 L9 7.5 Z"/>
      <path d="M3 8 L3 6 L10 3 L10 5 Z"/>
      
      <path d="M21 16 L21 14 L18 13 L18 15 Z"/>
      <path d="M21 14 L21 12 L17 10.5 L17 12.5 Z"/>
      <path d="M21 12 L21 10 L16 8 L16 10 Z"/>
      <path d="M21 10 L21 8 L15 5.5 L15 7.5 Z"/>
      <path d="M21 8 L21 6 L14 3 L14 5 Z"/>
      
      <line x1="10" y1="3" x2="10" y2="21"/>
      <line x1="14" y1="3" x2="14" y2="21"/>
      <line x1="10" y1="21" x2="14" y2="21"/>
    </svg>
  );
}
