export class ReviewEntity {
  readonly id: string;
  readonly productId: string;
  readonly userId: string;
  readonly rating: number;
  readonly title: string;
  readonly content: string;
  readonly helpful: number;
  readonly createdAt: string;

  constructor(input: {
    id: string;
    productId: string;
    userId: string;
    rating: number;
    title: string;
    content: string;
    helpful: number;
    createdAt: string;
  }) {
    this.id = input.id;
    this.productId = input.productId;
    this.userId = input.userId;
    this.rating = input.rating;
    this.title = input.title;
    this.content = input.content;
    this.helpful = input.helpful;
    this.createdAt = input.createdAt;
  }
}
