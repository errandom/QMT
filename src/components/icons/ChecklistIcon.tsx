interface ChecklistIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function ChecklistIcon({ size = 24, className = '', filled = false }: ChecklistIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <rect x="4" y="2" width="16" height="20" rx="2" opacity="0.9"/>
        <path d="M8 7L9.5 8.5L11.5 6.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="13" y1="7.5" x2="17" y2="7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 12L9.5 13.5L11.5 11.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="13" y1="12.5" x2="17" y2="12.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 17L9.5 18.5L11.5 16.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="13" y1="17.5" x2="17" y2="17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
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
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <path d="M8 7L9.5 8.5L11.5 6.5"/>
      <line x1="13" y1="7.5" x2="17" y2="7.5"/>
      <path d="M8 12L9.5 13.5L11.5 11.5"/>
      <line x1="13" y1="12.5" x2="17" y2="12.5"/>
      <path d="M8 17L9.5 18.5L11.5 16.5"/>
      <line x1="13" y1="17.5" x2="17" y2="17.5"/>
    </svg>
  );
}
