import { Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { NotificationsService } from "./notifications.service.js";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto.js";
import { NotificationEntity } from "./entities/notification.entity.js";

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  listNotifications(@Query("unreadOnly") unreadOnly?: string): readonly NotificationEntity[] {
    return this.notificationsService.listNotifications(unreadOnly === "true");
  }

  @Post(":notificationId/read")
  markAsRead(@Param("notificationId") notificationId: string): NotificationEntity | undefined {
    return this.notificationsService.markAsRead(notificationId);
  }

  @Delete(":notificationId")
  deleteNotification(@Param("notificationId") notificationId: string): { success: boolean } {
    return this.notificationsService.deleteNotification(notificationId);
  }

  @Get("preferences")
  getPreferences(): { emailNotifications: boolean; pushNotifications: boolean; smsNotifications: boolean } {
    return this.notificationsService.getPreferences();
  }

  @Post("preferences")
  updatePreferences(
    @Body() input: UpdatePreferencesDto
  ): { emailNotifications: boolean; pushNotifications: boolean; smsNotifications: boolean } {
    return this.notificationsService.updatePreferences(input);
  }
}
