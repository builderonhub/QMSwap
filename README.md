# QMSwap — Experimental AMM DEX

QMSwap is an experimental automated market maker (AMM) decentralized exchange for QMS Testnet.

## Features

- Token swaps using the constant-product formula
- 0.30% swap fee
- Add and remove liquidity
- Internal liquidity provider (LP) shares
- MetaMask wallet integration and web interface
- Solidity smart contracts, Hardhat, and ethers.js

## Security Notice

- This project has not undergone a security audit.
- Use only on a local development network or testnet.
- Do not use real funds.
- `TestToken` allows unrestricted minting and is intended for testing only.
- QMS Testnet may be reset.

## Prerequisites

- Node.js LTS
- MetaMask
- Access to QMS Testnet, if using the public test network

## Installation

1. Install Node.js LTS.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. Set `DEPLOYER_PRIVATE_KEY` in `.env` to a dedicated testnet wallet private key. Never share or commit this file.

## Compile Contracts

```bash
npm run compile
```

## Deployment

Use the appropriate deployment script only after reviewing its source code and verifying the target network and wallet configuration.

Deployment addresses are written to `frontend/deployments/qms-testnet.json` by the relevant deployment workflow. Local deployment configuration files are excluded from version control.

**Do not deploy to a public network without verifying the official QMS documentation and the intended contract configuration.**

## Run the Web Interface

Start the frontend using the project's configured development command. Open the Vite URL displayed in the terminal.

Connect MetaMask, load the deployment configuration, mint test tokens where supported, add liquidity, and test token swaps.

## QMS Testnet

- Chain ID: `19480`
- RPC: <https://rpc.testnet.qms.finance>
- Explorer: <https://testnet.qmsscan.io>

Verify the official QMS documentation before deployment because RPC endpoints and network configuration may change.
