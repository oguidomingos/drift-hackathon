# Delta-Neutral Funding Rate Strategy

## Overview

TODO: Write full strategy whitepaper.

## Thesis

Perpetual futures on Drift Protocol charge funding rates to balance long/short interest. When longs > shorts, funding is positive (longs pay shorts). By shorting the perp and longing the spot, we capture funding income with near-zero directional risk.

## Edge

- Multi-market rotation (SOL, BTC, ETH) captures highest available rates
- Genetic algorithm optimizes parameters across the entire strategy space
- 5-trigger risk management framework prevents catastrophic losses
- Walk-forward validation confirms strategy robustness
