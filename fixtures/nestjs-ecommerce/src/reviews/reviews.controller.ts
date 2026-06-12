import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { ReviewsService } from "./reviews.service.js";
import { CreateReviewDto, UpdateReviewDto } from "./dto/create-review.dto.js";
import { ReviewEntity } from "./entities/review.entity.js";

@Controller("reviews")
export class ReviewsController {
  constructor(
    @Inject(ReviewsService)
    private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  addReview(@Body() input: CreateReviewDto): ReviewEntity {
    return this.reviewsService.addReview(input);
  }

  @Get("product/:productId")
  listReviews(
    @Param("productId") productId: string,
    @Query("limit") limit?: string
  ): readonly ReviewEntity[] {
    return this.reviewsService.listReviews(productId, parseInt(limit || "10", 10));
  }

  @Patch(":reviewId")
  @UseGuards(AuthGuard)
  updateReview(@Param("reviewId") reviewId: string, @Body() input: UpdateReviewDto): ReviewEntity | undefined {
    return this.reviewsService.updateReview(reviewId, input);
  }

  @Delete(":reviewId")
  @UseGuards(AuthGuard)
  deleteReview(@Param("reviewId") reviewId: string): { success: boolean } {
    return this.reviewsService.deleteReview(reviewId);
  }

  @Post(":reviewId/helpful")
  markHelpful(@Param("reviewId") reviewId: string): ReviewEntity | undefined {
    return this.reviewsService.markHelpful(reviewId);
  }
}
