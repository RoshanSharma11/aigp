export interface CartItem {
  readonly productId: string;
  readonly quantity: number;
}

export class CartEntity {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly CartItem[];

  constructor(input: {
    id: string;
    userId: string;
    items: readonly CartItem[];
  }) {
    this.id = input.id;
    this.userId = input.userId;
    this.items = input.items;
  }
}
