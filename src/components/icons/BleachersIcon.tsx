interface BleachersIconProps {
  size?: number;
  className?: string;
}

export function BleachersIcon({ size = 24, className = '' }: BleachersIconProps) {
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
      <path d="M4 20h16" strokeWidth="2"/>
      <path d="M4 17h14" strokeWidth="2"/>
      <path d="M4 14h12" strokeWidth="2"/>
      <path d="M4 11h10" strokeWidth="2"/>
      <path d="M4 8h8" strokeWidth="2"/>
      <path d="M4 5h6" strokeWidth="2"/>
      <line x1="4" y1="5" x2="4" y2="20" strokeWidth="2"/>
      <line x1="20" y1="17" x2="20" y2="20" strokeWidth="2"/>
      <line x1="18" y1="14" x2="18" y2="20" strokeWidth="1.5"/>
      <line x1="16" y1="11" x2="16" y2="20" strokeWidth="1.5"/>
      <line x1="14" y1="8" x2="14" y2="20" strokeWidth="1.5"/>
      <line x1="10" y1="5" x2="10" y2="20" strokeWidth="1.5"/>
      <rect x="6" y="3" width="2" height="3" strokeWidth="1.5"/>
      <rect x="8" y="3" width="2" height="3" strokeWidth="1.5"/>
    </svg>
  );
}
