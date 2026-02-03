import type { Device, Door, EventDirection } from "@prisma/client";

export type PulledDeviceEvent = {
  // REAL cihazda bazen employeeId hiç gelmez. O yüzden opsiyonel.
  employeeId?: string;

  // REAL cihazda en sık gelen kimlikler:
  cardNo?: string;
  deviceUserId?: string;

  occurredAt: Date;
  direction: EventDirection;

  // İdempotency anahtarı: aynı log tekrar gelirse aynı externalRef olmalı
  externalRef: string;

  // Debug için (opsiyonel)
  rawPayload?: unknown;
};

export type DeviceSyncPullArgs = {
  companyId: string;
  device: Pick<Device, "id" | "driver" | "doorId" | "ip" | "port" | "serialNo" | "lastSyncAt">;
  door: Pick<Door, "id" | "role" | "defaultDirection" | "isActive"> | null;
  limit: number;
  now?: Date;
};

export type DeviceSyncPullResult = {
  events: PulledDeviceEvent[];
  nextCursorAt: Date | null;
  meta?: Record<string, unknown>;
};

export interface DeviceSyncDriver {
  name: string;
  pull(args: DeviceSyncPullArgs): Promise<DeviceSyncPullResult>;
}
