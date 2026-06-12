export class ProductEntity {
  readonly id: string;
  readonly name: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly inStock: boolean;

  constructor(input: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    inStock: boolean;
  }) {
    this.id = input.id;
    this.name = input.name;
    this.priceCents = input.priceCents;
    this.currency = input.currency;
    this.inStock = input.inStock;
  }
}
