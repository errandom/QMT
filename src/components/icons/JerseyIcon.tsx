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
        <path d="M8 3L5 5L3 7V12L5 13V20C5 20.5 5.5 21 6 21H18C18.5 21 19 20.5 19 20V13L21 12V7L19 5L16 3H14.5C14.5 4 13.5 5 12 5C10.5 5 9.5 4 9.5 3H8Z" />
        <path d="M3 7L5 5L5 13L3 12V7Z" opacity="0.7" />
        <path d="M21 7L19 5L19 13L21 12V7Z" opacity="0.7" />
        <text 
          x="12" 
          y="15.5" 
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
      <path d="M8 3L5 5L3 7V12L5 13V20C5 20.5 5.5 21 6 21H18C18.5 21 19 20.5 19 20V13L21 12V7L19 5L16 3" />
      <path d="M8 3H9.5C9.5 4 10.5 5 12 5C13.5 5 14.5 4 14.5 3H16" />
      <path d="M3 7L5 5L5 13L3 12V7Z" />
      <path d="M21 7L19 5L19 13L21 12V7Z" />
      <text 
        x="12" 
        y="15.5" 
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
