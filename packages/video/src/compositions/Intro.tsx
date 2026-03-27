import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

const COLORS = {
  bg: '#0A0B14',
  primary: '#00D4AA',
  secondary: '#7B61FF',
  text: '#FFFFFF',
  textMuted: '#8B8D97',
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const titleY = spring({ frame, fps, config: { damping: 200 } }) * -30 + 30;

  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const teamOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const glowScale = interpolate(frame, [0, 450], [0.8, 1.2], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.primary}22 0%, transparent 70%)`,
          transform: `scale(${glowScale})`,
        }}
      />

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: COLORS.text,
            margin: 0,
            letterSpacing: -2,
          }}
        >
          Delta-Neutral
        </h1>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            letterSpacing: -2,
          }}
        >
          Funding Rate Vault
        </h1>
      </div>

      {/* Subtitle */}
      <p
        style={{
          opacity: subtitleOpacity,
          fontSize: 28,
          color: COLORS.textMuted,
          marginTop: 24,
        }}
      >
        Automated yield capture on Drift Protocol
      </p>

      {/* Team */}
      <p
        style={{
          opacity: teamOpacity,
          fontSize: 22,
          color: COLORS.primary,
          marginTop: 40,
        }}
      >
        Ranger Hackathon — Build-a-Bear (Drift Side Track)
      </p>

      {/* Tagline */}
      <p
        style={{
          opacity: taglineOpacity,
          fontSize: 20,
          color: COLORS.textMuted,
          marginTop: 12,
        }}
      >
        Genetically optimized • Multi-market • Risk-managed
      </p>
    </AbsoluteFill>
  );
};
