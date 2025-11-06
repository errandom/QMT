interface GridironIconProps {
  size?: number;
  className?: string;
}

export function GridironIcon({ size = 24, className = '' }: GridironIconProps) {
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
      <rect x="2" y="5" width="20" height="14" rx="1" strokeWidth="2" />
      <line x1="2" y1="9" x2="22" y2="9" strokeWidth="1.5" />
      <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.5" />
      <line x1="2" y1="15" x2="22" y2="15" strokeWidth="1.5" />
      <line x1="6" y1="5" x2="6" y2="19" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="10" y1="5" x2="10" y2="19" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="14" y1="5" x2="14" y2="19" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="18" y1="5" x2="18" y2="19" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
    </svg>
  );
}
