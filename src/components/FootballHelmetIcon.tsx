interface FootballHelmetIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function FootballHelmetIcon({ size = 24, className = '', filled = false }: FootballHelmetIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <path d="M12 3C7.58 3 4 6.58 4 11v5c0 .55.45 1 1 1h1.5c.55 0 1-.45 1-1v-4.5c0-2.49 2.01-4.5 4.5-4.5s4.5 2.01 4.5 4.5V16c0 .55.45 1 1 1H19c.55 0 1-.45 1-1v-5c0-4.42-3.58-8-8-8z"/>
        <rect x="8" y="11" width="8" height="5" rx="1.5" fill="currentColor" opacity="0.75"/>
        <path d="M6 16h1.5v2.5c0 .83-.67 1.5-1.5 1.5h-.5c-.83 0-1.5-.67-1.5-1.5v-1c0-.83.67-1.5 1.5-1.5h.5z"/>
        <path d="M18 16h1.5c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H19c-.83 0-1.5-.67-1.5-1.5V16h.5z"/>
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
      <path d="M12 3C7.58 3 4 6.58 4 11v5c0 .55.45 1 1 1h1.5c.55 0 1-.45 1-1v-4.5c0-2.49 2.01-4.5 4.5-4.5s4.5 2.01 4.5 4.5V16c0 .55.45 1 1 1H19c.55 0 1-.45 1-1v-5c0-4.42-3.58-8-8-8z"/>
      <rect x="8" y="11" width="8" height="5" rx="1.5"/>
      <path d="M6 16h1.5v2.5c0 .83-.67 1.5-1.5 1.5h-.5c-.83 0-1.5-.67-1.5-1.5v-1c0-.83.67-1.5 1.5-1.5h.5z"/>
      <path d="M18 16h1.5c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H19c-.83 0-1.5-.67-1.5-1.5V16h.5z"/>
    </svg>
  );
}
