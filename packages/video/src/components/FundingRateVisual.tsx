import React from 'react';
import { interpolate } from 'remotion';

interface FundingRateVisualProps {
  rates: { symbol: string; rate: number }[];
  frame: number;
  delay: number;
}

const COLORS = {
  positive: '#00D4AA',
  negative: '#FF6B6B',
  bg: '#151623',
  border: '#252738',
  text: '#FFFFFF',
  textMuted: '#8B8D97',
};

export const FundingRateVisual: React.FC<FundingRateVisualProps> = ({
  rates,
  frame,
  delay,
}) => {
  const maxRate = Math.max(...rates.map((r) => Math.abs(r.rate)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {rates.map((item, i) => {
        const barWidth = (Math.abs(item.rate) / maxRate) * 100;
        const isPositive = item.rate >= 0;
        const color = isPositive ? COLORS.positive : COLORS.negative;

        const opacity = interpolate(frame - delay - i * 10, [0, 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const barScale = interpolate(frame - delay - i * 10, [0, 15], [0, barWidth], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              opacity,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: COLORS.bg,
              borderRadius: 12,
              padding: '14px 20px',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: COLORS.text,
                width: 100,
              }}
            >
              {item.symbol}
            </span>

            <div
              style={{
                flex: 1,
                height: 24,
                background: '#1A1B2E',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${barScale}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                  borderRadius: 6,
                  transition: 'width 0.3s',
                }}
              />
            </div>

            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color,
                width: 100,
                textAlign: 'right',
              }}
            >
              {isPositive ? '+' : ''}
              {(item.rate * 100).toFixed(4)}%/h
            </span>
          </div>
        );
      })}
    </div>
  );
};
