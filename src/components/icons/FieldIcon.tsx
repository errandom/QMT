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
      <line x1="2" y1="21" x2="22" y2="21" stroke="currentColor" strokeWidth="2" strokeOpacity="0.7" />
      
      <line x1="3" y1="12" x2="3" y2="21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="5.8" y1="15" x2="5.8" y2="21" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="8.6" y1="15" x2="8.6" y2="21" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="11.4" y1="15" x2="11.4" y2="21" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
      
      <line x1="12" y1="4" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeOpacity="0.7" />
      
      <line x1="12.6" y1="15" x2="12.6" y2="21" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="15.4" y1="15" x2="15.4" y2="21" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="18.2" y1="15" x2="18.2" y2="21" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="21" y1="12" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" />
      
      <text
        x="6.5"
        y="10"
        fontSize="12"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity="0.75"
        fontFamily="Poppins, sans-serif"
      >
        5
      </text>
      
      <text
        x="17.5"
        y="10"
        fontSize="12"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity="0.75"
        fontFamily="Poppins, sans-serif"
      >
        0
      </text>
    </svg>
  );
}
