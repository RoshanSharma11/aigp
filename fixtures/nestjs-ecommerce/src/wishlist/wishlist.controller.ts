import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { WishlistService } from "./wishlist.service.js";
import { AddToWishlistDto, ShareWishlistDto } from "./dto/wishlist.dto.js";
import { WishlistEntity } from "./entities/wishlist.entity.js";

@Controller("wishlist")
@UseGuards(AuthGuard)
export class WishlistController {
  constructor(
    @Inject(WishlistService)
    private readonly wishlistService: WishlistService,
  ) {}

  @Get()
  getWishlist(): WishlistEntity {
    return this.wishlistService.getWishlist();
  }

  @Post("add")
  addProduct(@Body() input: AddToWishlistDto): WishlistEntity {
    return this.wishlistService.addProduct(input);
  }

  @Delete(":productId")
  removeProduct(@Param("productId") productId: string): WishlistEntity {
    return this.wishlistService.removeProduct(productId);
  }

  @Post("share")
  shareWishlist(@Body() input: ShareWishlistDto): { sent: boolean; email: string } {
    return this.wishlistService.shareWishlist(input);
  }
}
