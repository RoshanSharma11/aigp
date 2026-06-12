import { Injectable } from "@nestjs/common";
import { UpdateUserRoleDto, ListUsersQueryDto } from "./dto/admin.dto.js";
import { DashboardStatsEntity, UserEntity } from "./entities/admin.entity.js";

@Injectable()
export class AdminService {
  private users: UserEntity[] = [
    new UserEntity({
      id: "user_1",
      email: "user1@fixture.local",
      role: "customer",
      createdAt: new Date().toISOString(),
    }),
    new UserEntity({
      id: "user_admin",
      email: "admin@fixture.local",
      role: "admin",
      createdAt: new Date().toISOString(),
    }),
  ];

  getDashboardStats(): DashboardStatsEntity {
    // Mock: return dashboard stats
    return new DashboardStatsEntity({
      totalUsers: this.users.length,
      totalOrders: 42,
      totalRevenue: 125000,
      averageOrderValue: 2976,
    });
  }

  listUsers(query: ListUsersQueryDto): { users: readonly UserEntity[]; total: number } {
    const limit = query.limit || 10;
    const offset = query.offset || 0;

    let filtered = this.users;
    if (query.role) {
      filtered = filtered.filter((u) => u.role === query.role);
    }

    const users = filtered.slice(offset, offset + limit);
    return { users, total: filtered.length };
  }

  getUser(userId: string): UserEntity | undefined {
    return this.users.find((u) => u.id === userId);
  }

  updateUserRole(userId: string, input: UpdateUserRoleDto): UserEntity | undefined {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return undefined;

    const updated = new UserEntity({
      ...user,
      role: input.role,
    });

    this.users = this.users.map((u) => (u.id === userId ? updated : u));
    return updated;
  }

  deleteUser(userId: string): { success: boolean } {
    const index = this.users.findIndex((u) => u.id === userId);
    if (index === -1) return { success: false };

    this.users.splice(index, 1);
    return { success: true };
  }

  getProductAnalytics(): {
    totalProducts: number;
    topSelling: readonly { productId: string; sales: number }[];
  } {
    // Mock: return product analytics
    return {
      totalProducts: 128,
      topSelling: [
        { productId: "prod_1", sales: 456 },
        { productId: "prod_2", sales: 234 },
      ],
    };
  }

  getRevenueReport(days: number = 30): readonly { date: string; revenue: number }[] {
    // Mock: return revenue report
    const report: { date: string; revenue: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      report.push({
        date: date.toISOString().split("T")[0]!,
        revenue: Math.floor(Math.random() * 5000),
      });
    }
    return report;
  }
}
