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
        d="M8 16C8 11 11 7 16 7C20.5 7 24 10 25 14C25.5 16 25.5 18 25 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M8 16L8 20C8 22 8.5 24 10 26C11 27 12.5 28 14 28.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <rect
        x="19"
        y="12"
        width="7"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      
      <line
        x1="22.5"
        y1="14"
        x2="22.5"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
