import React from 'react';
import { interpolate } from 'remotion';

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
  frame: number;
  delay: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  color,
  frame,
  delay,
}) => {
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame - delay, [0, 15], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        background: '#151623',
        borderRadius: 14,
        padding: '20px 24px',
        border: '1px solid #252738',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: '#8B8D97',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 32,
          fontWeight: 700,
          color,
          margin: '8px 0 0 0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {value}
      </p>
    </div>
  );
};
