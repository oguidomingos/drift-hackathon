import React from 'react';
import { Composition } from 'remotion';
import { Intro } from './compositions/Intro';
import { StrategyExplainer } from './compositions/StrategyExplainer';
import { BacktestResults } from './compositions/BacktestResults';
import { Innovation } from './compositions/Innovation';
import { LiveProof } from './compositions/LiveProof';
import { Outro } from './compositions/Outro';

// 30fps, 3 minutes = 5400 frames
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 0-15s: Name, team, pitch */}
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 15-75s: How the strategy works */}
      <Composition
        id="StrategyExplainer"
        component={StrategyExplainer}
        durationInFrames={60 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 75-120s: Animated backtest charts */}
      <Composition
        id="BacktestResults"
        component={BacktestResults}
        durationInFrames={45 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 120-145s: GA + multi-market innovation */}
      <Composition
        id="Innovation"
        component={Innovation}
        durationInFrames={25 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 145-165s: Solscan + vault proof */}
      <Composition
        id="LiveProof"
        component={LiveProof}
        durationInFrames={20 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 165-180s: Summary */}
      <Composition
        id="Outro"
        component={Outro}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* Full video: all compositions sequenced */}
      <Composition
        id="FullVideo"
        component={FullVideo}
        durationInFrames={180 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};

import { Series } from 'remotion';

const FullVideo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={15 * 30}>
        <Intro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60 * 30}>
        <StrategyExplainer />
      </Series.Sequence>
      <Series.Sequence durationInFrames={45 * 30}>
        <BacktestResults />
      </Series.Sequence>
      <Series.Sequence durationInFrames={25 * 30}>
        <Innovation />
      </Series.Sequence>
      <Series.Sequence durationInFrames={20 * 30}>
        <LiveProof />
      </Series.Sequence>
      <Series.Sequence durationInFrames={15 * 30}>
        <Outro />
      </Series.Sequence>
    </Series>
  );
};
