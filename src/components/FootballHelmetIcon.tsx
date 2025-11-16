interface FootballHelmetIconProps {
  className?: string
  size?: number
}

export default function FootballHelmetIcon({ className, size = 18 }: FootballHelmetIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M8 15C8 10 11 6 16 6C21 6 24 9 25 13C25.5 15 25.5 17 25 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M8 15C7.5 16 7 17.5 7 19.5C7 21.5 7.5 23 8.5 24.5C9.5 26 11 27 13 28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M8 21C7 22.5 6.5 24 6.5 26C6.5 27 7 28 8 28.5C9 29 10 29 11 29"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M10 13L11 16M12 11L13 14M14 9L15 12M16 8L17 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      
      <rect
        x="19"
        y="11"
        width="7"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      
      <line
        x1="22.5"
        y1="13"
        x2="22.5"
        y2="19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
