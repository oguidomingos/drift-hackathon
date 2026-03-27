import React from 'react';
import { interpolate } from 'remotion';

interface AnimatedChartProps {
  data: number[];
  color: string;
  label: string;
  frame: number;
  animationDuration: number; // frames to fully draw
  width?: number;
  height?: number;
}

export const AnimatedChart: React.FC<AnimatedChartProps> = ({
  data,
  color,
  label,
  frame,
  animationDuration,
  width = 1760,
  height = 350,
}) => {
  if (data.length === 0) return null;

  const padding = { top: 40, right: 20, bottom: 40, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // How many points to show based on animation progress
  const progress = interpolate(frame, [0, animationDuration], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const visibleCount = Math.max(2, Math.floor(data.length * progress));

  // Generate SVG path
  const points = data.slice(0, visibleCount).map((val, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + (1 - (val - min) / range) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${padding.top + chartHeight}` +
    ` L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Y-axis labels
  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const val = min + (range * (4 - i)) / 4;
    const y = padding.top + (i / 4) * chartHeight;
    return { val: `$${val.toFixed(0)}`, y };
  });

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {yLabels.map((label, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={label.y}
            x2={width - padding.right}
            y2={label.y}
            stroke="#252738"
            strokeWidth={1}
          />
          <text
            x={padding.left - 10}
            y={label.y + 5}
            textAnchor="end"
            fill="#8B8D97"
            fontSize={14}
            fontFamily="Inter, system-ui"
          >
            {label.val}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={`${color}15`} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />

      {/* Current value dot */}
      {points.length > 0 && (
        <>
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={5}
            fill={color}
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={10}
            fill={`${color}33`}
          />
        </>
      )}

      {/* Label */}
      <text
        x={padding.left}
        y={padding.top - 15}
        fill="#8B8D97"
        fontSize={16}
        fontFamily="Inter, system-ui"
      >
        {label}
      </text>

      {/* Current value */}
      {points.length > 0 && (
        <text
          x={width - padding.right}
          y={padding.top - 15}
          textAnchor="end"
          fill={color}
          fontSize={20}
          fontWeight={700}
          fontFamily="Inter, system-ui"
        >
          ${data[visibleCount - 1].toFixed(2)}
        </text>
      )}
    </svg>
  );
};
