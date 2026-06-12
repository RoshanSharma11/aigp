import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { CartService } from "./cart.service.js";
import { AddCartItemDto } from "./dto/add-cart-item.dto.js";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto.js";
import { ApplyCouponDto } from "./dto/apply-coupon.dto.js";
import { CartEntity } from "./entities/cart.entity.js";

@Controller("cart")
@UseGuards(AuthGuard)
export class CartController {
  constructor(
    @Inject(CartService)
    private readonly cartService: CartService,
  ) {}

  @Get()
  getCart(): CartEntity {
    return this.cartService.getCart();
  }

  @Get("summary")
  getCartSummary(): { itemCount: number; totalPrice: number; currency: string } {
    return this.cartService.getCartSummary();
  }

  @Post("items")
  addCartItem(@Body() input: AddCartItemDto): CartEntity {
    return this.cartService.addCartItem(input);
  }

  @Patch("items/:productId")
  updateCartItem(
    @Param("productId") productId: string,
    @Body() input: UpdateCartItemDto
  ): CartEntity {
    return this.cartService.updateCartItem(productId, input);
  }

  @Delete("items/:productId")
  removeCartItem(@Param("productId") productId: string): CartEntity {
    return this.cartService.removeCartItem(productId);
  }

  @Post("clear")
  clearCart(): { success: boolean } {
    return this.cartService.clearCart();
  }

  @Post("apply-coupon")
  applyCoupon(@Body() input: ApplyCouponDto): CartEntity {
    return this.cartService.applyCoupon(input);
  }

  @Delete("coupon/:couponCode")
  removeCoupon(@Param("couponCode") couponCode: string): CartEntity {
    return this.cartService.removeCoupon(couponCode);
  }

  @Post("validate")
  validateCart(): { valid: boolean; errors?: readonly string[] } {
    return this.cartService.validateCart();
  }
}
