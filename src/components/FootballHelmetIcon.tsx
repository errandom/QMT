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
        d="M18 5C18 5 14.5 3 10.5 3C7 3 4 5.5 4 9.5C4 12 5 14.5 6.5 16.5C7.5 17.8 8.5 18.5 10 19C10.5 19.2 11 19.3 11.5 19.3C12 19.3 13 19.2 13.5 19C14.5 18.6 15 18 15 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path
        d="M17.5 6C18.5 6.5 19 7 19 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle
        cx="16"
        cy="13"
        r="1"
        fill="currentColor"
      />
      <path
        d="M4.5 13C4.5 13 3.5 13.5 3 14.5C2.5 15.5 2.5 16.5 3 17.5C3.5 18.5 4.5 19 5.5 19C6 19 6.5 18.8 7 18.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M7 11L10.5 16.5M5.5 13L9 18.5M8 9.5L11.5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="6"
        y="13.5"
        width="2.2"
        height="1.8"
        rx="0.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="8.5"
        y="13.5"
        width="2.2"
        height="1.8"
        rx="0.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="6"
        y="15.5"
        width="2.2"
        height="1.8"
        rx="0.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="8.5"
        y="15.5"
        width="2.2"
        height="1.8"
        rx="0.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}
