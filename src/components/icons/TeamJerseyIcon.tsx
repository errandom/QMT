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
        <path d="M12 2C10.5 2 9.5 2.5 9 3L6 4L4 8V11L6 10V22H18V10L20 11V8L18 4L15 3C14.5 2.5 13.5 2 12 2Z" opacity="0.9"/>
        <circle cx="12" cy="2.5" r="1.5"/>
        <path d="M9.5 10H10.5V16H9.5V10Z" fill="white" opacity="0.9"/>
        <path d="M10.5 10H13V11H11V14H13V16H10.5V10Z" fill="white" opacity="0.9"/>
        <path d="M13 10H14.5V11.5H13V14.5H14.5V16H13V10Z" fill="white" opacity="0.9"/>
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
      <circle cx="12" cy="2.5" r="1.5"/>
      <path d="M12 4C10.5 4 9.5 4.5 9 5L6 6L4 10V13L6 12V22H18V12L20 13V10L18 6L15 5C14.5 4.5 13.5 4 12 4Z"/>
      <path d="M9.5 10H10.5V16H9.5V10Z"/>
      <path d="M10.5 10H13V11H11V14H13V16H10.5V10Z"/>
      <path d="M13 10H14.5V11.5H13V14.5H14.5V16H13V10Z"/>
    </svg>
  );
}
