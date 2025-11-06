interface HelmetIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function HelmetIcon({ size = 24, className = '', filled = false }: HelmetIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <path d="M12 3C7.03 3 3 7.03 3 12v4c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-4c0-2.76 2.24-5 5-5s5 2.24 5 5v4c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-4c0-4.97-4.03-9-9-9z"/>
        <rect x="8" y="11" width="8" height="4" rx="1" fill="currentColor" opacity="0.7"/>
        <path d="M5 16h2v2c0 1.1-.9 2-2 2s-2-.9-2-2c0-1.1.9-2 2-2zm14 0h2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2v-2z"/>
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
      <path d="M12 3C7.03 3 3 7.03 3 12v4c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-4c0-2.76 2.24-5 5-5s5 2.24 5 5v4c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-4c0-4.97-4.03-9-9-9z"/>
      <rect x="8.5" y="11.5" width="7" height="3" rx="0.5"/>
      <path d="M5 16h2v2c0 1.1-.9 2-2 2s-2-.9-2-2c0-1.1.9-2 2-2z"/>
      <path d="M19 16h2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2v-2z"/>
    </svg>
  );
}
