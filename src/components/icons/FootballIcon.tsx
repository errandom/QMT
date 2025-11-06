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
        <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(45 12 12)"/>
        <line x1="8" y1="8" x2="16" y2="16" stroke="white" strokeWidth="1.5" opacity="0.9"/>
        <line x1="10" y1="6.5" x2="17.5" y2="14" stroke="white" strokeWidth="1" opacity="0.7"/>
        <line x1="6.5" y1="10" x2="14" y2="17.5" stroke="white" strokeWidth="1" opacity="0.7"/>
        <line x1="10" y1="12" x2="10.5" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
        <line x1="12" y1="12" x2="12.5" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
        <line x1="14" y1="12" x2="14.5" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
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
      <ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(45 12 12)"/>
      <line x1="8" y1="8" x2="16" y2="16"/>
      <line x1="10" y1="6.5" x2="17.5" y2="14" strokeWidth="1.5"/>
      <line x1="6.5" y1="10" x2="14" y2="17.5" strokeWidth="1.5"/>
      <line x1="10" y1="12" x2="10.5" y2="12" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="12" x2="12.5" y2="12" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="12" x2="14.5" y2="12" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
