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
        d="M18 12.5C18 9.2 16.5 6.3 14 4.8C12.7 4 11.3 4 10 4.8C7.5 6.3 6 9.2 6 12.5V14C6 15.7 6.8 17.2 8.2 18L9.5 18.8C10.4 19.3 11.6 19.3 12.5 18.8L13.8 18C15.2 17.2 16 15.7 16 14V13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 13.5H19.5C20.3 13.5 21 14.2 21 15C21 15.8 20.3 16.5 19.5 16.5H17.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 11H9.5C10.3 11 11 11.7 11 12.5V13.5C11 14.3 10.3 15 9.5 15H9C8.2 15 7.5 14.3 7.5 13.5V12.5C7.5 11.7 8.2 11 9 11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="9"
        y1="13"
        x2="5"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="15"
        x2="5.5"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="11"
        x2="5.5"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
