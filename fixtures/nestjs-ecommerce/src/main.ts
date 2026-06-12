import "reflect-metadata";

import { RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api", {
    exclude: [
      { path: ".well-known/(.*)", method: RequestMethod.ALL },
      { path: "agent/(.*)", method: RequestMethod.ALL },
    ],
  });
  await app.listen(3000);
}

void bootstrap();
