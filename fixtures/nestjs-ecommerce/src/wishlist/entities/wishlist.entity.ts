export class WishlistEntity {
  readonly id: string;
  readonly userId: string;
  readonly productIds: readonly string[];
  readonly createdAt: string;

  constructor(input: {
    id: string;
    userId: string;
    productIds: readonly string[];
    createdAt: string;
  }) {
    this.id = input.id;
    this.userId = input.userId;
    this.productIds = input.productIds;
    this.createdAt = input.createdAt;
  }
}
