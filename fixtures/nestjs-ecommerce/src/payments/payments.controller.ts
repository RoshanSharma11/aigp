import { Body, Controller, Inject, Post, Get, Param, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { PaymentsService } from "./payments.service.js";
import { ProcessPaymentDto, RefundPaymentDto } from "./dto/process-payment.dto.js";
import { PaymentEntity } from "./entities/payment.entity.js";

@Controller("payments")
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post("process")
  @UseGuards(AuthGuard)
  processPayment(@Body() input: ProcessPaymentDto): PaymentEntity {
    return this.paymentsService.processPayment(input);
  }

  @Post("refund")
  @UseGuards(AuthGuard)
  refundPayment(@Body() input: RefundPaymentDto): PaymentEntity | undefined {
    return this.paymentsService.refundPayment(input);
  }

  @Get("history/:orderId")
  @UseGuards(AuthGuard)
  getPaymentHistory(@Param("orderId") orderId: string): readonly PaymentEntity[] {
    return this.paymentsService.getPaymentHistory(orderId);
  }

  @Post("webhook")
  handleWebhook(@Body() event: { type: string; paymentId: string; status: string }): { acknowledged: boolean } {
    return this.paymentsService.handleWebhook(event);
  }
}
