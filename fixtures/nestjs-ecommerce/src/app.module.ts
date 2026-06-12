import path from "node:path";
import { fileURLToPath } from "node:url";

import { Module } from "@nestjs/common";

import { AgentLayerModule } from "@agent-layer/sdk";

import { AuthModule } from "./auth/auth.module.js";
import { CartModule } from "./cart/cart.module.js";
import { ProductsModule } from "./products/products.module.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "..",
);

@Module({
  imports: [
    ProductsModule,
    CartModule,
    AuthModule,
    AgentLayerModule.forRoot({
      rootPath: fixtureRoot,
      baseUrl: "http://localhost:3000",
      agentName: "Fixture Ecommerce Agent",
      agentDescription: "Agent capability layer for the NestJS ecommerce fixture app",
    }),
  ],
})
export class AppModule {}
