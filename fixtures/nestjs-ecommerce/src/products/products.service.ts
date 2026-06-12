import { Injectable } from "@nestjs/common";

import { SearchProductsQueryDto } from "./dto/search-products-query.dto.js";
import { ProductEntity } from "./entities/product.entity.js";

@Injectable()
export class ProductsService {
  private readonly products: readonly ProductEntity[] = [
    new ProductEntity({
      id: "prod_1",
      name: "Trail Running Shoes",
      priceCents: 12999,
      currency: "USD",
      inStock: true
    }),
    new ProductEntity({
      id: "prod_2",
      name: "City Backpack",
      priceCents: 8999,
      currency: "USD",
      inStock: true
    })
  ];

  listProducts(): readonly ProductEntity[] {
    return this.products;
  }

  searchProducts(query: SearchProductsQueryDto): readonly ProductEntity[] {
    if (!query.query) {
      return this.products;
    }

    const searchTerm = query.query.toLowerCase();
    return this.products.filter((product) =>
      product.name.toLowerCase().includes(searchTerm)
    );
  }

  getProductById(productId: string): ProductEntity | undefined {
    return this.products.find((product) => product.id === productId);
  }
}
