interface FootballIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function FootballIcon({ size = 24, className = '', filled = false }: FootballIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <ellipse cx="12" cy="12" rx="10" ry="6.5"/>
        <line x1="3" y1="12" x2="21" y2="12" stroke="white" strokeWidth="1.8" opacity="0.95"/>
        <line x1="9.5" y1="12" x2="10" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="11" y1="12" x2="11.5" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="12.5" y1="12" x2="13" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="14" y1="12" x2="14.5" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
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
      <ellipse cx="12" cy="12" rx="10" ry="6.5"/>
      <line x1="3" y1="12" x2="21" y2="12" strokeWidth="1.8"/>
      <line x1="9.5" y1="12" x2="10" y2="12" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="11" y1="12" x2="11.5" y2="12" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12.5" y1="12" x2="13" y2="12" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="12" x2="14.5" y2="12" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
