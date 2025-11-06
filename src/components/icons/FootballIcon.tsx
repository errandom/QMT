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
        <path d="M21.5 7.5c-1.4-1.4-3.5-2.3-5.8-2.5-2.3-.2-4.6.3-6.6 1.4L4.9 4.9c-.5-.5-1.3-.5-1.8 0-.5.5-.5 1.3 0 1.8l1.5 1.5C3.3 10.2 2.8 12.4 3 14.7c.2 2.3 1.1 4.4 2.5 5.8 1.4 1.4 3.5 2.3 5.8 2.5.4 0 .8.1 1.2.1 1.9 0 3.7-.6 5.4-1.6l1.5 1.5c.3.3.6.4.9.4.3 0 .6-.1.9-.4.5-.5.5-1.3 0-1.8l-1.5-1.5c1.3-2 1.8-4.3 1.6-6.6-.2-2.3-1.1-4.4-2.5-5.8l-.3-.3zM8.5 15.5c-.3-.3-.3-.8 0-1.1l5.9-5.9c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1l-5.9 5.9c-.2.2-.4.2-.6.2-.2 0-.4-.1-.5-.2zm2-4c-.3-.3-.3-.8 0-1.1l1-1c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1l-1 1c-.2.2-.4.2-.6.2-.2 0-.4-.1-.5-.2zm2 6c-.3-.3-.3-.8 0-1.1l1-1c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1l-1 1c-.2.2-.4.2-.6.2-.2 0-.4-.1-.5-.2z"/>
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
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <line x1="12" y1="6" x2="12" y2="18" />
      <line x1="8.5" y1="9" x2="8.5" y2="15" />
      <line x1="15.5" y1="9" x2="15.5" y2="15" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}
