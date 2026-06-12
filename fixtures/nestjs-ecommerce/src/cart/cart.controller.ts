import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { CartService } from "./cart.service.js";
import { AddCartItemDto } from "./dto/add-cart-item.dto.js";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto.js";
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
}
