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
        <path d="M3.5 12C3.5 9.5 4 7.5 5.5 6.5C7 5.5 9 5 12 5C15 5 17 5.5 18.5 6.5C20 7.5 20.5 9.5 20.5 12C20.5 14.5 20 16.5 18.5 17.5C17 18.5 15 19 12 19C9 19 7 18.5 5.5 17.5C4 16.5 3.5 14.5 3.5 12Z" />
        <line x1="12" y1="5" x2="12" y2="19" stroke="white" strokeWidth="1.5" opacity="0.95"/>
        <line x1="10" y1="10" x2="10" y2="11.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="11.25" y1="9.5" x2="11.25" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="12.75" y1="9.5" x2="12.75" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="14" y1="10" x2="14" y2="11.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="10" y1="12.5" x2="10" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="11.25" y1="13" x2="11.25" y2="14.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="12.75" y1="13" x2="12.75" y2="14.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
        <line x1="14" y1="12.5" x2="14" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.95"/>
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
      <path d="M3.5 12C3.5 9.5 4 7.5 5.5 6.5C7 5.5 9 5 12 5C15 5 17 5.5 18.5 6.5C20 7.5 20.5 9.5 20.5 12C20.5 14.5 20 16.5 18.5 17.5C17 18.5 15 19 12 19C9 19 7 18.5 5.5 17.5C4 16.5 3.5 14.5 3.5 12Z" strokeWidth="1.8"/>
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="1.5"/>
      <line x1="10" y1="10" x2="10" y2="11.5" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="11.25" y1="9.5" x2="11.25" y2="11" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12.75" y1="9.5" x2="12.75" y2="11" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="14" y2="11.5" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="10" y1="12.5" x2="10" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="11.25" y1="13" x2="11.25" y2="14.5" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12.75" y1="13" x2="12.75" y2="14.5" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="12.5" x2="14" y2="14" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
