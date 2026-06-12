import { Injectable } from "@nestjs/common";
import { ProcessPaymentDto, RefundPaymentDto } from "./dto/process-payment.dto.js";
import { PaymentEntity, PaymentStatus } from "./entities/payment.entity.js";

@Injectable()
export class PaymentsService {
  private payments: PaymentEntity[] = [];

  processPayment(input: ProcessPaymentDto): PaymentEntity {
    // Mock: process payment
    const payment = new PaymentEntity({
      id: `pay_${Date.now()}`,
      orderId: input.orderId,
      amountCents: input.amountCents,
      status: PaymentStatus.COMPLETED,
      method: input.method,
      transactionId: `tx_${Date.now()}`,
      createdAt: new Date().toISOString(),
    });

    this.payments.push(payment);
    return payment;
  }

  refundPayment(input: RefundPaymentDto): PaymentEntity | undefined {
    // Mock: refund payment
    const payment = this.payments.find((p) => p.id === input.paymentId);
    if (!payment) return undefined;

    const refunded = new PaymentEntity({
      ...payment,
      status: PaymentStatus.REFUNDED,
    });

    this.payments = this.payments.map((p) => (p.id === input.paymentId ? refunded : p));
    return refunded;
  }

  getPaymentHistory(orderId: string): readonly PaymentEntity[] {
    // Mock: return payment history
    return this.payments.filter((p) => p.orderId === orderId);
  }

  handleWebhook(event: {
    type: string;
    paymentId: string;
    status: string;
  }): { acknowledged: boolean } {
    // Mock: handle payment webhook
    const payment = this.payments.find((p) => p.id === event.paymentId);
    if (payment) {
      return { acknowledged: true };
    }
    return { acknowledged: false };
  }
}
