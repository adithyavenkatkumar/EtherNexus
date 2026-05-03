# EtherNexus — Blockchain Banking System

> A decentralized, self-custodial banking platform built on Ethereum, combining the security of Web3 with the usability of traditional banking.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Smart Contract Setup](#smart-contract-setup)
  - [Frontend Setup](#frontend-setup)
  - [Resume Screening Tool Setup](#resume-screening-tool-setup)
- [Smart Contract](#smart-contract)
- [Frontend Components](#frontend-components)
- [Resume Screening System](#resume-screening-system)
- [Security](#security)
- [Deployment](#deployment)
- [Research & Reviews](#research--reviews)
- [Project Status](#project-status)

---

## Overview

**DataHaven** is a Senior Design Project (SDP) that implements a fully decentralized banking ecosystem deployed on the **Ethereum Sepolia Testnet**. It eliminates reliance on central authorities by providing users with complete, self-custodial control of their digital assets through a modern, premium-grade user interface.

The project also includes an **AI-powered Resume Screening System** built with Python and Streamlit, which uses Sentence Transformers and cosine similarity to semantically rank resumes against a given job description.

- **Project Duration:** December 16, 2025 – February 03, 2026
- **Final Platform:** Ethereum Sepolia Testnet
- **Status:** ✅ Completed

---

## Features

### Blockchain Banking (DApp)
| Feature | Description |
|---|---|
| 💰 **Deposit & Withdraw** | Securely deposit and withdraw ETH directly from your wallet |
| 📤 **P2P Payments** | Send ETH to any wallet address with real-time confirmations |
| 🔐 **Multi-Signature Approvals** | Require multiple approvals for high-value transactions |
| 🔁 **Recurring Payments** | Automate scheduled transfers (subscriptions, payroll, etc.) |
| ⛽ **Gas Fee Estimator** | Real-time gas price estimation before submitting transactions |
| 📊 **Analytics Dashboard** | Spending charts and transaction history with persistent filtering |
| 🔔 **Notifications** | Real-time in-app alerts for completed and pending transactions |
| 📱 **QR Code Payments** | Generate and scan QR codes for fast wallet-to-wallet transfers |
| 🛡️ **Daily Spending Limits** | Set configurable daily transaction caps for extra security |
| 💱 **Live ETH/USD Pricing** | Real-time price feed via CoinGecko API |
| 👤 **Admin Panel** | Owner-level controls including KYC and circuit breaker |

### Resume Screening System (AI Tool)
| Feature | Description |
|---|---|
| 📄 **Multi-format Upload** | Accepts PDF and DOCX resume files |
| 🤖 **Semantic Ranking** | Uses `all-MiniLM-L6-v2` Sentence Transformer model |
| 📈 **Similarity Scoring** | Cosine similarity score with Highly Relevant / Potential Match / Not Relevant labels |
| 📥 **Export Results** | Download ranked results as a CSV report |

---

## System Architecture

The DApp follows a three-layer architectural model:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│   React 18 SPA  │  Chart.js Visualizations  │  MetaMask UI  │
├─────────────────────────────────────────────────────────────┤
│                    INTEGRATION LAYER                         │
│      Ethers.js v6  │  MetaMask Provider  │  CoinGecko API   │
├─────────────────────────────────────────────────────────────┤
│                    BLOCKCHAIN LAYER                          │
│   PaymentSystem.sol (Solidity ^0.8.19) on Sepolia Testnet   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Smart Contracts
- **Solidity** `^0.8.19`
- **Hardhat** `^2.17.0` — Development, testing & deployment framework
- **Ethereum Sepolia Testnet** — Live deployment network
- **Etherscan** — Contract verification

### Frontend DApp
- **React** `18.2` + **Vite** `5.0`
- **Ethers.js** `v6.9` — Blockchain interaction
- **Chart.js** + **react-chartjs-2** — Analytics visualization
- **qrcode.react** — QR code generation
- **react-hot-toast** — Toast notifications
- **date-fns** — Date formatting

### AI Resume Screening
- **Python** + **Streamlit** — Application framework
- **Sentence Transformers** (`all-MiniLM-L6-v2`) — Semantic embeddings
- **scikit-learn** — Cosine similarity computation
- **PyPDF2** + **docx2txt** — Resume text extraction
- **pandas** + **numpy** — Data processing

---

## Project Structure

```
SDP new/
├── blockchain/                  # Smart contract workspace
│   ├── contracts/
│   │   └── PaymentSystem.sol    # Core smart contract
│   ├── scripts/
│   │   └── deploy.js            # Deployment script
│   ├── test/                    # Hardhat test suite
│   ├── hardhat.config.js        # Hardhat configuration
│   └── package.json
│
├── frontend/                    # React DApp
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.jsx
│   │   │   ├── Balance.jsx
│   │   │   ├── SendPayment.jsx
│   │   │   ├── Transactions.jsx
│   │   │   ├── MultiSig.jsx
│   │   │   ├── RecurringPayments.jsx
│   │   │   ├── GasEstimator.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   ├── Notifications.jsx
│   │   │   ├── QRCode.jsx
│   │   │   └── PriceDisplay.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── contract/
│   └── PaymentSystem.sol        # Source contract reference
│
├── Reviews/                     # SDP review documentation
│   ├── Zeroth_Review.md
│   ├── First_Review.md
│   ├── Second_Review.md
│   ├── Third_Review.md
│   ├── Research_Paper_IEEE.tex  # IEEE research paper (LaTeX)
│   ├── plot_gas.py              # Gas consumption analysis script
│   └── plot_time.py             # Transaction time analysis script
│
├── app.py                       # AI Resume Screening (Streamlit)
├── requirements.txt             # Python dependencies
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** `v18+` and **npm**
- **Python** `3.9+`
- **MetaMask** browser extension
- **Sepolia ETH** (from a faucet, e.g., [sepoliafaucet.com](https://sepoliafaucet.com/))
- A **Sepolia RPC URL** (e.g., from [Infura](https://infura.io/) or [Alchemy](https://alchemy.com/))
- An **Etherscan API Key** (for contract verification)

---

### Smart Contract Setup

```bash
# 1. Navigate to the blockchain directory
cd blockchain

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create a .env file in the /frontend directory with:
# SEPOLIA_RPC_URL=<your_rpc_url>
# SEPOLIA_PRIVATE_KEY=<your_wallet_private_key>
# ETHERSCAN_API_KEY=<your_etherscan_api_key>

# 4. Compile the smart contract
npm run compile

# 5. Run tests
npm test

# 6. Deploy to Sepolia Testnet
npm run deploy:sepolia

# 7. (Optional) Verify on Etherscan
npm run verify
```

---

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Configure environment
# Edit the .env file and add the deployed contract address:
# VITE_CONTRACT_ADDRESS=<deployed_contract_address>

# 4. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Connect MetaMask to the **Sepolia Testnet** to interact with the DApp.

---

### Resume Screening Tool Setup

```bash
# 1. (Recommended) Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Run the Streamlit app
streamlit run app.py
```

The app will open at [http://localhost:8501](http://localhost:8501).

---

## Smart Contract

**File:** `blockchain/contracts/PaymentSystem.sol` | Solidity `^0.8.19`

The `PaymentSystem` contract implements a comprehensive on-chain banking system with the following key capabilities:

- **Deposits & Withdrawals** — Secure ETH management with event logging
- **Standard Transfers** — P2P payments with memo support
- **Multi-Signature Transactions** — N-of-M approval scheme for high-value transfers
- **Recurring Payments** — On-chain automation for scheduled transfers
- **Daily Spending Limits** — Configurable per-user transaction caps
- **KYC / Whitelist** — Owner-controlled address verification
- **Circuit Breaker** — Emergency pause mechanism (admin only)
- **Reentrancy Guard** — Protection against reentrancy attacks using the Pull Payment pattern

---

## Frontend Components

| Component | Description |
|---|---|
| `WalletConnect.jsx` | MetaMask integration and wallet state management |
| `Balance.jsx` | Displays on-chain ETH balance and live USD value |
| `SendPayment.jsx` | P2P transfer form with pre-flight gas estimation |
| `Transactions.jsx` | Full transaction history with search and filtering |
| `MultiSig.jsx` | Multi-signature proposal creation and approval workflow |
| `RecurringPayments.jsx` | Schedule, manage, and cancel automated payments |
| `GasEstimator.jsx` | Real-time gas price selector (slow / standard / fast) |
| `Analytics.jsx` | Spending charts and statistical breakdowns |
| `AdminPanel.jsx` | KYC management, circuit breaker, and owner controls |
| `Notifications.jsx` | In-app notification feed for blockchain events |
| `QRCode.jsx` | QR code generator for easy address sharing |
| `PriceDisplay.jsx` | Live ETH/USD price ticker |

---

## Resume Screening System

The AI tool (`app.py`) provides an automated screening pipeline for HR workflows:

1. **Paste** a Job Description into the text area
2. **Upload** one or more resumes (`.pdf` or `.docx`)
3. **Click** "Analyze and Rank" to compute semantic similarity scores
4. **Review** the ranked table sorted by relevance score
5. **Download** the CSV report for sharing with your team

**Scoring Labels:**
- ✅ **Highly Relevant** — Similarity Score > 70%
- 🟡 **Potential Match** — Similarity Score 40%–70%
- ❌ **Not Relevant** — Similarity Score < 40%

---

## Security

The smart contract was internally audited for the following vulnerability classes:

| Vulnerability | Mitigation |
|---|---|
| Reentrancy | Pull Payment pattern + state-before-transfer ordering |
| Access Control | `onlyOwner` and `onlyAuthorized` modifiers |
| Denial of Service | Gas-limited loops and circuit breaker pattern |
| Integer Overflow | Solidity `^0.8.x` built-in overflow protection |
| Front-Running | Nonce-based transaction sequencing |

---

## Deployment

| Item | Details |
|---|---|
| **Network** | Ethereum Sepolia Testnet |
| **Solidity Version** | `0.8.19` |
| **Optimizer** | Enabled (`200` runs) |
| **Deployment Tool** | Hardhat + custom `deploy.js` script |
| **Verification** | Etherscan (via `hardhat-toolbox`) |

---

## Research & Reviews

All formal SDP review documents and the associated IEEE research paper are located in the `Reviews/` directory.

| Document | Description |
|---|---|
| `Zeroth_Review.md` | Project inception, motivation, and objectives |
| `First_Review.md` | Initial design and architecture decisions |
| `Second_Review.md` | Development progress and intermediate results |
| `Third_Review.md` | Final delivery, results, and completion summary |
| `Research_Paper_IEEE.tex` | Full IEEE-format research paper (LaTeX source) |
| `plot_gas.py` | Script to generate gas consumption analysis chart |
| `plot_time.py` | Script to generate transaction time analysis chart |

---

## Project Status

> 🏆 **COMPLETED** — February 03, 2026

All objectives defined in the Zeroth Review have been met:

- ✅ Fully decentralized, self-custodial banking system
- ✅ 9+ core banking features implemented and tested
- ✅ Multi-signature and recurring payment automation
- ✅ Premium UI with Dark Mode and Glassmorphism aesthetics
- ✅ Smart contract internally audited for common vulnerabilities
- ✅ Successfully deployed on Ethereum Sepolia Testnet
- ✅ AI-powered Resume Screening system integrated
- ✅ IEEE research paper authored and submitted

---

*Senior Design Project | Ethereum · React · Solidity · Python · AI*
