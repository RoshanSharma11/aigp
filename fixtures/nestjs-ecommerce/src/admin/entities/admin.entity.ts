export class DashboardStatsEntity {
  readonly totalUsers: number;
  readonly totalOrders: number;
  readonly totalRevenue: number;
  readonly averageOrderValue: number;

  constructor(input: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  }) {
    this.totalUsers = input.totalUsers;
    this.totalOrders = input.totalOrders;
    this.totalRevenue = input.totalRevenue;
    this.averageOrderValue = input.averageOrderValue;
  }
}

export class UserEntity {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly createdAt: string;

  constructor(input: { id: string; email: string; role: string; createdAt: string }) {
    this.id = input.id;
    this.email = input.email;
    this.role = input.role;
    this.createdAt = input.createdAt;
  }
}
