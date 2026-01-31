"use client";

import React from "react";

interface ContinuityLogoProps {
  className?: string;
  size?: number;
}

export const ContinuityLogo: React.FC<ContinuityLogoProps> = ({
  className = "",
  size = 32,
}) => {
  const uniqueId = React.useId();
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`grad2-${uniqueId}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      
      {/* Outer rounded square with gradient border */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        fill="none"
        stroke={`url(#grad-${uniqueId})`}
        strokeWidth="1.5"
        opacity="0.5"
      />
      
      {/* Inner flowing shape - infinity/continuity symbol simplified */}
      <path
        d="M10 16C10 13.5 12 11.5 14.5 11.5C17 11.5 18 14 18 16C18 18 17 20.5 14.5 20.5C12 20.5 10 18.5 10 16Z"
        fill={`url(#grad-${uniqueId})`}
        opacity="0.85"
      />
      <path
        d="M22 16C22 18.5 20 20.5 17.5 20.5C15 20.5 14 18 14 16C14 14 15 11.5 17.5 11.5C20 11.5 22 13.5 22 16Z"
        fill={`url(#grad2-${uniqueId})`}
        opacity="0.85"
      />
      
      {/* Center dot */}
      <circle cx="16" cy="16" r="2" fill="white" opacity="0.95" />
    </svg>
  );
};

export const ContinuityIcon: React.FC<{ className?: string; size?: number }> = ({
  className = "",
  size = 18,
}) => {
  const uniqueId = React.useId();
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`icon-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      
      {/* Simple flowing mark */}
      <path
        d="M6 10C6 8 7.5 6.5 9.5 6.5C11.5 6.5 12.5 8.5 12.5 10C12.5 11.5 11.5 13.5 9.5 13.5C7.5 13.5 6 12 6 10Z"
        fill={`url(#icon-grad-${uniqueId})`}
        opacity="0.9"
      />
      <path
        d="M14 10C14 12 12.5 13.5 10.5 13.5C8.5 13.5 7.5 11.5 7.5 10C7.5 8.5 8.5 6.5 10.5 6.5C12.5 6.5 14 8 14 10Z"
        fill={`url(#icon-grad-${uniqueId})`}
        opacity="0.6"
      />
      <circle cx="10" cy="10" r="1.25" fill="white" opacity="0.95" />
    </svg>
  );
};
