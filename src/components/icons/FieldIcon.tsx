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
      <line x1="2" y1="7" x2="22" y2="8.5" strokeWidth="1.5" />
      <line x1="2" y1="17" x2="22" y2="15.5" strokeWidth="1.5" />
      
      <line x1="5" y1="7.4" x2="5" y2="16.6" strokeWidth="0.8" opacity="0.4" />
      <line x1="8" y1="7.7" x2="8" y2="16.3" strokeWidth="0.8" opacity="0.4" />
      
      <line x1="12" y1="8.1" x2="12" y2="15.9" strokeWidth="1.8" />
      
      <line x1="16" y1="8.4" x2="16" y2="15.6" strokeWidth="0.8" opacity="0.4" />
      <line x1="19" y1="8.7" x2="19" y2="15.3" strokeWidth="0.8" opacity="0.4" />
      
      <text 
        x="12" 
        y="13" 
        fontSize="4" 
        fontWeight="600" 
        textAnchor="middle" 
        fill="currentColor"
      >
        50
      </text>
    </svg>
  );
}
