interface ZurichRenegadesLogoProps {
  className?: string;
  size?: number;
}

export function ZurichRenegadesLogo({ className, size = 120 }: ZurichRenegadesLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="100"
        cy="100"
        r="95"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      
      <g transform="translate(30, 85)">
        <path
          d="M 5 35 L 5 25 L 15 20 L 15 35 M 20 35 L 20 15 L 30 10 L 30 35 M 35 35 L 35 5 L 50 0 L 50 35 M 55 35 L 55 8 L 70 5 L 70 35 M 75 35 L 75 18 L 85 15 L 85 35 M 90 35 L 90 22 L 100 20 L 100 35 M 105 35 L 105 25 L 115 23 L 115 35 M 120 35 L 120 28 L 130 27 L 130 35 M 135 35 L 135 30 L 140 30 L 140 35"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
      
      <g transform="translate(50, 50)">
        <ellipse
          cx="50"
          cy="50"
          rx="35"
          ry="30"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        
        <line
          x1="50"
          y1="20"
          x2="50"
          y2="80"
          stroke="currentColor"
          strokeWidth="2"
        />
        
        <line
          x1="20"
          y1="50"
          x2="80"
          y2="50"
          stroke="currentColor"
          strokeWidth="2"
        />
        
        <line
          x1="28"
          y1="32"
          x2="28"
          y2="68"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        
        <line
          x1="36"
          y1="28"
          x2="36"
          y2="72"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        
        <line
          x1="44"
          y1="24"
          x2="44"
          y2="76"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        
        <line
          x1="56"
          y1="24"
          x2="56"
          y2="76"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        
        <line
          x1="64"
          y1="28"
          x2="64"
          y2="72"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        
        <line
          x1="72"
          y1="32"
          x2="72"
          y2="68"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </g>
      
      <path
        d="M 40 145 Q 100 155 160 145"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      
      <text
        x="100"
        y="170"
        textAnchor="middle"
        fill="currentColor"
        fontSize="14"
        fontWeight="700"
        letterSpacing="2"
      >
        ZURICH
      </text>
      
      <text
        x="100"
        y="185"
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="600"
        letterSpacing="1.5"
      >
        RENEGADES
      </text>
    </svg>
  );
}
