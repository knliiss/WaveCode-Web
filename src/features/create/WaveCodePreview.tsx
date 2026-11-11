import { useMemo } from "react";
import { previewGeometryFromSvg } from "../../infrastructure/wavecode/preview";

interface Props {
  svg: string;
}

export function WaveCodePreview({ svg }: Props) {
  const geometry = useMemo(() => previewGeometryFromSvg(svg), [svg]);

  if (!geometry) {
    return <p className="preview-unavailable" role="status">Preview unavailable. You can still save the code.</p>;
  }

  return (
    <svg
      className="wavecode-preview"
      role="img"
      aria-label="Generated WaveCode preview"
      viewBox={geometry.viewBox}
      width={geometry.width}
      height={geometry.height}
      preserveAspectRatio="xMidYMid meet"
    >
      {geometry.capsules.map((capsule, index) => (
        <rect
          key={index}
          x={capsule.x}
          y={capsule.y}
          width={capsule.width}
          height={capsule.height}
          rx={capsule.radius}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
