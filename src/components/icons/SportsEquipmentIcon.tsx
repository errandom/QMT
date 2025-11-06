interface SportsEquipmentIconProps {
  size?: number;
  weight?: 'regular' | 'bold' | 'fill';
  className?: string;
}

export function SportsEquipmentIcon({ size = 24, weight = 'regular', className = '' }: SportsEquipmentIconProps) {
  const strokeWidth = weight === 'bold' ? 2.5 : weight === 'fill' ? 0 : 1.5;
  const isFilled = weight === 'fill';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <ellipse
        cx="8"
        cy="11"
        rx="3.5"
        ry="5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={isFilled ? 'currentColor' : 'none'}
        fillOpacity={isFilled ? 0.2 : 0}
      />
      <path
        d="M8 8V14"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M5.5 11H10.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M14 4H20C20.5 4 21 4.5 21 5V9C21 9.5 20.5 10 20 10H17.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={isFilled ? 'currentColor' : 'none'}
        fillOpacity={isFilled ? 0.15 : 0}
      />
      <path
        d="M14 4C14 4 15.5 5 16.5 7C17 8 17.5 9 17.5 10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx="18"
        cy="7"
        r="0.8"
        fill="currentColor"
      />
      <path
        d="M3 18L5 17.5L6.5 20L8 19L9 21L11 20"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M15 14L17 15L18 13L20 14L21 12"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
