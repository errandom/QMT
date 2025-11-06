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
        <path d="M12 4C8 4 5 6 4 9V16C4 18 5 20 7 20H9V18H8C7 18 6 17 6 16V10C6 8 8 6 12 6C16 6 18 8 18 10V16C18 17 17 18 16 18H15V20H17C19 20 20 18 20 16V9C20 6 16 4 12 4Z" />
        <rect x="3" y="12" width="4" height="4" rx="1" opacity="0.8"/>
        <rect x="17" y="12" width="4" height="4" rx="1" opacity="0.8"/>
        <path d="M9 16C9 16.5 9.5 17 10 17H14C14.5 17 15 16.5 15 16V14H9V16Z" opacity="0.6"/>
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
      <path d="M12 4C8 4 5 6 4 9V16C4 18 5 20 7 20H9V18H8C7 18 6 17 6 16V10C6 8 8 6 12 6C16 6 18 8 18 10V16C18 17 17 18 16 18H15V20H17C19 20 20 18 20 16V9C20 6 16 4 12 4Z"/>
      <rect x="3" y="12" width="4" height="4" rx="1"/>
      <rect x="17" y="12" width="4" height="4" rx="1"/>
      <path d="M9 14H15V16C15 16.5 14.5 17 14 17H10C9.5 17 9 16.5 9 16V14Z"/>
    </svg>
  );
}
