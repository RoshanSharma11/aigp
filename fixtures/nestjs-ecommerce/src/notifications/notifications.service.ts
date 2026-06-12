import { Injectable } from "@nestjs/common";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto.js";
import { NotificationEntity } from "./entities/notification.entity.js";

@Injectable()
export class NotificationsService {
  private notifications: NotificationEntity[] = [];
  private preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
  } = {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
  };

  listNotifications(unreadOnly: boolean = false): readonly NotificationEntity[] {
    return unreadOnly ? this.notifications.filter((n) => !n.read) : this.notifications;
  }

  markAsRead(notificationId: string): NotificationEntity | undefined {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (!notification) return undefined;

    const updated = new NotificationEntity({
      ...notification,
      read: true,
    });

    this.notifications = this.notifications.map((n) => (n.id === notificationId ? updated : n));
    return updated;
  }

  deleteNotification(notificationId: string): { success: boolean } {
    const index = this.notifications.findIndex((n) => n.id === notificationId);
    if (index === -1) return { success: false };

    this.notifications.splice(index, 1);
    return { success: true };
  }

  getPreferences(): typeof this.preferences {
    return this.preferences;
  }

  updatePreferences(input: UpdatePreferencesDto): typeof this.preferences {
    this.preferences = {
      emailNotifications: input.emailNotifications ?? this.preferences.emailNotifications,
      pushNotifications: input.pushNotifications ?? this.preferences.pushNotifications,
      smsNotifications: input.smsNotifications ?? this.preferences.smsNotifications,
    };

    return this.preferences;
  }
}
