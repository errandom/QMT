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
        <ellipse cx="12" cy="12" rx="8.5" ry="5.5" />
        <line x1="12" y1="6.5" x2="12" y2="17.5" stroke="white" strokeWidth="1.5" opacity="0.95"/>
        <line x1="9.5" y1="10.5" x2="14.5" y2="10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.95"/>
        <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.95"/>
        <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.95"/>
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
      <ellipse cx="12" cy="12" rx="8.5" ry="5.5" strokeWidth="1.8"/>
      <line x1="12" y1="6.5" x2="12" y2="17.5" strokeWidth="1.5"/>
      <line x1="9.5" y1="10.5" x2="14.5" y2="10.5" strokeWidth="1.5"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" strokeWidth="1.5"/>
      <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" strokeWidth="1.5"/>
    </svg>
  );
}
