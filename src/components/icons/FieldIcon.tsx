interface FieldIconProps {
  className?: string;
  size?: number;
}

export function FieldIcon({ className, size = 24 }: FieldIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="2"
        y="3"
        width="20"
        height="18"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="2" />
      
      <line x1="4" y1="6" x2="4" y2="9" stroke="currentColor" strokeWidth="1" />
      <line x1="4" y1="10.5" x2="4" y2="13.5" stroke="currentColor" strokeWidth="1" />
      <line x1="4" y1="15" x2="4" y2="18" stroke="currentColor" strokeWidth="1" />
      
      <line x1="6.5" y1="6" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="6.5" y1="9.5" x2="6.5" y2="11.5" stroke="currentColor" strokeWidth="1" />
      <line x1="6.5" y1="13" x2="6.5" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="6.5" y1="16" x2="6.5" y2="18" stroke="currentColor" strokeWidth="1" />
      
      <line x1="9" y1="6" x2="9" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="9" y1="9.5" x2="9" y2="11.5" stroke="currentColor" strokeWidth="1" />
      <line x1="9" y1="13" x2="9" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="9" y1="16" x2="9" y2="18" stroke="currentColor" strokeWidth="1" />
      
      <line x1="15" y1="6" x2="15" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="15" y1="9.5" x2="15" y2="11.5" stroke="currentColor" strokeWidth="1" />
      <line x1="15" y1="13" x2="15" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="15" y1="16" x2="15" y2="18" stroke="currentColor" strokeWidth="1" />
      
      <line x1="17.5" y1="6" x2="17.5" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="17.5" y1="9.5" x2="17.5" y2="11.5" stroke="currentColor" strokeWidth="1" />
      <line x1="17.5" y1="13" x2="17.5" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="17.5" y1="16" x2="17.5" y2="18" stroke="currentColor" strokeWidth="1" />
      
      <line x1="20" y1="6" x2="20" y2="9" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="10.5" x2="20" y2="13.5" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="15" x2="20" y2="18" stroke="currentColor" strokeWidth="1" />
      
      <text
        x="12"
        y="15"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Poppins, sans-serif"
      >
        50
      </text>
    </svg>
  );
}
