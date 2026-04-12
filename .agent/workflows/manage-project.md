---
description: How to deploy and manage the Blockchain Banking System
---

# 🚀 Blockchain Banking Workflow

Follow these steps to deploy your smart contracts and run the frontend.

## 1. Smart Contract Deployment (Hardhat)
// turbo
1. Navigate to the blockchain directory:
   ```powershell
   cd blockchain
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Compile the contracts:
   ```powershell
   npx hardhat compile
   ```
4. Deploy to Sepolia and auto-verify:
   ```powershell
   npx hardhat run scripts/deploy.js --network sepolia
   ```
   *Note: Ensure your `.env` in the `frontend` folder has `SEPOLIA_PRIVATE_KEY` and `ETHERSCAN_API_KEY`.*

## 2. Frontend Development
// turbo
1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Start the development server:
   ```powershell
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## 3. Maintenance Tasks
- **Verify Contract Manually**: 
  ```powershell
  npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
  ```
- **Update Contract Address**: 
  Modify `VITE_CONTRACT_ADDRESS` in `frontend/.env`.
- **Export Data**: 
  Use the "Export CSV" buttons in the Transactions or Analytics tabs.
- **Admin Panel**: 
  Connect as the deployer account to manage KYC and Emergency Pause.
