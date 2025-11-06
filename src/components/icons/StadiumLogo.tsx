export function StadiumLogo({ className = "" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 120 80" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#2d5016', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1a3009', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="trackGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#8b4513', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#5c2e0a', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      <ellipse cx="60" cy="45" rx="55" ry="30" fill="url(#trackGradient)" />
      
      <ellipse cx="60" cy="45" rx="45" ry="24" fill="url(#fieldGradient)" />
      
      <line x1="15" y1="45" x2="105" y2="45" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
      <line x1="35" y1="28" x2="35" y2="62" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
      <line x1="85" y1="28" x2="85" y2="62" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
      <line x1="60" y1="24" x2="60" y2="66" stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
      
      <ellipse cx="60" cy="45" rx="8" ry="5" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.5" />
      
      <path d="M 10 50 Q 10 20, 30 18" fill="none" stroke="#2c3e50" strokeWidth="2" opacity="0.7" />
      <path d="M 110 50 Q 110 20, 90 18" fill="none" stroke="#2c3e50" strokeWidth="2" opacity="0.7" />
      
      <rect x="8" y="28" width="3" height="20" fill="#34495e" opacity="0.8" />
      <rect x="109" y="28" width="3" height="20" fill="#34495e" opacity="0.8" />
      <rect x="20" y="22" width="3" height="26" fill="#34495e" opacity="0.8" />
      <rect x="97" y="22" width="3" height="26" fill="#34495e" opacity="0.8" />
      <rect x="32" y="18" width="3" height="30" fill="#34495e" opacity="0.8" />
      <rect x="85" y="18" width="3" height="30" fill="#34495e" opacity="0.8" />
      
      <circle cx="9.5" cy="28" r="1.5" fill="#f39c12" opacity="0.9" />
      <circle cx="110.5" cy="28" r="1.5" fill="#f39c12" opacity="0.9" />
      <circle cx="21.5" cy="22" r="1.5" fill="#f39c12" opacity="0.9" />
      <circle cx="98.5" cy="22" r="1.5" fill="#f39c12" opacity="0.9" />
      <circle cx="33.5" cy="18" r="1.5" fill="#f39c12" opacity="0.9" />
      <circle cx="86.5" cy="18" r="1.5" fill="#f39c12" opacity="0.9" />
    </svg>
  );
}
