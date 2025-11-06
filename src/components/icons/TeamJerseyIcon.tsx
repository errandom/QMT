interface TeamJerseyIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function TeamJerseyIcon({ size = 24, className = '', filled = false }: TeamJerseyIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <path d="M8 4L6 6V9L7 8.5V22H17V8.5L18 9V6L16 4L14 3H10L8 4Z"/>
        <text 
          x="12" 
          y="15" 
          fontSize="7" 
          fontWeight="bold" 
          textAnchor="middle" 
          fill="white"
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
      <path d="M8 4L6 6V9L7 8.5V22H17V8.5L18 9V6L16 4L14 3H10L8 4Z"/>
      <text 
        x="12" 
        y="15" 
        fontSize="7" 
        fontWeight="bold" 
        textAnchor="middle" 
        fill="currentColor"
        stroke="none"
      >
        82
      </text>
    </svg>
  );
}
