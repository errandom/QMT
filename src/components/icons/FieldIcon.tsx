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
      <path 
        d="M 2 6 L 22 8 L 22 16 L 2 18 Z" 
        fill="currentColor" 
        opacity="0.1" 
        stroke="none"
      />
      
      <line x1="2" y1="6" x2="22" y2="8" strokeWidth="1.5" />
      <line x1="2" y1="18" x2="22" y2="16" strokeWidth="1.5" />
      
      <line x1="4" y1="6.2" x2="4" y2="17.8" strokeWidth="0.5" opacity="0.3" />
      <line x1="6" y1="6.4" x2="6" y2="17.6" strokeWidth="0.5" opacity="0.3" />
      <line x1="8" y1="6.7" x2="8" y2="17.3" strokeWidth="0.5" opacity="0.3" />
      <line x1="10" y1="7" x2="10" y2="17" strokeWidth="0.6" opacity="0.4" />
      
      <line x1="12" y1="7.3" x2="12" y2="16.7" strokeWidth="2" />
      
      <line x1="14" y1="7.6" x2="14" y2="16.4" strokeWidth="0.6" opacity="0.4" />
      <line x1="16" y1="7.9" x2="16" y2="16.1" strokeWidth="0.5" opacity="0.3" />
      <line x1="18" y1="8.2" x2="18" y2="15.8" strokeWidth="0.5" opacity="0.3" />
      <line x1="20" y1="8.5" x2="20" y2="15.5" strokeWidth="0.5" opacity="0.3" />
      
      <text 
        x="12" 
        y="13.5" 
        fontSize="4.5" 
        fontWeight="bold" 
        textAnchor="middle" 
        fill="currentColor"
        opacity="0.9"
      >
        50
      </text>
    </svg>
  );
}
