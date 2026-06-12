import { Injectable } from "@nestjs/common";
import { CreateReviewDto, UpdateReviewDto } from "./dto/create-review.dto.js";
import { ReviewEntity } from "./entities/review.entity.js";

@Injectable()
export class ReviewsService {
  private reviews: ReviewEntity[] = [];

  addReview(input: CreateReviewDto): ReviewEntity {
    const review = new ReviewEntity({
      id: `rev_${Date.now()}`,
      productId: input.productId,
      userId: "user_1",
      rating: input.rating,
      title: input.title,
      content: input.content,
      helpful: 0,
      createdAt: new Date().toISOString(),
    });

    this.reviews.push(review);
    return review;
  }

  listReviews(productId: string, limit: number = 10): readonly ReviewEntity[] {
    return this.reviews.filter((r) => r.productId === productId).slice(0, limit);
  }

  updateReview(reviewId: string, input: UpdateReviewDto): ReviewEntity | undefined {
    const review = this.reviews.find((r) => r.id === reviewId);
    if (!review) return undefined;

    const updated = new ReviewEntity({
      ...review,
      rating: input.rating ?? review.rating,
      title: input.title ?? review.title,
      content: input.content ?? review.content,
    });

    this.reviews = this.reviews.map((r) => (r.id === reviewId ? updated : r));
    return updated;
  }

  deleteReview(reviewId: string): { success: boolean } {
    const index = this.reviews.findIndex((r) => r.id === reviewId);
    if (index === -1) return { success: false };

    this.reviews.splice(index, 1);
    return { success: true };
  }

  markHelpful(reviewId: string): ReviewEntity | undefined {
    const review = this.reviews.find((r) => r.id === reviewId);
    if (!review) return undefined;

    const updated = new ReviewEntity({
      ...review,
      helpful: review.helpful + 1,
    });

    this.reviews = this.reviews.map((r) => (r.id === reviewId ? updated : r));
    return updated;
  }
}
