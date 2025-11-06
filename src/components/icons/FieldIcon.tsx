interface FieldIconProps {
  size?: number;
  className?: string;
}

export function FieldIcon({ size = 24, className = '' }: FieldIconProps) {
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
      <rect x="2" y="5" width="20" height="14" rx="1" strokeWidth="2" fill="none" />
      <line x1="4" y1="5" x2="4" y2="19" strokeWidth="1" opacity="0.4" />
      <line x1="6" y1="5" x2="6" y2="19" strokeWidth="0.6" opacity="0.3" />
      <line x1="8" y1="5" x2="8" y2="19" strokeWidth="1" opacity="0.4" />
      <line x1="10" y1="5" x2="10" y2="19" strokeWidth="1.2" opacity="0.5" />
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
      <line x1="14" y1="5" x2="14" y2="19" strokeWidth="1.2" opacity="0.5" />
      <line x1="16" y1="5" x2="16" y2="19" strokeWidth="1" opacity="0.4" />
      <line x1="18" y1="5" x2="18" y2="19" strokeWidth="0.6" opacity="0.3" />
      <line x1="20" y1="5" x2="20" y2="19" strokeWidth="1" opacity="0.4" />
      <rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" opacity="0.15" rx="0.3"/>
      <text x="12" y="13.2" fontSize="2.8" fontWeight="bold" textAnchor="middle" fill="currentColor">50</text>
    </svg>
  );
}
