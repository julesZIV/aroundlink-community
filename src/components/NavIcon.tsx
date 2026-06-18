import React from "react";

type NavIconName = "feed" | "agenda" | "institutions" | "channels" | "messages";

interface NavIconProps {
  name: NavIconName;
  size?: number;
  className?: string;
  hasNotification?: boolean;
}

export function NavIcon({ name, size = 20, className = "", hasNotification = false }: NavIconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
  };

  switch (name) {
    case "feed":
      return (
        <svg {...props}>
          <line x1="0" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="0" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="0" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="0" y1="17" x2="10" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          {hasNotification && <circle cx="18" cy="2" r="2.5" fill="#e85d45"/>}
        </svg>
      );

    case "agenda":
      return (
        <svg {...props}>
          <rect x="1" y="2" width="18" height="17" rx="3" stroke="currentColor" strokeWidth="1.8"/>
          <rect x="1" y="2" width="18" height="5" rx="3" fill="currentColor"/>
          <rect x="1" y="4" width="18" height="3" fill="currentColor"/>
          <line x1="6" y1="0" x2="6" y2="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="14" y1="0" x2="14" y2="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <rect x="7" y="10" width="6" height="6" rx="1.5" fill="currentColor"/>
        </svg>
      );

    case "institutions":
      return (
        <svg {...props}>
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M10 1 Q14 5 14 10 Q14 15 10 19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          <path d="M10 1 Q6 5 6 10 Q6 15 10 19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          <line x1="1.5" y1="10" x2="18.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      );

    case "channels":
      return (
        <svg {...props}>
          <line x1="6" y1="1" x2="4" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="14" y1="1" x2="12" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="1" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );

    case "messages":
      return (
        <svg {...props}>
          <path
            d="M1 2.5 Q1 1 2.5 1 L17.5 1 Q19 1 19 2.5 L19 13 Q19 14.5 17.5 14.5 L8.5 14.5 L5 18.5 L5 14.5 L2.5 14.5 Q1 14.5 1 13 Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"
          />
          <circle cx="6.5" cy="7.8" r="1.3" fill="currentColor"/>
          <circle cx="10" cy="7.8" r="1.3" fill="currentColor"/>
          <circle cx="13.5" cy="7.8" r="1.3" fill="currentColor"/>
        </svg>
      );
  }
}
