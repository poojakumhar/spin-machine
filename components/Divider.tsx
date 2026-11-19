/** Small gold flourish divider that sits above and below a word. Pure SVG, two-tone so it reads as a gold bar. */
export function Divider({ flip = false }: { flip?: boolean }) {
  const d = "M4 14 H92 M92 14 C102 14 104 6 112 6 M92 14 C102 14 104 22 112 22 M148 14 H236 M148 14 C138 14 136 6 128 6 M148 14 C138 14 136 22 128 22";
  return (
    <svg className="divider" viewBox="0 0 240 28" aria-hidden style={flip ? { transform: "scaleY(-1)" } : undefined}>
      <g fill="none" strokeLinecap="round">
        <path d={d} stroke="#9a5f0a" strokeWidth="4.4" />
        <path d={d} stroke="#f2b829" strokeWidth="2.6" />
        <path d={d} stroke="#fff1b0" strokeWidth="0.9" transform="translate(0 -0.8)" />
      </g>
      <path d="M120 4 L131 14 L120 24 L109 14Z" fill="#f2b829" stroke="#9a5f0a" strokeWidth="1.6" />
      <path d="M120 8 L126 14 L120 20 L114 14Z" fill="#a40d1b" />
    </svg>
  );
}
