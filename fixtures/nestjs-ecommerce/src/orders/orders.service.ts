import { Injectable } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { ApplyCouponToOrderDto, UpdateDeliveryAddressDto, ListOrdersQueryDto } from "./dto/order-query.dto.js";
import { OrderEntity, OrderStatus, type OrderItem } from "./entities/order.entity.js";

@Injectable()
export class OrdersService {
  private orders: OrderEntity[] = [
    new OrderEntity({
      id: "ord_1",
      userId: "user_1",
      items: [
        { productId: "prod_1", quantity: 1, priceCents: 12999 },
        { productId: "prod_2", quantity: 2, priceCents: 8999 },
      ],
      totalCents: 30997,
      status: OrderStatus.DELIVERED,
      createdAt: "2026-06-01T10:00:00Z",
      updatedAt: "2026-06-05T15:30:00Z",
      deliveryAddress: "123 Main St",
      trackingNumber: "TRACK123456",
    }),
  ];

  createOrder(input: CreateOrderDto): OrderEntity {
    const totalCents = input.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

    // Mock: apply coupon if provided
    const discountedTotal = input.couponCode ? Math.floor(totalCents * 0.9) : totalCents;

    const order = new OrderEntity({
      id: `ord_${Date.now()}`,
      userId: "user_1",
      items: input.items,
      totalCents: discountedTotal,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(input.deliveryAddress && { deliveryAddress: input.deliveryAddress }),
    });

    this.orders.push(order);
    return order;
  }

  listOrders(query: ListOrdersQueryDto): { orders: readonly OrderEntity[]; total: number } {
    const limit = query.limit || 10;
    const offset = query.offset || 0;

    let filtered = this.orders;
    if (query.status) {
      filtered = filtered.filter((o) => o.status === query.status);
    }

    const orders = filtered.slice(offset, offset + limit);
    return { orders, total: filtered.length };
  }

  getOrder(orderId: string): OrderEntity | undefined {
    return this.orders.find((o) => o.id === orderId);
  }

  cancelOrder(orderId: string): OrderEntity | undefined {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return undefined;

    const cancelled = new OrderEntity({
      id: order.id,
      userId: order.userId,
      items: order.items,
      totalCents: order.totalCents,
      status: OrderStatus.CANCELLED,
      createdAt: order.createdAt,
      updatedAt: new Date().toISOString(),
      deliveryAddress: order.deliveryAddress,
      trackingNumber: order.trackingNumber,
    });

    this.orders = this.orders.map((o) => (o.id === orderId ? cancelled : o));
    return cancelled;
  }

  trackOrder(orderId: string): { orderId: string; status: string; lastUpdate: string; estimatedDelivery?: string } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      return { orderId, status: "not_found", lastUpdate: new Date().toISOString() };
    }

    return {
      orderId,
      status: order.status,
      lastUpdate: order.updatedAt,
      ...(order.status === OrderStatus.SHIPPED && { estimatedDelivery: new Date().toISOString() }),
    };
  }

  applyCoupon(orderId: string, input: ApplyCouponToOrderDto): OrderEntity | undefined {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return undefined;

    const newTotal = Math.max(0, order.totalCents - input.discountCents);

    const updated = new OrderEntity({
      id: order.id,
      userId: order.userId,
      items: order.items,
      totalCents: newTotal,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: new Date().toISOString(),
      deliveryAddress: order.deliveryAddress,
      trackingNumber: order.trackingNumber,
    });

    this.orders = this.orders.map((o) => (o.id === orderId ? updated : o));
    return updated;
  }

  updateDeliveryAddress(orderId: string, input: UpdateDeliveryAddressDto): OrderEntity | undefined {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order || order.status !== OrderStatus.PENDING) return undefined;

    const updated = new OrderEntity({
      id: order.id,
      userId: order.userId,
      items: order.items,
      totalCents: order.totalCents,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: new Date().toISOString(),
      deliveryAddress: input.address,
    });

    this.orders = this.orders.map((o) => (o.id === orderId ? updated : o));
    return updated;
  }

  getInvoice(orderId: string): { orderId: string; invoiceNumber: string; amount: number; generatedAt: string } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      return { orderId, invoiceNumber: "", amount: 0, generatedAt: new Date().toISOString() };
    }

    return {
      orderId,
      invoiceNumber: `INV-${orderId}`,
      amount: order.totalCents / 100,
      generatedAt: new Date().toISOString(),
    };
  }
}
