# QMSwap — Permissionless Token Discovery & Liquidity Routing

QMSwap is a token discovery and liquidity routing platform built for the QMS ecosystem.

Users can import any ERC-20 token by contract address. QMSwap validates the token contract, discovers available liquidity pools across supported protocols, compares executable swap routes, and directs trades through the appropriate liquidity provider.

The platform initially integrates QWAP as its primary liquidity source, while retaining native QMSwap pools as a secondary venue and QPad as a token discovery source.

Core capabilities:

- **Contract-Based Token Discovery:** Import and identify tokens using their on-chain contract addresses.
- **Automatic Pool Discovery:** Find available trading pairs across supported QMS liquidity providers.
- **Smart Swap Routing:** Compare quotes, liquidity depth, and execution impact before selecting a route.
- **Token Verification:** Distinguish officially recognized assets from imported and unverified contracts.
- **Unified Liquidity Access:** Provide one interface for discovering and accessing liquidity across the QMS ecosystem.

QMSwap aims to make every supported token and liquidity pool on QMS easier to discover and access through a single non-custodial interface.