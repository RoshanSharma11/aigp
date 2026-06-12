import { Injectable } from "@nestjs/common";

import { AddCartItemDto } from "./dto/add-cart-item.dto.js";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto.js";
import { CartEntity, type CartItem } from "./entities/cart.entity.js";

@Injectable()
export class CartService {
  private cart: CartEntity = new CartEntity({
    id: "cart_1",
    userId: "user_1",
    items: []
  });

  getCart(): CartEntity {
    return this.cart;
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
      items
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
      items
    });

    return this.cart;
  }
}
