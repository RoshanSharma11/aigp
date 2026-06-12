export interface CartItem {
  readonly productId: string;
  readonly quantity: number;
}

export interface AppliedCoupon {
  readonly code: string;
  readonly discountPercentage: number;
  readonly appliedAt: string;
}

export class CartEntity {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly CartItem[];
  readonly appliedCoupons: readonly AppliedCoupon[];

  constructor(input: {
    id: string;
    userId: string;
    items: readonly CartItem[];
    appliedCoupons?: readonly AppliedCoupon[];
  }) {
    this.id = input.id;
    this.userId = input.userId;
    this.items = input.items;
    this.appliedCoupons = input.appliedCoupons || [];
  }
}
