interface FootballHelmetIconProps {
  className?: string
  size?: number
}

export default function FootballHelmetIcon({ className, size = 18 }: FootballHelmetIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15.5 10C15.5 7.2 13.8 4.8 11 4C9.8 3.6 8.5 3.6 7.3 4C5.6 4.8 4.5 6.5 4.5 8.5C4.5 9.7 4.9 10.8 5.7 12L6.1 12.5C6.5 13.2 7.1 13.6 7.9 13.8L9.2 14.1C9.6 14.2 10 14.2 10.4 14.2C11.2 14.2 11.8 14 12.3 13.4L13.1 12.5C13.9 11.4 14.8 10.1 14.8 8.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 9.5L16.5 10.5C16.8 10.6 17 10.9 17 11.2C17 11.5 16.8 11.8 16.5 11.9L14.3 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.5L7 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M8.5 8.5L8.5 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M10 8.5L10 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M7 9.8L10 9.8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M7 11L10 11"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}
