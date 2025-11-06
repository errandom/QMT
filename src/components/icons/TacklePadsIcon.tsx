interface TacklePadsIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function TacklePadsIcon({ size = 24, className = '', filled = false }: TacklePadsIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <path d="M7 4C6 4 5 5 5 6V9L7 10L9 9V6C9 5 8 4 7 4Z" opacity="0.9"/>
        <path d="M17 4C16 4 15 5 15 6V9L17 10L19 9V6C19 5 18 4 17 4Z" opacity="0.9"/>
        <path d="M9 10L7 10L5 11V18C5 19 6 20 7 20H9V10Z" opacity="0.8"/>
        <path d="M15 10L17 10L19 11V18C19 19 18 20 17 20H15V10Z" opacity="0.8"/>
        <rect x="9" y="10" width="6" height="10" rx="1" opacity="0.7"/>
        <line x1="9" y1="13" x2="15" y2="13" stroke="white" strokeWidth="1" opacity="0.5"/>
        <line x1="9" y1="16" x2="15" y2="16" stroke="white" strokeWidth="1" opacity="0.5"/>
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
      <path d="M7 4C6 4 5 5 5 6V9L7 10L9 9V6C9 5 8 4 7 4Z"/>
      <path d="M17 4C16 4 15 5 15 6V9L17 10L19 9V6C19 5 18 4 17 4Z"/>
      <path d="M9 10L7 10L5 11V18C5 19 6 20 7 20H9V10Z"/>
      <path d="M15 10L17 10L19 11V18C19 19 18 20 17 20H15V10Z"/>
      <rect x="9" y="10" width="6" height="10" rx="1"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="16" x2="15" y2="16"/>
    </svg>
  );
}
