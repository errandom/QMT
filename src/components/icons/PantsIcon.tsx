interface PantsIconProps {
  size?: number;
  className?: string;
}

export function PantsIcon({ size = 24, className = '' }: PantsIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 3 L5 10 L4 21" strokeWidth="2"/>
      <path d="M18 3 L19 10 L20 21" strokeWidth="2"/>
      <path d="M6 3 h12" strokeWidth="2"/>
      <path d="M12 3 L12 10" strokeWidth="1.5"/>
      <line x1="8" y1="7" x2="10" y2="7" strokeWidth="2"/>
      <line x1="14" y1="7" x2="16" y2="7" strokeWidth="2"/>
      <line x1="7.5" y1="10" x2="9.5" y2="10" strokeWidth="1.5"/>
      <line x1="14.5" y1="10" x2="16.5" y2="10" strokeWidth="1.5"/>
      <line x1="6.5" y1="13" x2="8" y2="13" strokeWidth="1.5"/>
      <line x1="16" y1="13" x2="17.5" y2="13" strokeWidth="1.5"/>
      <line x1="6" y1="16" x2="7.5" y2="16" strokeWidth="1.5"/>
      <line x1="16.5" y1="16" x2="18" y2="16" strokeWidth="1.5"/>
    </svg>
  );
}
