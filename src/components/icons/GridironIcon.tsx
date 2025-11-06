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
      <rect x="2" y="6" width="20" height="12" rx="1" strokeWidth="2" />
      <line x1="5" y1="6" x2="5" y2="18" strokeWidth="1" opacity="0.6" />
      <line x1="7.5" y1="6" x2="7.5" y2="18" strokeWidth="1" opacity="0.6" />
      <line x1="10" y1="6" x2="10" y2="18" strokeWidth="1.5" opacity="0.7" />
      <line x1="14" y1="6" x2="14" y2="18" strokeWidth="1.5" opacity="0.7" />
      <line x1="16.5" y1="6" x2="16.5" y2="18" strokeWidth="1" opacity="0.6" />
      <line x1="19" y1="6" x2="19" y2="18" strokeWidth="1" opacity="0.6" />
      <line x1="12" y1="6" x2="12" y2="18" strokeWidth="2.5" />
    </svg>
  );
}
