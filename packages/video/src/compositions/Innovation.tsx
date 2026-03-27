import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Sequence,
} from 'remotion';

const COLORS = {
  bg: '#0A0B14',
  primary: '#00D4AA',
  secondary: '#7B61FF',
  accent: '#FF6B6B',
  text: '#FFFFFF',
  textMuted: '#8B8D97',
  card: '#151623',
  border: '#252738',
};

export const Innovation: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 80,
      }}
    >
      <h2
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.text,
          marginBottom: 50,
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Innovation & Edge
      </h2>

      <div style={{ display: 'flex', gap: 40, height: '70%' }}>
        {/* Genetic Algorithm */}
        <Sequence from={15} durationInFrames={735}>
          <InnovationCard
            title="Genetic Algorithm"
            subtitle="Parameter Optimization"
            items={[
              '50 individuals × 30 generations',
              '10 optimizable parameters',
              'Calmar ratio fitness function',
              'Walk-forward validation',
              '~1500 backtests in 30 min',
            ]}
            color={COLORS.secondary}
            frame={frame}
            delay={15}
          />
        </Sequence>

        {/* Multi-Market */}
        <Sequence from={120} durationInFrames={630}>
          <InnovationCard
            title="Multi-Market"
            subtitle="Smart Rotation"
            items={[
              'SOL, BTC, ETH perpetuals',
              'Proportional allocation by rate',
              'Auto-rotate to highest funding',
              'Diversification benefit',
              'Reduced single-market risk',
            ]}
            color={COLORS.primary}
            frame={frame}
            delay={120}
          />
        </Sequence>

        {/* Risk Framework */}
        <Sequence from={225} durationInFrames={525}>
          <InnovationCard
            title="Risk Framework"
            subtitle="5-Trigger System"
            items={[
              'Delta drift monitoring',
              'Leverage limits',
              'Liquidation buffers',
              'Negative funding detection',
              'Drawdown kill switch',
            ]}
            color={COLORS.accent}
            frame={frame}
            delay={225}
          />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

const InnovationCard: React.FC<{
  title: string;
  subtitle: string;
  items: string[];
  color: string;
  frame: number;
  delay: number;
}> = ({ title, subtitle, items, color, frame, delay }) => {
  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame - delay, [0, 20], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        flex: 1,
        background: COLORS.card,
        borderRadius: 20,
        padding: 36,
        border: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: 60,
          height: 4,
          background: color,
          borderRadius: 2,
          marginBottom: 20,
        }}
      />
      <h3 style={{ fontSize: 30, color: COLORS.text, margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 18, color, marginTop: 8, marginBottom: 24 }}>
        {subtitle}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, i) => {
          const itemOpacity = interpolate(
            frame - delay - 30 - i * 10,
            [0, 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          return (
            <li
              key={i}
              style={{
                opacity: itemOpacity,
                fontSize: 18,
                color: COLORS.textMuted,
                padding: '8px 0',
                borderBottom: `1px solid ${COLORS.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ color, fontSize: 14 }}>●</span>
              {item}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
