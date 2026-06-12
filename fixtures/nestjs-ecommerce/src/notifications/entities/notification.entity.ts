export class NotificationEntity {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly read: boolean;
  readonly createdAt: string;

  constructor(input: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  }) {
    this.id = input.id;
    this.userId = input.userId;
    this.type = input.type;
    this.title = input.title;
    this.message = input.message;
    this.read = input.read;
    this.createdAt = input.createdAt;
  }
}
