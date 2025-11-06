interface JerseyIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function JerseyIcon({ size = 24, className = '', filled = false }: JerseyIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <path d="M8 3L5 5L4 7V20C4 20.5 4.5 21 5 21H19C19.5 21 20 20.5 20 20V7L19 5L16 3H14.5C14.5 4 13.5 5 12 5C10.5 5 9.5 4 9.5 3H8Z" />
        <path d="M9 8H15V10H9V8Z" fill="white" opacity="0.3"/>
        <text 
          x="12" 
          y="16.5" 
          fontSize="7" 
          fontWeight="bold" 
          fill="white"
          textAnchor="middle"
          fontFamily="sans-serif"
        >
          82
        </text>
      </svg>
    );
  }

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor" 
      strokeWidth="1.5"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3L5 5L4 7V20C4 20.5 4.5 21 5 21H19C19.5 21 20 20.5 20 20V7L19 5L16 3" />
      <path d="M8 3H9.5C9.5 4 10.5 5 12 5C13.5 5 14.5 4 14.5 3H16" />
      <rect x="9" y="8" width="6" height="2" />
      <text 
        x="12" 
        y="16.5" 
        fontSize="7" 
        fontWeight="bold" 
        fill="currentColor"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        82
      </text>
    </svg>
  );
}
