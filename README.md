# 🌍 Blockchain-based Cross-Border Remittance System

Welcome to a revolutionary way to send money across borders using stablecoins on the Stacks blockchain! This project provides a decentralized, low-fee, and fast solution for cross-border remittances, addressing the high costs and delays of traditional remittance systems.

## ✨ Features

💸 **Low-Fee Transfers**: Use stablecoins to minimize transaction fees compared to traditional remittance services.  
🌐 **Global Accessibility**: Send and receive funds anywhere, anytime, with blockchain security.  
🔒 **Secure Wallets**: User-controlled wallets with multi-signature support for enhanced security.  
📜 **Compliance Checks**: Built-in KYC/AML verification to ensure regulatory compliance.  
⚖️ **Dispute Resolution**: Decentralized mechanism to handle disputes between senders and receivers.  
📊 **Transparent Fees**: Dynamic fee calculation based on network conditions and transfer amount.  
🔄 **Currency Conversion**: Convert between stablecoins and fiat at competitive rates.  
📈 **Transaction History**: Immutable record of all transfers for transparency and auditability.

## 🛠 How It Works

**For Senders**  
1. Create a wallet using the `wallet-manager` contract.  
2. Deposit stablecoins (e.g., USDC) into your wallet via the `stablecoin-depository` contract.  
3. Initiate a transfer using the `remittance-processor` contract, specifying the recipient and amount.  
4. Pass KYC/AML checks via the `compliance-verifier` contract.  
5. Pay a small transaction fee calculated by the `fee-calculator` contract.  
6. Confirm the transfer, and funds are locked in the `escrow-manager` contract until delivery.

**For Receivers**  
1. Verify receipt of funds using the `remittance-processor` contract.  
2. Withdraw funds to your wallet or convert to fiat via the `fiat-converter` contract.  
3. In case of issues, initiate a dispute through the `dispute-resolver` contract.

**For Verifiers/Auditors**  
- Use the `transaction-history` contract to view immutable transfer records.  
- Check compliance status via the `compliance-verifier` contract.

## 📑 Smart Contracts

This project uses 8 Clarity smart contracts to manage the remittance system:

1. **wallet-manager.clar**  
   - Manages user wallets, including creation, balance checks, and multi-signature authorization.  
   - Functions: `create-wallet`, `get-balance`, `add-signer`, `remove-signer`.

2. **stablecoin-depository.clar**  
   - Handles deposits and withdrawals of stablecoins (e.g., USDC).  
   - Functions: `deposit-stablecoin`, `withdraw-stablecoin`, `get-deposit-history`.

3. **remittance-processor.clar**  
   - Processes cross-border transfers, including sender/receiver validation and fund transfer.  
   - Functions: `initiate-transfer`, `confirm-transfer`, `cancel-transfer`.

4. **fee-calculator.clar**  
   - Calculates dynamic transaction fees based on network conditions and transfer amount.  
   - Functions: `calculate-fee`, `update-fee-parameters`, `get-fee-rate`.

5. **compliance-verifier.clar**  
   - Integrates KYC/AML checks to ensure regulatory compliance.  
   - Functions: `submit-kyc`, `verify-compliance`, `revoke-compliance`.

6. **escrow-manager.clar**  
   - Locks funds in escrow during transfers and releases them upon confirmation.  
   - Functions: `lock-funds`, `release-funds`, `refund-funds`.

7. **dispute-resolver.clar**  
   - Manages disputes between senders and receivers, with a voting mechanism for resolution.  
   - Functions: `initiate-dispute`, `vote-on-dispute`, `resolve-dispute`.

8. **fiat-converter.clar**  
   - Facilitates conversion between stablecoins and fiat currencies via oracle price feeds.  
   - Functions: `convert-to-fiat`, `convert-to-stablecoin`, `update-oracle-price`.

## 🚀 Getting Started

### Prerequisites
- Install the [Stacks CLI](https://docs.stacks.co/stacks-101/clarity) for Clarity development.  
- Set up a Stacks wallet with testnet STX tokens.  
- Use a stablecoin compatible with Stacks (e.g., a wrapped USDC implementation).

### Installation
1. Clone the repository:  
   ```bash
   git clone https://github.com/your-repo/cross-border-remittance.git
   ```
2. Navigate to the project directory:  
   ```bash
   cd cross-border-remittance
   ```
3. Deploy the smart contracts using Stacks CLI:  
   ```bash
   clarinet deploy
   ```

### Usage
1. **Create a Wallet**: Call `wallet-manager::create-wallet` to set up your wallet.  
2. **Deposit Stablecoins**: Use `stablecoin-depository::deposit-stablecoin` to fund your wallet.  
3. **Send Money**: Initiate a transfer with `remittance-processor::initiate-transfer`.  
4. **Verify Compliance**: Submit KYC details via `compliance-verifier::submit-kyc`.  
5. **Track Transactions**: Query `transaction-history` for transfer records.

## 🛡️ Security Considerations
- **Multi-Signature Wallets**: Use `wallet-manager` to add multiple signers for large transfers.  
- **Escrow Protection**: Funds are locked in `escrow-manager` until the recipient confirms.  
- **Immutable Records**: `transaction-history` ensures transparency and auditability.  
- **Compliance**: `compliance-verifier` enforces KYC/AML to prevent fraud.

## 🌟 Why This Matters
Traditional remittance services charge high fees (5-7% on average) and take days to process. This project uses stablecoins to reduce fees to under 1% and enables near-instant transfers, empowering users in underserved regions with affordable financial access.

## 📜 License
MIT License.