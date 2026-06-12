export class ProductEntity {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string;
  readonly categoryId: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly inStock: boolean;
  readonly tags: readonly string[];
  readonly ratingAverage: number;
  readonly reviewCount: number | undefined;
  readonly featured: boolean | undefined;

  constructor(input: {
    id: string;
    name: string;
    slug: string;
    brand: string;
    categoryId: string;
    priceCents: number;
    currency: string;
    inStock: boolean;
    tags: readonly string[];
    ratingAverage: number;
    reviewCount?: number;
    featured?: boolean;
  }) {
    this.id = input.id;
    this.name = input.name;
    this.slug = input.slug;
    this.brand = input.brand;
    this.categoryId = input.categoryId;
    this.priceCents = input.priceCents;
    this.currency = input.currency;
    this.inStock = input.inStock;
    this.tags = input.tags;
    this.ratingAverage = input.ratingAverage;
    this.reviewCount = input.reviewCount;
    this.featured = input.featured;
  }
}

export class ProductRecommendationEntity {
  readonly productId: string;
  readonly reason: string;
  readonly score: number;

  constructor(input: {
    productId: string;
    reason: string;
    score: number;
  }) {
    this.productId = input.productId;
    this.reason = input.reason;
    this.score = input.score;
  }
}

export class CategoryEntity {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | undefined;

  constructor(input: {
    id: string;
    name: string;
    parentId?: string;
  }) {
    this.id = input.id;
    this.name = input.name;
    this.parentId = input.parentId;
  }
}

export class ProductInventoryEntity {
  readonly productId: string;
  readonly quantity: number;
  readonly reserved: number;
  readonly available: number;
  readonly warehouseLocations: readonly { warehouseId: string; quantity: number }[];

  constructor(input: {
    productId: string;
    quantity: number;
    reserved: number;
    available: number;
    warehouseLocations: readonly { warehouseId: string; quantity: number }[];
  }) {
    this.productId = input.productId;
    this.quantity = input.quantity;
    this.reserved = input.reserved;
    this.available = input.available;
    this.warehouseLocations = input.warehouseLocations;
  }
}
