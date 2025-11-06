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
      <line x1="2" y1="21" x2="22" y2="21" stroke="currentColor" strokeWidth="2.5" />
      
      <line x1="3" y1="12" x2="3" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="5.5" y1="15" x2="5.5" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="15" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="10.5" y1="15" x2="10.5" y2="21" stroke="currentColor" strokeWidth="2" />
      
      <line x1="12" y1="6" x2="12" y2="21" stroke="currentColor" strokeWidth="3" />
      
      <line x1="13.5" y1="15" x2="13.5" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="15" x2="16" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="18.5" y1="15" x2="18.5" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="12" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
      
      <text
        x="8.5"
        y="12"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Poppins, sans-serif"
      >
        5
      </text>
      
      <text
        x="15.5"
        y="12"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Poppins, sans-serif"
      >
        0
      </text>
    </svg>
  );
}
