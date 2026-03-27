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
  text: '#FFFFFF',
  textMuted: '#8B8D97',
  card: '#151623',
  border: '#252738',
};

export const LiveProof: React.FC = () => {
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
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Live On-Chain Proof
      </h2>

      <p
        style={{
          fontSize: 22,
          color: COLORS.textMuted,
          marginTop: 12,
          opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Real trades verified on Solscan — not a simulation
      </p>

      <div
        style={{
          display: 'flex',
          gap: 40,
          marginTop: 50,
          opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        {/* Vault Info */}
        <div
          style={{
            flex: 1,
            background: COLORS.card,
            borderRadius: 20,
            padding: 36,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h3 style={{ fontSize: 26, color: COLORS.primary, marginBottom: 24 }}>
            Vault Details
          </h3>
          <InfoRow label="Network" value="Solana Mainnet" />
          <InfoRow label="Protocol" value="Drift Protocol v2" />
          <InfoRow label="Vault Type" value="Delta-Neutral Funding" />
          <InfoRow label="Deposit Token" value="USDC" />
          <InfoRow label="Markets" value="SOL, BTC, ETH Perps" />
          <InfoRow label="Redeem Period" value="90 days" />

          <div
            style={{
              marginTop: 24,
              padding: '16px 20px',
              background: `${COLORS.primary}11`,
              borderRadius: 12,
              border: `1px solid ${COLORS.primary}33`,
            }}
          >
            <p style={{ fontSize: 14, color: COLORS.textMuted, margin: 0 }}>
              Vault Address
            </p>
            <p
              style={{
                fontSize: 16,
                color: COLORS.primary,
                fontFamily: 'monospace',
                margin: '8px 0 0 0',
                wordBreak: 'break-all',
              }}
            >
              {'[vault address will be inserted here]'}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div
          style={{
            flex: 1,
            background: COLORS.card,
            borderRadius: 20,
            padding: 36,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h3 style={{ fontSize: 26, color: COLORS.secondary, marginBottom: 24 }}>
            Transaction History
          </h3>
          <p
            style={{
              fontSize: 18,
              color: COLORS.textMuted,
              lineHeight: 1.6,
            }}
          >
            All transactions are publicly verifiable on Solscan.
          </p>

          <div style={{ marginTop: 20 }}>
            {['Vault Initialized', 'USDC Deposited', 'SOL-PERP Short Opened', 'SOL Spot Bought', 'Funding Collected'].map((tx, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: `1px solid ${COLORS.border}`,
                  opacity: interpolate(frame - 60 - i * 15, [0, 10], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: COLORS.primary,
                  }}
                />
                <span style={{ fontSize: 18, color: COLORS.text }}>{tx}</span>
                <span style={{ fontSize: 14, color: COLORS.textMuted, marginLeft: 'auto' }}>
                  ✓ Verified
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: `1px solid ${COLORS.border}`,
    }}
  >
    <span style={{ fontSize: 18, color: COLORS.textMuted }}>{label}</span>
    <span style={{ fontSize: 18, color: COLORS.text, fontWeight: 600 }}>{value}</span>
  </div>
);
