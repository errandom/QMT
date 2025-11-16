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
        d="M7 14C7 9 10 5 16 5C20.5 5 24 7.5 25 11.5C25.5 13.5 25.5 15.5 25 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      
      <path
        d="M7 14C6.5 15 6 16.5 6 18.5C6 20.5 6.5 22 7.5 23.5C8.5 25 10 26 12 27"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      
      <rect
        x="18"
        y="11"
        width="8"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="currentColor"
        fillOpacity="0.15"
      />
      
      <line
        x1="22"
        y1="13"
        x2="22"
        y2="19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      
      <path
        d="M8 16L10 20M10 14L12 18M12 12L14 16M14 10L16 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      
      <path
        d="M7 20C6 21.5 5.5 23 5.5 25C5.5 26.5 6.5 28 8.5 28.5C9.5 28.8 10.5 29 11.5 29"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
}
