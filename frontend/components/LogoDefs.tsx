export default function LogoDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="fg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#243a75" />
          <stop offset="1" stopColor="#3e60ab" />
        </linearGradient>
        <linearGradient id="plg" x1="250" y1="372" x2="250" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#243a75" />
          <stop offset="1" stopColor="#3e60ab" />
        </linearGradient>
        <symbol id="finmark" viewBox="0 0 500 500">
          <rect x="0" y="0" width="500" height="500" rx="120" fill="url(#fg)" />
          <path fill="#fff" d="M373.84,139.28l-21.55,34.52c-5.45,8.73-15.02,14.04-25.32,14.04h-70.66c-9.84,0-19.05,4.85-24.61,12.96l-13.88,20.24c-2.58,3.76.11,8.87,4.67,8.87h78.23c5.94,0,9.57,6.52,6.44,11.56l-24.98,40.36c-3.98,6.42-10.99,10.3-18.54,10.35-18.65.13-77.19,35.69-129.05,78.71-5.11,4.24-12.19-2-8.62-7.6l68.97-108.08c6.53-10.23-.78-23.65-12.92-23.71l-29.97-.15c-5.96-.03-9.55-6.61-6.36-11.64l34.51-54.37c14.87-23.42,40.67-37.61,68.41-37.63l118.79-.06c5.95,0,9.58,6.54,6.43,11.59Z" />
        </symbol>
      </defs>
    </svg>
  );
}
