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
        <line x1="10.2" y1="10" x2="10.2" y2="11.3" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="11.1" y1="9.3" x2="11.1" y2="10.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="12" y1="9" x2="12" y2="10.3" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="12.9" y1="9.3" x2="12.9" y2="10.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="13.8" y1="10" x2="13.8" y2="11.3" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="10.2" y1="12.7" x2="10.2" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="11.1" y1="13.4" x2="11.1" y2="14.7" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="12" y1="13.7" x2="12" y2="15" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="12.9" y1="13.4" x2="12.9" y2="14.7" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
        <line x1="13.8" y1="12.7" x2="13.8" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.95"/>
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
      <line x1="10.2" y1="10" x2="10.2" y2="11.3" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="11.1" y1="9.3" x2="11.1" y2="10.6" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="12" y1="9" x2="12" y2="10.3" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="12.9" y1="9.3" x2="12.9" y2="10.6" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="13.8" y1="10" x2="13.8" y2="11.3" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="10.2" y1="12.7" x2="10.2" y2="14" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="11.1" y1="13.4" x2="11.1" y2="14.7" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="12" y1="13.7" x2="12" y2="15" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="12.9" y1="13.4" x2="12.9" y2="14.7" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="13.8" y1="12.7" x2="13.8" y2="14" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}
