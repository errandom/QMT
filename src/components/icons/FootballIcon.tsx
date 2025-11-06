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
        <path d="M17.657 3.343a8 8 0 0 0-11.314 0l-2.828 2.828a8 8 0 0 0 0 11.314l2.828 2.828a8 8 0 0 0 11.314 0l2.828-2.828a8 8 0 0 0 0-11.314l-2.828-2.828zM10 7.5h4M9 10h6M8.5 12.5h7M9 15h6M10 17.5h4" />
        <line x1="10" y1="7.5" x2="10" y2="7.5" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="7.5" x2="14" y2="7.5" strokeWidth="2" strokeLinecap="round" />
        <line x1="9" y1="10" x2="15" y2="10" strokeWidth="2" strokeLinecap="round" />
        <line x1="8.5" y1="12.5" x2="15.5" y2="12.5" strokeWidth="2" strokeLinecap="round" />
        <line x1="9" y1="15" x2="15" y2="15" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="17.5" x2="14" y2="17.5" strokeWidth="2" strokeLinecap="round" />
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
      <path d="M17.657 3.343a8 8 0 0 0-11.314 0l-2.828 2.828a8 8 0 0 0 0 11.314l2.828 2.828a8 8 0 0 0 11.314 0l2.828-2.828a8 8 0 0 0 0-11.314l-2.828-2.828z" />
      <line x1="10" y1="7.5" x2="14" y2="7.5" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="8.5" y1="12.5" x2="15.5" y2="12.5" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="10" y1="17.5" x2="14" y2="17.5" />
    </svg>
  );
}
