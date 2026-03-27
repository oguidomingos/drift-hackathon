import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from 'remotion';

const COLORS = {
  bg: '#0A0B14',
  primary: '#00D4AA',
  secondary: '#7B61FF',
  text: '#FFFFFF',
  textMuted: '#8B8D97',
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const summaryItems = [
    'Genetically optimized parameters',
    'Multi-market rotation (SOL, BTC, ETH)',
    '5-trigger risk management framework',
    'Walk-forward validated (no overfitting)',
    'Real trades on Solana mainnet',
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: 'Inter, system-ui, sans-serif',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${COLORS.primary}11 0%, transparent 60%)`,
        }}
      />

      <div style={{ textAlign: 'center', opacity: fadeIn, maxWidth: 900 }}>
        <h2
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: COLORS.text,
            marginBottom: 40,
          }}
        >
          Delta-Neutral Funding Rate Vault
        </h2>

        <div style={{ textAlign: 'left', margin: '0 auto', maxWidth: 600 }}>
          {summaryItems.map((item, i) => {
            const itemOpacity = interpolate(
              frame - 30 - i * 15,
              [0, 10],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            return (
              <div
                key={i}
                style={{
                  opacity: itemOpacity,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 0',
                }}
              >
                <span style={{ color: COLORS.primary, fontSize: 20 }}>✓</span>
                <span style={{ fontSize: 22, color: COLORS.text }}>{item}</span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 50,
            opacity: interpolate(frame - 120, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <p
            style={{
              fontSize: 24,
              color: COLORS.primary,
              fontWeight: 600,
            }}
          >
            Built for the Ranger Hackathon
          </p>
          <p
            style={{
              fontSize: 18,
              color: COLORS.textMuted,
              marginTop: 8,
            }}
          >
            Drift Protocol • Solana
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
