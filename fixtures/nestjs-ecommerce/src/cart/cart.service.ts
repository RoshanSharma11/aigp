import { Injectable } from "@nestjs/common";

import { AddCartItemDto } from "./dto/add-cart-item.dto.js";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto.js";
import { ApplyCouponDto } from "./dto/apply-coupon.dto.js";
import { CartEntity, type CartItem } from "./entities/cart.entity.js";

@Injectable()
export class CartService {
  private cart: CartEntity = new CartEntity({
    id: "cart_1",
    userId: "user_1",
    items: [],
    appliedCoupons: [],
  });

  getCart(): CartEntity {
    return this.cart;
  }

  getCartSummary(): { itemCount: number; totalPrice: number; currency: string } {
    const itemCount = this.cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = itemCount * 10000; // Mock: $100 per item
    return { itemCount, totalPrice, currency: "USD" };
  }

  addCartItem(input: AddCartItemDto): CartEntity {
    const existingItem = this.cart.items.find(
      (item) => item.productId === input.productId
    );

    const items: readonly CartItem[] = existingItem
      ? this.cart.items.map((item) =>
          item.productId === input.productId
            ? { ...item, quantity: item.quantity + input.quantity }
            : item
        )
      : [...this.cart.items, { productId: input.productId, quantity: input.quantity }];

    this.cart = new CartEntity({
      id: this.cart.id,
      userId: this.cart.userId,
      items,
      appliedCoupons: this.cart.appliedCoupons,
    });

    return this.cart;
  }

  updateCartItem(productId: string, input: UpdateCartItemDto): CartEntity {
    const items = this.cart.items.map((item) =>
      item.productId === productId ? { ...item, quantity: input.quantity } : item
    );

    this.cart = new CartEntity({
      id: this.cart.id,
      userId: this.cart.userId,
      items,
      appliedCoupons: this.cart.appliedCoupons,
    });

    return this.cart;
  }

  removeCartItem(productId: string): CartEntity {
    // Mock: remove item from cart
    const items = this.cart.items.filter((item) => item.productId !== productId);

    this.cart = new CartEntity({
      id: this.cart.id,
      userId: this.cart.userId,
      items,
      appliedCoupons: this.cart.appliedCoupons,
    });

    return this.cart;
  }

  clearCart(): { success: boolean } {
    // Mock: clear all items
    this.cart = new CartEntity({
      id: this.cart.id,
      userId: this.cart.userId,
      items: [],
      appliedCoupons: [],
    });
    return { success: true };
  }

  applyCoupon(input: ApplyCouponDto): CartEntity {
    // Mock: apply coupon
    const existingCoupon = this.cart.appliedCoupons.find(
      (c) => c.code === input.couponCode
    );

    const appliedCoupons = existingCoupon
      ? this.cart.appliedCoupons
      : [
          ...this.cart.appliedCoupons,
          {
            code: input.couponCode,
            discountPercentage: input.discountPercentage,
            appliedAt: new Date().toISOString(),
          },
        ];

    this.cart = new CartEntity({
      id: this.cart.id,
      userId: this.cart.userId,
      items: this.cart.items,
      appliedCoupons,
    });

    return this.cart;
  }

  removeCoupon(couponCode: string): CartEntity {
    // Mock: remove coupon
    const appliedCoupons = this.cart.appliedCoupons.filter(
      (c) => c.code !== couponCode
    );

    this.cart = new CartEntity({
      id: this.cart.id,
      userId: this.cart.userId,
      items: this.cart.items,
      appliedCoupons,
    });

    return this.cart;
  }

  validateCart(): { valid: boolean; errors?: readonly string[] } {
    // Mock: validate cart
    const errors: string[] = [];

    if (this.cart.items.length === 0) {
      errors.push("Cart is empty");
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors }),
    };
  }
}
