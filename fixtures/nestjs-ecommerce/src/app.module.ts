import path from "node:path";
import { fileURLToPath } from "node:url";

import { Module } from "@nestjs/common";

import { AgentLayerModule } from "@agent-layer/sdk";

import { AuthModule } from "./auth/auth.module.js";
import { CartModule } from "./cart/cart.module.js";
import { ProductsModule } from "./products/products.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";
import { WishlistModule } from "./wishlist/wishlist.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { AdminModule } from "./admin/admin.module.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "..",
);

@Module({
  imports: [
    ProductsModule,
    CartModule,
    AuthModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    WishlistModule,
    NotificationsModule,
    AdminModule,
    AgentLayerModule.forRoot({
      rootPath: fixtureRoot,
      baseUrl: "http://localhost:3000",
      agentName: "Fixture Ecommerce Agent",
      agentDescription: "Agent capability layer for the NestJS ecommerce fixture app",
    }),
  ],
})
export class AppModule {}
