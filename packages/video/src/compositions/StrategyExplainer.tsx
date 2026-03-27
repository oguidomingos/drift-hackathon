import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
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

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  frame: number;
  startFrame: number;
}> = ({ title, children, frame, startFrame }) => {
  const opacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame - startFrame, [0, 15], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        width: '100%',
      }}
    >
      <h2
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: COLORS.primary,
          marginBottom: 24,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
};

export const StrategyExplainer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 80,
      }}
    >
      {/* Phase 1: What is Funding Rate? (0-450 frames = 0-15s) */}
      <Sequence from={0} durationInFrames={450}>
        <Section title="What is a Funding Rate?" frame={frame} startFrame={0}>
          <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
            <Card
              title="Perpetual Futures"
              text="Perps have no expiry. Funding rates keep price anchored to spot."
              icon="📊"
              frame={frame}
              delay={15}
            />
            <Card
              title="Longs Pay Shorts"
              text="When funding is positive, long holders pay short holders every hour."
              icon="💰"
              frame={frame}
              delay={30}
            />
            <Card
              title="Our Edge"
              text="We short the perp to collect funding, and long the spot to hedge."
              icon="🎯"
              frame={frame}
              delay={45}
            />
          </div>
        </Section>
      </Sequence>

      {/* Phase 2: Delta-Neutral Mechanics (450-900 = 15-30s) */}
      <Sequence from={450} durationInFrames={450}>
        <Section title="Delta-Neutral Position" frame={frame} startFrame={450}>
          <div style={{ display: 'flex', gap: 60, alignItems: 'center', marginTop: 40 }}>
            <Leg label="SHORT Perp" color={COLORS.accent} frame={frame} delay={465} />
            <div style={{ fontSize: 48, color: COLORS.text }}>+</div>
            <Leg label="LONG Spot" color={COLORS.primary} frame={frame} delay={480} />
            <div style={{ fontSize: 48, color: COLORS.text }}>=</div>
            <Leg label="Δ ≈ 0" color={COLORS.secondary} frame={frame} delay={495} />
          </div>
          <p
            style={{
              fontSize: 24,
              color: COLORS.textMuted,
              marginTop: 40,
              opacity: interpolate(frame - 510, [0, 15], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            Price goes up? Perp loses, spot gains. Price goes down? Perp gains,
            spot loses. Net exposure ≈ zero. Only funding income matters.
          </p>
        </Section>
      </Sequence>

      {/* Phase 3: Multi-Market Rotation (900-1350 = 30-45s) */}
      <Sequence from={900} durationInFrames={450}>
        <Section title="Multi-Market Rotation" frame={frame} startFrame={900}>
          <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
            <MarketCard name="SOL-PERP" rate="+0.015%/h" frame={frame} delay={915} active />
            <MarketCard name="BTC-PERP" rate="+0.008%/h" frame={frame} delay={930} active={false} />
            <MarketCard name="ETH-PERP" rate="+0.012%/h" frame={frame} delay={945} active />
          </div>
          <p
            style={{
              fontSize: 22,
              color: COLORS.textMuted,
              marginTop: 30,
              opacity: interpolate(frame - 960, [0, 15], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            Capital auto-rotates to markets with highest funding rates.
            Proportional allocation weighted by rate magnitude.
          </p>
        </Section>
      </Sequence>

      {/* Phase 4: Risk Management (1350-1800 = 45-60s) */}
      <Sequence from={1350} durationInFrames={450}>
        <Section title="5 Risk Triggers" frame={frame} startFrame={1350}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            {[
              { trigger: 'Delta Drift > 2%', action: 'Rebalance legs', color: '#FFC107' },
              { trigger: 'Leverage > 3x', action: 'Reduce position', color: '#FF9800' },
              { trigger: 'Liquidation < 20%', action: 'Urgent reduce', color: '#FF5722' },
              { trigger: 'Neg. Funding > 24h', action: 'Exit market', color: '#F44336' },
              { trigger: 'Drawdown > 5%', action: 'Full exit', color: '#D32F2F' },
            ].map((item, i) => (
              <RiskRow
                key={i}
                trigger={item.trigger}
                action={item.action}
                color={item.color}
                frame={frame}
                delay={1365 + i * 20}
              />
            ))}
          </div>
        </Section>
      </Sequence>
    </AbsoluteFill>
  );
};

const Card: React.FC<{
  title: string;
  text: string;
  icon: string;
  frame: number;
  delay: number;
}> = ({ title, text, icon, frame, delay }) => {
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        flex: 1,
        background: COLORS.card,
        borderRadius: 16,
        padding: 32,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 24, color: COLORS.text, marginBottom: 12 }}>{title}</h3>
      <p style={{ fontSize: 18, color: COLORS.textMuted, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
};

const Leg: React.FC<{
  label: string;
  color: string;
  frame: number;
  delay: number;
}> = ({ label, color, frame, delay }) => {
  const scale = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        background: `${color}22`,
        border: `2px solid ${color}`,
        borderRadius: 16,
        padding: '24px 40px',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 28, fontWeight: 700, color }}>{label}</span>
    </div>
  );
};

const MarketCard: React.FC<{
  name: string;
  rate: string;
  frame: number;
  delay: number;
  active: boolean;
}> = ({ name, rate, frame, delay, active }) => {
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        flex: 1,
        background: active ? `${COLORS.primary}11` : COLORS.card,
        border: `2px solid ${active ? COLORS.primary : COLORS.border}`,
        borderRadius: 16,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <h3 style={{ fontSize: 28, color: COLORS.text }}>{name}</h3>
      <p
        style={{
          fontSize: 24,
          color: active ? COLORS.primary : COLORS.textMuted,
          fontWeight: 700,
          marginTop: 12,
        }}
      >
        {rate}
      </p>
      {active && (
        <span
          style={{
            display: 'inline-block',
            marginTop: 12,
            background: COLORS.primary,
            color: COLORS.bg,
            padding: '4px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ACTIVE
        </span>
      )}
    </div>
  );
};

const RiskRow: React.FC<{
  trigger: string;
  action: string;
  color: string;
  frame: number;
  delay: number;
}> = ({ trigger, action, color, frame, delay }) => {
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x = interpolate(frame - delay, [0, 10], [-30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        background: COLORS.card,
        borderRadius: 12,
        padding: '16px 24px',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <span style={{ fontSize: 20, color: COLORS.text, flex: 1, fontWeight: 600 }}>
        {trigger}
      </span>
      <span style={{ fontSize: 18, color }}>{action}</span>
    </div>
  );
};
