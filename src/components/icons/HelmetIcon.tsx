interface HelmetIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function HelmetIcon({ size = 24, className = '', filled = false }: HelmetIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" 
      strokeWidth={filled ? '0' : '2'}
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 16c0-2.8 1.2-5.3 3.1-7.1C7.9 7 10.4 6 13 6c2.6 0 5.1 1 6.9 2.9C21.8 10.7 23 13.2 23 16v2H3v-2z" />
      <path d="M3 18h20v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-1z" />
      <rect x="9" y="12" width="6" height="3" rx="0.5" />
      <line x1="6" y1="14" x2="8" y2="14" strokeWidth="2.5" />
      <line x1="16" y1="14" x2="18" y2="14" strokeWidth="2.5" />
    </svg>
  );
}
