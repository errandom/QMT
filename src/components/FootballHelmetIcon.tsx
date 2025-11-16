interface FootballHelmetIconProps {
  className?: string
  size?: number
}

export default function FootballHelmetIcon({ className, size = 18 }: FootballHelmetIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M4 13C4 8.5 6 5 9 3.5C10.5 2.8 13.5 2.8 15 3.5C18 5 20 8.5 20 13V15C20 16.5 19 17.8 17.5 18.5L16 19.2C14.5 20 11.5 20 10 19.2L8.5 18.5C7 17.8 6 16.5 6 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="6"
        y="10"
        width="6"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      <line
        x1="7.5"
        y1="12"
        x2="10.5"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="7.5"
        y1="14.5"
        x2="10.5"
        y2="14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18 14H20.5C21.3 14 22 14.7 22 15.5C22 16.3 21.3 17 20.5 17H18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
