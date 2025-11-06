interface ManagementIconProps {
  size?: number;
  className?: string;
}

export function ManagementIcon({ size = 24, className = '' }: ManagementIconProps) {
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
      <rect x="2" y="4" width="20" height="14" rx="2" strokeWidth="2"/>
      <line x1="2" y1="18" x2="2" y2="21" strokeWidth="2"/>
      <line x1="22" y1="18" x2="22" y2="21" strokeWidth="2"/>
      <line x1="2" y1="21" x2="22" y2="21" strokeWidth="2"/>
      <path d="M9 8 L11 11 L9 14 L7 11 Z" strokeWidth="1.5" fill="none"/>
      <line x1="13" y1="9" x2="18" y2="9" strokeWidth="1.5"/>
      <line x1="13" y1="11" x2="18" y2="11" strokeWidth="1.5"/>
      <line x1="13" y1="13" x2="18" y2="13" strokeWidth="1.5"/>
      <circle cx="9" cy="11" r="0.7" fill="currentColor"/>
    </svg>
  );
}
