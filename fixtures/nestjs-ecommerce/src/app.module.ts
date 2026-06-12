import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { CartModule } from "./cart/cart.module.js";
import { ProductsModule } from "./products/products.module.js";

@Module({
  imports: [ProductsModule, CartModule, AuthModule],
})
export class AppModule {}
