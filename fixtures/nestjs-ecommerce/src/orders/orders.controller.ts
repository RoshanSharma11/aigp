import { Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { OrdersService } from "./orders.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { ApplyCouponToOrderDto, UpdateDeliveryAddressDto, ListOrdersQueryDto } from "./dto/order-query.dto.js";
import { OrderEntity } from "./entities/order.entity.js";

@Controller("orders")
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  createOrder(@Body() input: CreateOrderDto): OrderEntity {
    return this.ordersService.createOrder(input);
  }

  @Get()
  listOrders(@Query() query: ListOrdersQueryDto): { orders: readonly OrderEntity[]; total: number } {
    return this.ordersService.listOrders(query);
  }

  @Get(":orderId")
  getOrder(@Param("orderId") orderId: string): OrderEntity | undefined {
    return this.ordersService.getOrder(orderId);
  }

  @Delete(":orderId")
  cancelOrder(@Param("orderId") orderId: string): OrderEntity | undefined {
    return this.ordersService.cancelOrder(orderId);
  }

  @Get(":orderId/track")
  trackOrder(
    @Param("orderId") orderId: string
  ): { orderId: string; status: string; lastUpdate: string; estimatedDelivery?: string } {
    return this.ordersService.trackOrder(orderId);
  }

  @Post(":orderId/coupon")
  applyCoupon(
    @Param("orderId") orderId: string,
    @Body() input: ApplyCouponToOrderDto
  ): OrderEntity | undefined {
    return this.ordersService.applyCoupon(orderId, input);
  }

  @Post(":orderId/delivery-address")
  updateDeliveryAddress(
    @Param("orderId") orderId: string,
    @Body() input: UpdateDeliveryAddressDto
  ): OrderEntity | undefined {
    return this.ordersService.updateDeliveryAddress(orderId, input);
  }

  @Get(":orderId/invoice")
  getInvoice(
    @Param("orderId") orderId: string
  ): { orderId: string; invoiceNumber: string; amount: number; generatedAt: string } {
    return this.ordersService.getInvoice(orderId);
  }
}
