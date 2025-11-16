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
        <path d="M18.5 4.5C17.2 3.2 15.2 2.5 12.8 3.2L4.2 6.3C2.8 6.8 2 8.3 2.5 9.7L7.8 23.5C8.3 24.9 9.8 25.7 11.2 25.2L19.8 22.1C21.2 21.6 22 20.1 21.5 18.7L16.2 4.9C16 4.6 15.8 4.3 15.5 4.1L18.5 4.5Z" transform="translate(0.5, -1.5)" />
        <path d="M19.3 7.8L17.5 7.2M18.5 10.5L16.7 9.9M17.7 13.2L15.9 12.6M16.9 15.9L15.1 15.3M16.1 18.6L14.3 18" 
          stroke="white" 
          strokeWidth="2" 
          strokeLinecap="round"
          fill="none"
          transform="translate(0.5, -1.5)"
        />
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
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6.5 4.5L4 6C3.2 6.5 2.5 7.5 2.8 8.8L6 19C6.3 20.3 7.3 21 8.5 20.5L18 16.5C19.2 16 20 15 19.7 13.7L16.5 3.5C16.2 2.2 15.2 1.5 14 2L6.5 4.5Z" transform="translate(1, 1)" />
      <path d="M4.5 8L6.5 7.3M5 11L7 10.3M5.5 14L7.5 13.3M6 17L8 16.3M6.5 20L8.5 19.3" transform="translate(5, -1)" />
    </svg>
  )
}
