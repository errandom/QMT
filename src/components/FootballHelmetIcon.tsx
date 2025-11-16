interface FootballHelmetIconProps {
  size?: number
  className?: string
  filled?: boolean
}

export default function FootballHelmetIcon({ size = 24, className = '', filled = false }: FootballHelmetIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <ellipse cx="12" cy="5" rx="2.5" ry="2" opacity="0.9"/>
        <path d="M12 7C9.5 7 8 8 7 9L6 11H8L9 9.5C9.5 9 10.5 8.5 12 8.5C13.5 8.5 14.5 9 15 9.5L16 11H18L17 9C16 8 14.5 7 12 7Z"/>
        <rect x="8" y="10" width="8" height="7" rx="1" opacity="0.9"/>
        <path d="M7 11L5 13V16L7 17V11Z" opacity="0.8"/>
        <path d="M17 11V17L19 16V13L17 11Z" opacity="0.8"/>
        <rect x="9.5" y="16.5" width="2" height="5.5" rx="0.5"/>
        <rect x="12.5" y="16.5" width="2" height="5.5" rx="0.5"/>
        <rect x="8.5" y="21" width="3" height="1.5" rx="0.5" opacity="0.7"/>
        <rect x="11.5" y="21" width="3" height="1.5" rx="0.5" opacity="0.7"/>
      </svg>
    )
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
      <ellipse cx="12" cy="5" rx="2.5" ry="2"/>
      <path d="M12 7C9.5 7 8 8 7 9L6 11H8L9 9.5C9.5 9 10.5 8.5 12 8.5C13.5 8.5 14.5 9 15 9.5L16 11H18L17 9C16 8 14.5 7 12 7Z"/>
      <rect x="8" y="10" width="8" height="7" rx="1"/>
      <path d="M7 11L5 13V16L7 17"/>
      <path d="M17 11L19 13V16L17 17"/>
      <rect x="9.5" y="16.5" width="2" height="5.5" rx="0.5"/>
      <rect x="12.5" y="16.5" width="2" height="5.5" rx="0.5"/>
      <rect x="8.5" y="21" width="3" height="1.5" rx="0.5"/>
      <rect x="11.5" y="21" width="3" height="1.5" rx="0.5"/>
    </svg>
  )
}
