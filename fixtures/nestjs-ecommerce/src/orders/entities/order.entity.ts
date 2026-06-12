export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

export interface OrderItem {
  readonly productId: string;
  readonly quantity: number;
  readonly priceCents: number;
}

export class OrderEntity {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly OrderItem[];
  readonly totalCents: number;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deliveryAddress: string | undefined;
  readonly trackingNumber: string | undefined;

  constructor(input: {
    id: string;
    userId: string;
    items: readonly OrderItem[];
    totalCents: number;
    status: OrderStatus;
    createdAt: string;
    updatedAt: string;
    deliveryAddress?: string | undefined;
    trackingNumber?: string | undefined;
  }) {
    this.id = input.id;
    this.userId = input.userId;
    this.items = input.items;
    this.totalCents = input.totalCents;
    this.status = input.status;
    this.createdAt = input.createdAt;
    this.updatedAt = input.updatedAt;
    this.deliveryAddress = input.deliveryAddress;
    this.trackingNumber = input.trackingNumber;
  }
}
