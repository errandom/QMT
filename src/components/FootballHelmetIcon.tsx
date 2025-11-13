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
        d="M18 12C18 8.5 16 5.5 12.5 4.5C11 4 9.5 4 8 4.5C6 5.5 4.5 7.5 4.5 10C4.5 11.5 5 13 6 14.5L6.5 15.2C7 16 7.8 16.5 8.8 16.8L10.5 17.2C11 17.3 11.5 17.3 12 17.3C13 17.3 13.8 17 14.5 16.3L15.5 15.2C16.5 13.8 17.5 12.2 17.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 11.5L19.8 12.8C20.2 13 20.5 13.3 20.5 13.8C20.5 14.3 20.2 14.6 19.8 14.8L17 16.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10L7.5 14.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M9.5 10L9.5 14.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M11.5 10L11.5 14.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M7.5 11.5L11.5 11.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M7.5 13L11.5 13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
