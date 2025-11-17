import { FootballHelmet } from '@phosphor-icons/react';

interface FootballHelmetIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function FootballHelmetIcon({ size = 24, className = '', filled = false }: FootballHelmetIconProps) {
  return (
    <FootballHelmet 
      size={size}
      className={className}
      weight={filled ? 'fill' : 'regular'}
    />
  );
}
