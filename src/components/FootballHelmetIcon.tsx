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
        d="M19.5 12C19.5 7.5 16.5 4.5 12 4.5C7.5 4.5 4.5 7.5 4.5 12C4.5 13.8 5.1 15.3 6 16.5L6.6 17.4C7.2 18.3 8.1 18.9 9.3 19.2L11.7 19.8C11.9 19.8 12.1 19.8 12.3 19.8C13.5 19.8 14.4 19.2 15 18.3L15.6 17.4C16.5 16.2 17.1 14.7 17.1 12.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.1 13.5L20.1 14.1C20.7 14.2 21 14.4 21 15C21 15.6 20.7 15.9 20.1 16.2L17.7 17.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 9.6H13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9.3"
        cy="12.6"
        r="0.6"
        fill="currentColor"
      />
      <circle
        cx="11.1"
        cy="12.6"
        r="0.6"
        fill="currentColor"
      />
      <circle
        cx="12.9"
        cy="12.6"
        r="0.6"
        fill="currentColor"
      />
    </svg>
  )
}
