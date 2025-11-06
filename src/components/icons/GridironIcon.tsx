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
      <rect x="2" y="5" width="20" height="14" rx="0.5" strokeWidth="1.5" />
      <line x1="2" y1="8" x2="22" y2="8" strokeWidth="0.5" />
      <line x1="2" y1="10" x2="22" y2="10" strokeWidth="0.5" />
      <line x1="2" y1="12" x2="22" y2="12" strokeWidth="0.5" />
      <line x1="2" y1="14" x2="22" y2="14" strokeWidth="0.5" />
      <line x1="2" y1="16" x2="22" y2="16" strokeWidth="0.5" />
      <line x1="5" y1="5" x2="5" y2="19" strokeWidth="0.5" />
      <line x1="8" y1="5" x2="8" y2="19" strokeWidth="0.5" />
      <line x1="11" y1="5" x2="11" y2="19" strokeWidth="0.5" />
      <line x1="13" y1="5" x2="13" y2="19" strokeWidth="0.5" />
      <line x1="16" y1="5" x2="16" y2="19" strokeWidth="0.5" />
      <line x1="19" y1="5" x2="19" y2="19" strokeWidth="0.5" />
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" />
    </svg>
  );
}
