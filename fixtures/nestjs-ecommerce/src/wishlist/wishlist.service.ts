import { Injectable } from "@nestjs/common";
import { AddToWishlistDto, ShareWishlistDto } from "./dto/wishlist.dto.js";
import { WishlistEntity } from "./entities/wishlist.entity.js";

@Injectable()
export class WishlistService {
  private wishlist: WishlistEntity = new WishlistEntity({
    id: "wish_1",
    userId: "user_1",
    productIds: [],
    createdAt: new Date().toISOString(),
  });

  getWishlist(): WishlistEntity {
    return this.wishlist;
  }

  addProduct(input: AddToWishlistDto): WishlistEntity {
    const productIds = this.wishlist.productIds.includes(input.productId)
      ? this.wishlist.productIds
      : [...this.wishlist.productIds, input.productId];

    this.wishlist = new WishlistEntity({
      id: this.wishlist.id,
      userId: this.wishlist.userId,
      productIds,
      createdAt: this.wishlist.createdAt,
    });

    return this.wishlist;
  }

  removeProduct(productId: string): WishlistEntity {
    const productIds = this.wishlist.productIds.filter((id) => id !== productId);

    this.wishlist = new WishlistEntity({
      id: this.wishlist.id,
      userId: this.wishlist.userId,
      productIds,
      createdAt: this.wishlist.createdAt,
    });

    return this.wishlist;
  }

  shareWishlist(_input: ShareWishlistDto): { sent: boolean; email: string } {
    // Mock: share wishlist
    return { sent: true, email: _input.email };
  }
}
