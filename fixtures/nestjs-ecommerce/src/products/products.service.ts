import { Injectable } from "@nestjs/common";

import { SearchProductsQueryDto } from "./dto/search-products-query.dto.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { BulkImportProductsDto } from "./dto/bulk-import-products.dto.js";
import {
  CategoryEntity,
  ProductEntity,
  ProductRecommendationEntity,
  ProductInventoryEntity,
} from "./entities/product.entity.js";

@Injectable()
export class ProductsService {
  private products: ProductEntity[] = [
    new ProductEntity({
      id: "prod_1",
      name: "Trail Running Shoes",
      slug: "trail-running-shoes",
      brand: "Northstar",
      categoryId: "cat_shoes",
      priceCents: 12999,
      currency: "USD",
      inStock: true,
      tags: ["running", "outdoor"],
      ratingAverage: 4.7,
      reviewCount: 245,
      featured: true,
    }),
    new ProductEntity({
      id: "prod_2",
      name: "City Backpack",
      slug: "city-backpack",
      brand: "MetroPack",
      categoryId: "cat_bags",
      priceCents: 8999,
      currency: "USD",
      inStock: true,
      tags: ["commute", "travel"],
      ratingAverage: 4.4,
      reviewCount: 128,
      featured: false,
    }),
  ];

  private readonly categories: readonly CategoryEntity[] = [
    new CategoryEntity({ id: "cat_shoes", name: "Shoes" }),
    new CategoryEntity({ id: "cat_bags", name: "Bags" }),
    new CategoryEntity({ id: "cat_shoes_running", name: "Running Shoes", parentId: "cat_shoes" }),
  ];

  listProducts(): readonly ProductEntity[] {
    return this.products;
  }

  searchProducts(query: SearchProductsQueryDto): readonly ProductEntity[] {
    const searchTerm = query.query?.toLowerCase();

    return this.products.filter((product) => {
      const matchesSearch =
        searchTerm === undefined ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.tags.some((tag) => tag.includes(searchTerm));
      const matchesCategory =
        query.categoryId === undefined || product.categoryId === query.categoryId;
      const aboveMin =
        query.minPriceCents === undefined ||
        product.priceCents >= query.minPriceCents;
      const belowMax =
        query.maxPriceCents === undefined ||
        product.priceCents <= query.maxPriceCents;
      const matchesStock = query.inStockOnly !== true || product.inStock;

      return matchesSearch && matchesCategory && aboveMin && belowMax && matchesStock;
    });
  }

  getTrendingProducts(): readonly ProductEntity[] {
    // Mock: return featured products as trending
    return this.products.filter((p) => p.featured);
  }

  getFeaturedProducts(): readonly ProductEntity[] {
    return this.products.filter((p) => p.featured);
  }

  getProductById(productId: string): ProductEntity | undefined {
    return this.products.find((product) => product.id === productId);
  }

  listCategories(): readonly CategoryEntity[] {
    return this.categories;
  }

  getProductsByCategory(categoryId: string): readonly ProductEntity[] {
    return this.products.filter((product) => product.categoryId === categoryId);
  }

  getSubcategories(parentId: string): readonly CategoryEntity[] {
    return this.categories.filter((cat) => cat.parentId === parentId);
  }

  getRecommendations(productId: string): readonly ProductRecommendationEntity[] {
    return this.products
      .filter((product) => product.id !== productId)
      .slice(0, 3)
      .map(
        (product) =>
          new ProductRecommendationEntity({
            productId: product.id,
            reason: "Popular with similar shoppers",
            score: product.ratingAverage,
          }),
      );
  }

  getSimilarProducts(productId: string, limit: number): readonly ProductEntity[] {
    // Mock: return other products as similar
    return this.products.filter((p) => p.id !== productId).slice(0, limit);
  }

  getInventory(productId: string): ProductInventoryEntity | undefined {
    const product = this.getProductById(productId);
    if (!product) return undefined;

    // Mock inventory data
    return new ProductInventoryEntity({
      productId,
      quantity: 150,
      reserved: 23,
      available: 127,
      warehouseLocations: [
        { warehouseId: "wh_us_east", quantity: 100 },
        { warehouseId: "wh_us_west", quantity: 50 },
      ],
    });
  }

  createProduct(input: CreateProductDto): ProductEntity {
    // Mock: create a new product
    const newProduct = new ProductEntity({
      id: `prod_${Date.now()}`,
      name: input.name,
      slug: input.name.toLowerCase().replace(/\s+/g, "-"),
      brand: input.brand || "Generic",
      categoryId: input.categoryId,
      priceCents: input.priceCents,
      currency: input.currency,
      inStock: input.initialStock > 0,
      tags: input.tags || [],
      ratingAverage: 0,
      reviewCount: 0,
      featured: input.featured || false,
    });

    this.products.push(newProduct);
    return newProduct;
  }

  bulkImportProducts(input: BulkImportProductsDto): { imported: number; failed: number } {
    // Mock: import products in batches
    const batchSize = input.batchSize || 100;
    let imported = 0;
    let failed = 0;

    for (const item of input.products) {
      try {
        const product = new ProductEntity({
          id: item.id,
          name: item.name,
          slug: item.name.toLowerCase().replace(/\s+/g, "-"),
          brand: "Imported",
          categoryId: item.categoryId,
          priceCents: item.priceCents,
          currency: item.currency,
          inStock: true,
          tags: [],
          ratingAverage: 0,
          reviewCount: 0,
        });
        this.products.push(product);
        imported++;
      } catch {
        failed++;
      }
    }

    return { imported, failed };
  }

  deleteProduct(productId: string): { success: boolean } {
    // Mock: soft delete product (filter it out from listing)
    const index = this.products.findIndex((p) => p.id === productId);
    if (index > -1) {
      this.products = this.products.filter((p) => p.id !== productId);
      return { success: true };
    }
    return { success: false };
  }
}
