interface FootballIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function FootballIcon({ size = 24, className = '', filled = false }: FootballIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <circle cx="12" cy="12" r="9" />
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
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
