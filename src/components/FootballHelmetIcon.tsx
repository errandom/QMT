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
        d="M25 8.5C25 5.5 22 3 17.5 3C12.5 3 8 5.5 6.5 9.5C5.5 12 5 14.5 5 16.5C5 18.5 5.5 20 6.5 21.5C7 22.5 8 23.5 9.5 24.5C10.5 25 11.5 25.5 13 26C14 26.3 15 26.5 16 26.5C17 26.5 18 26.3 19 26"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M24.5 9C25 9.5 26 11 26.5 13C27 15 27 17 26.5 18.5C26 20 25 21 24 21.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <circle
        cx="23.5"
        cy="15"
        r="1.2"
        fill="currentColor"
      />
      
      <path
        d="M6 17.5L8.5 22.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 15L10.5 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10 12.5L12.5 17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 10L14.5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 8L16 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      
      <path
        d="M5 18C4.5 19 4 20.5 4 22C4 24 5 26 7 27C8 27.5 9 28 10.5 28C11.5 28 12.5 27.5 13 27"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
