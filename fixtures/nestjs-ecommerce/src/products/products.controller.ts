import { Controller, Get, Inject, Param, Query } from "@nestjs/common";

import { SearchProductsQueryDto } from "./dto/search-products-query.dto.js";
import { ProductEntity } from "./entities/product.entity.js";
import { ProductsService } from "./products.service.js";

@Controller("products")
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  listProducts(): readonly ProductEntity[] {
    return this.productsService.listProducts();
  }

  @Get("search")
  searchProducts(
    @Query() query: SearchProductsQueryDto
  ): readonly ProductEntity[] {
    return this.productsService.searchProducts(query);
  }

  @Get(":productId")
  getProductById(
    @Param("productId") productId: string
  ): ProductEntity | undefined {
    return this.productsService.getProductById(productId);
  }
}
