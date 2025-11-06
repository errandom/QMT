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
        <ellipse cx="12" cy="18" rx="10" ry="4" opacity="0.9"/>
        <path d="M2 18V10C2 9 2.5 8 3.5 7L12 3L20.5 7C21.5 8 22 9 22 10V18" opacity="0.85"/>
        <path d="M3 10V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M5.5 9V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M8 8.5V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M10.5 8V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M13.5 8V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M16 8.5V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M18.5 9V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <path d="M21 10V18" strokeWidth="1.5" stroke="currentColor" opacity="0.6"/>
        <ellipse cx="12" cy="13" rx="5" ry="3" opacity="0.3"/>
        <path d="M12 3L8 5.5L12 7.5L16 5.5L12 3Z" opacity="0.7"/>
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
      <ellipse cx="12" cy="18" rx="10" ry="4"/>
      <path d="M2 18V10C2 9 2.5 8 3.5 7L12 3L20.5 7C21.5 8 22 9 22 10V18"/>
      <line x1="3" y1="10" x2="3" y2="18"/>
      <line x1="5.5" y1="9" x2="5.5" y2="18"/>
      <line x1="8" y1="8.5" x2="8" y2="18"/>
      <line x1="10.5" y1="8" x2="10.5" y2="18"/>
      <line x1="13.5" y1="8" x2="13.5" y2="18"/>
      <line x1="16" y1="8.5" x2="16" y2="18"/>
      <line x1="18.5" y1="9" x2="18.5" y2="18"/>
      <line x1="21" y1="10" x2="21" y2="18"/>
      <ellipse cx="12" cy="13" rx="5" ry="3"/>
    </svg>
  );
}
