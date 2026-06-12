import { Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { AdminService } from "./admin.service.js";
import { UpdateUserRoleDto, ListUsersQueryDto } from "./dto/admin.dto.js";
import { DashboardStatsEntity, UserEntity } from "./entities/admin.entity.js";

// Note: In a real app, would have additional AdminGuard to check for admin role
@Controller("admin")
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService,
  ) {}

  @Get("dashboard/stats")
  getDashboardStats(): DashboardStatsEntity {
    return this.adminService.getDashboardStats();
  }

  @Get("users")
  listUsers(@Query() query: ListUsersQueryDto): { users: readonly UserEntity[]; total: number } {
    return this.adminService.listUsers(query);
  }

  @Get("users/:userId")
  getUser(@Param("userId") userId: string): UserEntity | undefined {
    return this.adminService.getUser(userId);
  }

  @Post("users/:userId/role")
  updateUserRole(@Param("userId") userId: string, @Body() input: UpdateUserRoleDto): UserEntity | undefined {
    return this.adminService.updateUserRole(userId, input);
  }

  @Delete("users/:userId")
  deleteUser(@Param("userId") userId: string): { success: boolean } {
    return this.adminService.deleteUser(userId);
  }

  @Get("analytics/products")
  getProductAnalytics(): { totalProducts: number; topSelling: readonly { productId: string; sales: number }[] } {
    return this.adminService.getProductAnalytics();
  }

  @Get("reports/revenue")
  getRevenueReport(@Query("days") days?: string): readonly { date: string; revenue: number }[] {
    return this.adminService.getRevenueReport(parseInt(days || "30", 10));
  }
}
