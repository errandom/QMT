interface ArenaIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

export function ArenaIcon({ size = 24, className = '', filled = false }: ArenaIconProps) {
  if (filled) {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={className}
      >
        <ellipse cx="12" cy="12" rx="10" ry="8" opacity="0.2"/>
        
        <ellipse cx="12" cy="12" rx="10" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        
        <ellipse cx="12" cy="12" rx="7.5" ry="6" opacity="0.15"/>
        <ellipse cx="12" cy="12" rx="7.5" ry="6" fill="none" stroke="currentColor" strokeWidth="1"/>
        
        <ellipse cx="12" cy="12" rx="5" ry="4" opacity="0.3"/>
        
        <line x1="2.5" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
        <line x1="17" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
        
        <line x1="12" y1="4.5" x2="12" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
        <line x1="12" y1="16" x2="12" y2="19.5" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
        
        <circle cx="5" cy="8" r="0.8" opacity="0.7"/>
        <circle cx="19" cy="8" r="0.8" opacity="0.7"/>
        <circle cx="5" cy="16" r="0.8" opacity="0.7"/>
        <circle cx="19" cy="16" r="0.8" opacity="0.7"/>
      </svg>
    );
  }

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor" 
      strokeWidth="1.5"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <ellipse cx="12" cy="12" rx="10" ry="8"/>
      
      <ellipse cx="12" cy="12" rx="7.5" ry="6"/>
      
      <ellipse cx="12" cy="12" rx="5" ry="4"/>
      
      <line x1="2.5" y1="12" x2="7" y2="12"/>
      <line x1="17" y1="12" x2="21.5" y2="12"/>
      
      <line x1="12" y1="4.5" x2="12" y2="8"/>
      <line x1="12" y1="16" x2="12" y2="19.5"/>
      
      <circle cx="5" cy="8" r="0.8"/>
      <circle cx="19" cy="8" r="0.8"/>
      <circle cx="5" cy="16" r="0.8"/>
      <circle cx="19" cy="16" r="0.8"/>
    </svg>
  );
}
