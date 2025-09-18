import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INSUFFICIENT_BALANCE = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_INVALID_RECIPIENT = 103;
const ERR_TRANSFER_ALREADY_CONFIRMED = 104;
const ERR_TRANSFER_NOT_FOUND = 105;
const ERR_COMPLIANCE_FAILED = 106;
const ERR_FEE_CALCULATION_FAILED = 107;
const ERR_ESCROW_LOCK_FAILED = 108;
const ERR_TIMEOUT_EXCEEDED = 109;
const ERR_INVALID_STABLECOIN = 110;
const ERR_INVALID_TRANSFER_ID = 111;
const ERR_CANCEL_NOT_ALLOWED = 112;

interface Transfer {
  sender: string;
  recipient: string;
  amount: number;
  stablecoin: string;
  status: string;
  timestamp: number;
  fee: number;
  timeout: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class RemittanceProcessorMock {
  state: {
    nextTransferId: number;
    defaultTimeout: number;
    feePercentage: number;
    authorityContract: string | null;
    transfers: Map<number, Transfer>;
    senderBalances: Map<string, number>;
    recipientBalances: Map<string, number>;
  } = {
    nextTransferId: 0,
    defaultTimeout: 144,
    feePercentage: 50,
    authorityContract: null,
    transfers: new Map(),
    senderBalances: new Map(),
    recipientBalances: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextTransferId: 0,
      defaultTimeout: 144,
      feePercentage: 50,
      authorityContract: null,
      transfers: new Map(),
      senderBalances: new Map(),
      recipientBalances: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setDefaultTimeout(newTimeout: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newTimeout <= 0) return { ok: false, value: false };
    this.state.defaultTimeout = newTimeout;
    return { ok: true, value: true };
  }

  setFeePercentage(newPercentage: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newPercentage > 1000) return { ok: false, value: false };
    this.state.feePercentage = newPercentage;
    return { ok: true, value: true };
  }

  depositBalance(amount: number): Result<boolean> {
    if (amount <= 0) return { ok: false, value: false };
    const current = this.getSenderBalance(this.caller).value;
    this.state.senderBalances.set(this.caller, current + amount);
    return { ok: true, value: true };
  }

  calculateFee(amount: number): Result<number> {
    const fee = Math.floor((amount * this.state.feePercentage) / 10000);
    if (fee > 0) {
      return { ok: true, value: fee };
    }
    return { ok: false, value: ERR_FEE_CALCULATION_FAILED };
  }

  checkCompliance(sender: string): Result<boolean> {
    return { ok: true, value: true };
  }

  initiateTransfer(
    recipient: string,
    amount: number,
    stablecoin: string
  ): Result<number> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (!recipient) return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (!["USDC", "USDT", "DAI"].includes(stablecoin)) return { ok: false, value: ERR_INVALID_STABLECOIN };
    const currentBalance = this.getSenderBalance(this.caller).value;
    const feeResult = this.calculateFee(amount);
    if (!feeResult.ok) return { ok: false, value: feeResult.value };
    const totalCost = amount + feeResult.value;
    if (currentBalance < totalCost) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    if (!this.checkCompliance(this.caller).value) return { ok: false, value: ERR_COMPLIANCE_FAILED };

    const id = this.state.nextTransferId;
    const transfer: Transfer = {
      sender: this.caller,
      recipient,
      amount,
      stablecoin,
      status: "initiated",
      timestamp: this.blockHeight,
      fee: feeResult.value,
      timeout: this.blockHeight + this.state.defaultTimeout,
    };
    this.state.transfers.set(id, transfer);
    this.state.senderBalances.set(this.caller, currentBalance - totalCost);
    this.state.nextTransferId++;
    return { ok: true, value: id };
  }

  getTransfer(id: number): Transfer | null {
    return this.state.transfers.get(id) || null;
  }

  getSenderBalance(sender: string): Result<number> {
    return { ok: true, value: this.state.senderBalances.get(sender) || 0 };
  }

  getRecipientBalance(recipient: string): Result<number> {
    return { ok: true, value: this.state.recipientBalances.get(recipient) || 0 };
  }

  confirmTransfer(id: number): Result<boolean> {
    const transfer = this.state.transfers.get(id);
    if (!transfer) return { ok: false, value: ERR_TRANSFER_NOT_FOUND };
    if (transfer.recipient !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (transfer.status !== "locked") return { ok: false, value: ERR_TRANSFER_ALREADY_CONFIRMED };
    if (this.blockHeight > transfer.timeout) return { ok: false, value: ERR_TIMEOUT_EXCEEDED };

    transfer.status = "confirmed";
    const current = this.getRecipientBalance(this.caller).value;
    this.state.recipientBalances.set(this.caller, current + transfer.amount);
    return { ok: true, value: true };
  }

  cancelTransfer(id: number): Result<boolean> {
    const transfer = this.state.transfers.get(id);
    if (!transfer) return { ok: false, value: ERR_TRANSFER_NOT_FOUND };
    if (transfer.sender !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!["initiated", "locked"].includes(transfer.status)) return { ok: false, value: ERR_CANCEL_NOT_ALLOWED };
    if (this.blockHeight > transfer.timeout) return { ok: false, value: ERR_TIMEOUT_EXCEEDED };

    transfer.status = "cancelled";
    const current = this.getSenderBalance(this.caller).value;
    this.state.senderBalances.set(this.caller, current + transfer.amount - transfer.fee);
    return { ok: true, value: true };
  }

  getTransferCount(): Result<number> {
    return { ok: true, value: this.state.nextTransferId };
  }
}

describe("RemittanceProcessor", () => {
  let contract: RemittanceProcessorMock;

  beforeEach(() => {
    contract = new RemittanceProcessorMock();
    contract.reset();
  });

  it("initiates a transfer successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.depositBalance(2000);
    const result = contract.initiateTransfer("ST3RECIP", 1000, "USDC");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const transfer = contract.getTransfer(0);
    expect(transfer?.sender).toBe("ST1TEST");
    expect(transfer?.recipient).toBe("ST3RECIP");
    expect(transfer?.amount).toBe(1000);
    expect(transfer?.stablecoin).toBe("USDC");
    expect(transfer?.status).toBe("initiated");
    expect(transfer?.fee).toBe(5);
    const balance = contract.getSenderBalance("ST1TEST").value;
    expect(balance).toBe(995);
  });

  it("rejects insufficient balance", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.depositBalance(100);
    const result = contract.initiateTransfer("ST3RECIP", 1000, "USDC");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("rejects invalid stablecoin", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.depositBalance(2000);
    const result = contract.initiateTransfer("ST3RECIP", 1000, "INVALID");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STABLECOIN);
  });

  it("rejects confirm by non-recipient", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.depositBalance(2000);
    contract.initiateTransfer("ST3RECIP", 1000, "USDC");
    const result = contract.confirmTransfer(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects cancel after timeout", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.depositBalance(2000);
    contract.initiateTransfer("ST3RECIP", 1000, "USDC");
    contract.blockHeight = 200;
    const result = contract.cancelTransfer(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TIMEOUT_EXCEEDED);
  });

  it("sets fee percentage successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setFeePercentage(100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.feePercentage).toBe(100);
  });

  it("returns correct transfer count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.depositBalance(2000);
    contract.initiateTransfer("ST3RECIP", 1000, "USDC");
    contract.initiateTransfer("ST4RECIP", 500, "USDT");
    const result = contract.getTransferCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });
});