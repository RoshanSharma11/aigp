import { Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { SearchProductsQueryDto } from "./dto/search-products-query.dto.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { BulkImportProductsDto } from "./dto/bulk-import-products.dto.js";
import {
  CategoryEntity,
  ProductEntity,
  ProductRecommendationEntity,
  ProductInventoryEntity,
} from "./entities/product.entity.js";
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

  @Get("trending")
  getTrendingProducts(): readonly ProductEntity[] {
    return this.productsService.getTrendingProducts();
  }

  @Get("featured")
  getFeaturedProducts(): readonly ProductEntity[] {
    return this.productsService.getFeaturedProducts();
  }

  @Get("categories")
  listCategories(): readonly CategoryEntity[] {
    return this.productsService.listCategories();
  }

  @Get("categories/:categoryId")
  getProductsByCategory(
    @Param("categoryId") categoryId: string
  ): readonly ProductEntity[] {
    return this.productsService.getProductsByCategory(categoryId);
  }

  @Get("categories/:categoryId/subcategories")
  getSubcategories(
    @Param("categoryId") categoryId: string
  ): readonly CategoryEntity[] {
    return this.productsService.getSubcategories(categoryId);
  }

  @Get(":productId")
  getProductById(
    @Param("productId") productId: string
  ): ProductEntity | undefined {
    return this.productsService.getProductById(productId);
  }

  @Get(":productId/recommendations")
  getProductRecommendations(
    @Param("productId") productId: string
  ): readonly ProductRecommendationEntity[] {
    return this.productsService.getRecommendations(productId);
  }

  @Get(":productId/inventory")
  getProductInventory(
    @Param("productId") productId: string
  ): ProductInventoryEntity | undefined {
    return this.productsService.getInventory(productId);
  }

  @Get(":productId/similar")
  getSimilarProducts(
    @Param("productId") productId: string,
    @Query("limit") limit?: string
  ): readonly ProductEntity[] {
    return this.productsService.getSimilarProducts(productId, parseInt(limit || "5", 10));
  }

  @Post()
  @UseGuards(AuthGuard)
  createProduct(@Body() input: CreateProductDto): ProductEntity {
    return this.productsService.createProduct(input);
  }

  @Post("bulk-import")
  @UseGuards(AuthGuard)
  bulkImportProducts(@Body() input: BulkImportProductsDto): { imported: number; failed: number } {
    return this.productsService.bulkImportProducts(input);
  }

  @Delete(":productId")
  @UseGuards(AuthGuard)
  deleteProduct(@Param("productId") productId: string): { success: boolean } {
    return this.productsService.deleteProduct(productId);
  }
}
