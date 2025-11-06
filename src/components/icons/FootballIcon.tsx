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
        <path d="M12 4C9.5 4 7.5 5.5 6 8C4.5 10.5 4 12 4 12C4 12 4.5 13.5 6 16C7.5 18.5 9.5 20 12 20C14.5 20 16.5 18.5 18 16C19.5 13.5 20 12 20 12C20 12 19.5 10.5 18 8C16.5 5.5 14.5 4 12 4Z" />
        <line x1="12" y1="7" x2="12" y2="17" stroke="white" strokeWidth="1.5" opacity="0.95"/>
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
      <path d="M12 4C9.5 4 7.5 5.5 6 8C4.5 10.5 4 12 4 12C4 12 4.5 13.5 6 16C7.5 18.5 9.5 20 12 20C14.5 20 16.5 18.5 18 16C19.5 13.5 20 12 20 12C20 12 19.5 10.5 18 8C16.5 5.5 14.5 4 12 4Z" strokeWidth="1.8"/>
      <line x1="12" y1="7" x2="12" y2="17" strokeWidth="1.5"/>
      <line x1="9.5" y1="10.5" x2="14.5" y2="10.5" strokeWidth="1.5"/>
      <line x1="9.5" y1="12" x2="14.5" y2="12" strokeWidth="1.5"/>
      <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" strokeWidth="1.5"/>
    </svg>
  );
}
