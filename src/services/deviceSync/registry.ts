import { DeviceDriver } from "@prisma/client";
import type { DeviceSyncDriver } from "@/src/services/deviceSync/driver";
import { simulatorDriver } from "@/src/services/deviceSync/drivers/simulator.driver";
import { zktecoPullDriver } from "@/src/services/deviceSync/drivers/zktecoPull.driver";
import { zktecoPushDriver } from "@/src/services/deviceSync/drivers/zktecoPush.driver";
import { genericDriver } from "@/src/services/deviceSync/drivers/generic.driver";

/**
 * "Tak-çalıştır" hedefi: /api/devices/sync aynı kalır.
 * - Şu an cihaz yok => default SIMULATOR.
 * - Cihaz gelince => DEVICE_SYNC_MODE=REAL yap, ilgili driver implementasyonunu doldur.
 */
export function resolveDeviceSyncDriver(driver: DeviceDriver): DeviceSyncDriver {
  const mode = String(process.env.DEVICE_SYNC_MODE ?? "SIMULATOR").toUpperCase();

  // Default: simülasyon.
  if (mode !== "REAL") return simulatorDriver;

  switch (driver) {
    case DeviceDriver.ZKTECO_PULL:
      return zktecoPullDriver;
    case DeviceDriver.ZKTECO_PUSH:
      return zktecoPushDriver;
    case DeviceDriver.GENERIC:
    default:
      return genericDriver;
  }
}
