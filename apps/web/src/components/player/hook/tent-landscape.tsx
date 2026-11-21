import React from "react";

/** A tent in the mountains at dusk: the product photo on Orbit's shop page. */
export function TentLandscape() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="hf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2463" />
          <stop offset="0.6" stopColor="#b4533f" />
          <stop offset="1" stopColor="#e3a14f" />
        </linearGradient>
        <linearGradient id="hf-tent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fc49a" />
          <stop offset="1" stopColor="#2a8f85" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#hf-sky)" />
      <circle cx="300" cy="96" r="26" fill="#ffd9a0" opacity="0.85" />
      <path d="M0 170 L80 90 L140 150 L210 70 L290 160 L350 110 L400 150 L400 260 L0 260 Z" fill="#1d1834" />
      <path d="M0 205 L120 150 L230 200 L330 160 L400 190 L400 260 L0 260 Z" fill="#110f1e" />
      <path d="M140 225 L205 135 L270 225 Z" fill="url(#hf-tent)" />
      <path d="M205 135 L190 225 L220 225 Z" fill="#0b2a26" />
      <path d="M120 226 L290 226" stroke="#0b0a12" strokeWidth="3" />
    </svg>
  );
}
