interface LocationFootballIconProps {
  size?: number;
  filled?: boolean;
  className?: string;
}

export function LocationFootballIcon({ size = 32, filled = false, className = '' }: LocationFootballIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {filled ? (
        <>
          <path
            d="M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88z"
            fill="currentColor"
          />
          <ellipse
            cx="128"
            cy="104"
            rx="32"
            ry="28"
            fill="white"
            opacity="0.95"
          />
          <path
            d="M128 80c-8 0-15.5 3.5-21 9.5M149 89.5c-5.5-6-13-9.5-21-9.5M114 104h28M118 96l-4 16M138 96l4 16"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88z"
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse
            cx="128"
            cy="104"
            rx="28"
            ry="24"
            fill="white"
            opacity="0.9"
          />
          <path
            d="M128 84c-7 0-13.5 3-18 8M146 92c-4.5-5-11-8-18-8M112 104h32M116 96l-4 16M140 96l4 16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
