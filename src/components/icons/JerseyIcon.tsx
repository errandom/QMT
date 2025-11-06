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
        <path d="M8 2L6 4L4 6V20C4 20.5 4.5 21 5 21H10V22H14V21H19C19.5 21 20 20.5 20 20V6L18 4L16 2H14L13 4H11L10 2H8Z" />
        <text 
          x="12" 
          y="15" 
          fontSize="8" 
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
      <path d="M8 2L6 4L4 6V20C4 20.5 4.5 21 5 21H10V22H14V21H19C19.5 21 20 20.5 20 20V6L18 4L16 2" />
      <path d="M10 2H8L10 4H14L16 2H14" />
      <path d="M13 4C13 3 13 2 12 2C11 2 11 3 11 4" />
      <path d="M10 21V22H14V21" />
      <text 
        x="12" 
        y="15" 
        fontSize="8" 
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
