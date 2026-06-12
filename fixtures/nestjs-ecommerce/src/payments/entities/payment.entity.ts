export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export class PaymentEntity {
  readonly id: string;
  readonly orderId: string;
  readonly amountCents: number;
  readonly status: PaymentStatus;
  readonly method: string;
  readonly transactionId: string;
  readonly createdAt: string;

  constructor(input: {
    id: string;
    orderId: string;
    amountCents: number;
    status: PaymentStatus;
    method: string;
    transactionId: string;
    createdAt: string;
  }) {
    this.id = input.id;
    this.orderId = input.orderId;
    this.amountCents = input.amountCents;
    this.status = input.status;
    this.method = input.method;
    this.transactionId = input.transactionId;
    this.createdAt = input.createdAt;
  }
}
