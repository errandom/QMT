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
      <path
        d="M12 3C9.5 3 7.5 4.5 7 6.5L6 10C6 10 5.5 11 6.5 12.5C7.5 14 8 14.5 8 15.5V19C8 20 8.5 21 10 21H14C15.5 21 16 20 16 19V15.5C16 14.5 16.5 14 17.5 12.5C18.5 11 18 10 18 10L17 6.5C16.5 4.5 14.5 3 12 3Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={isFilled ? 'currentColor' : 'none'}
        fillOpacity={isFilled ? 0.2 : 0}
      />
      <path
        d="M7 6.5C7 6.5 8 5.5 10 5.5H14C16 5.5 17 6.5 17 6.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 10H16"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <circle
        cx="10"
        cy="7.5"
        r="0.8"
        fill="currentColor"
      />
      <circle
        cx="14"
        cy="7.5"
        r="0.8"
        fill="currentColor"
      />
      <path
        d="M9 13H15"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M9.5 16H14.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M4 12L6 11"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M20 12L18 11"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
