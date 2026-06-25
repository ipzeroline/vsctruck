import { AppConfig } from "./config";

export type UnknownRecord = Record<string, unknown>;

export type Vehicle = UnknownRecord & {
  registration?: string;
  vehicle_id?: string | number;
  vehicle_name?: string | null;
  driver_id?: string | null;
  default_driver?: string | null;
};

export type Driver = UnknownRecord & {
  driver_id?: string;
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
};

export type OdometerSummary = {
  registration: string;
  distanceKm: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
};

export type FuelSummary = {
  registration: string;
  fuelUsedLiters: number | null;
};

export type VehicleActivityDriver = UnknownRecord & {
  driver_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type VehicleActivity = UnknownRecord & {
  registration?: string;
  drivers?: VehicleActivityDriver[];
  first_ignition_on?: string | null;
  last_ignition_off?: string | null;
};

export type VehicleDriverLink = UnknownRecord & {
  registration?: string;
  driver_id?: string;
  driver_name?: string | null;
  driver_surname?: string | null;
};

export type VehicleStatus = UnknownRecord & {
  registration?: string;
  vehicle_id?: string | number;
  event_ts?: string | null;
  bearing?: number | null;
  speed?: number | null;
  ignition?: boolean | null;
  idling?: boolean | null;
  odometer?: number | null;
  driver?: VehicleActivityDriver | null;
  fuel?: {
    level?: number | null;
    precentage_left?: number | null;
    percentage_left?: number | null;
    total_consumed?: number | null;
    updated?: string | null;
  } | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
    updated?: string | null;
    position_description?: string | null;
    gps_fix_type?: number | null;
  } | null;
};

export type FleetStatusRow = {
  key: string;
  registration: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  driverName: string;
  speed: number | null;
  ignition: boolean | null;
  idling: boolean | null;
  bearing: number | null;
  eventTs: string | null;
  locationUpdated: string | null;
  positionDescription: string;
  fuelLevel: number | null;
  fuelPercentage: number | null;
  fuelTotalConsumed: number | null;
  fuelUpdated: string | null;
  gpsFixType: number | null;
  odometerKm: number | null;
};

export class CartrackClient {
  constructor(private readonly config: AppConfig) {}

  async getVehicles(limit = 100): Promise<Vehicle[]> {
    return this.getPaginated<Vehicle>("/vehicles", { limit: String(limit) });
  }

  async getDrivers(limit = 100): Promise<Driver[]> {
    return this.getPaginated<Driver>("/drivers", { limit: String(limit) });
  }

  async getVehiclesActivity(date: string, limit = 100): Promise<VehicleActivity[]> {
    return this.getPaginated<VehicleActivity>("/vehicles/activity", {
      "filter[date]": date,
      limit: String(limit),
    });
  }

  async getVehicleDriverLinks(limit = 100): Promise<VehicleDriverLink[]> {
    return this.getPaginated<VehicleDriverLink>("/vehicles/drivers/links", {
      limit: String(limit),
    });
  }

  async getVehicleStatuses(limit = 100): Promise<FleetStatusRow[]> {
    const statuses = await this.getPaginated<VehicleStatus>("/vehicles/status", {
      limit: String(limit),
      odometer_in_km: "true",
    });

    return statuses.flatMap((status, index) => {
      const registration = getRegistration(status);
      const latitude = status.location?.latitude;
      const longitude = status.location?.longitude;
      if (!registration || typeof latitude !== "number" || typeof longitude !== "number") {
        return [];
      }

      return [
        {
          key: `${status.vehicle_id ?? registration}:${registration}:${index}`,
          registration,
          vehicleId: String(status.vehicle_id ?? ""),
          latitude,
          longitude,
          driverName: getStatusDriverName(status),
          speed: typeof status.speed === "number" ? status.speed : null,
          ignition: typeof status.ignition === "boolean" ? status.ignition : null,
          idling: typeof status.idling === "boolean" ? status.idling : null,
          bearing: typeof status.bearing === "number" ? status.bearing : null,
          eventTs: status.event_ts ?? null,
          locationUpdated: status.location?.updated ?? null,
          positionDescription: status.location?.position_description ?? "-",
          fuelLevel: typeof status.fuel?.level === "number" ? status.fuel.level : null,
          fuelPercentage:
            typeof status.fuel?.percentage_left === "number"
              ? status.fuel.percentage_left
              : typeof status.fuel?.precentage_left === "number"
                ? status.fuel.precentage_left
                : null,
          fuelTotalConsumed: typeof status.fuel?.total_consumed === "number" ? status.fuel.total_consumed : null,
          fuelUpdated: status.fuel?.updated ?? null,
          gpsFixType: typeof status.location?.gps_fix_type === "number" ? status.location.gps_fix_type : null,
          odometerKm: typeof status.odometer === "number" ? status.odometer : null,
        },
      ];
    });
  }

  async getOdometer(registration: string, startTimestamp: string, endTimestamp: string): Promise<OdometerSummary> {
    const response = await this.request<{ data?: UnknownRecord | null }>(
      `/vehicles/${encodeURIComponent(registration)}/odometer`,
      {
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
      },
    );
    const data = response.data ?? {};
    const startOdometer = readNumber(data, ["start_odometer_value", "start_odometer", "odometer_start"]);
    const endOdometer = readNumber(data, ["end_odometer_value", "end_odometer", "odometer_end"]);
    const distance = readNumber(data, ["distance", "distance_travelled", "distance_km"]);

    return {
      registration,
      distanceKm: metersToKm(distance ?? diff(startOdometer, endOdometer)),
      startOdometer,
      endOdometer,
    };
  }

  async getFuelLevels(
    registrations: string[],
    startTimestamp: string,
    endTimestamp: string,
  ): Promise<FuelSummary[]> {
    if (registrations.length === 0) {
      return [];
    }

    const response = await this.request<{ data?: UnknownRecord[] }>("/fuel/level", undefined, {
      method: "POST",
      body: JSON.stringify({
        registrations,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        limit: registrations.length,
      }),
    });

    return (response.data ?? []).map((item) => {
      const registration = String(item.registration ?? "");
      return {
        registration,
        fuelUsedLiters: readNumber(item, [
          "fuel_used_liters",
          "fuel_used",
          "estimated_fuel_used",
          "fuel_consumed",
          "used_liters",
        ]),
      };
    });
  }

  private async getPaginated<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const rows: T[] = [];
    const maxPages = 50;

    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.request<{ data?: T[]; meta?: UnknownRecord }>(path, {
        ...params,
        page: String(page),
      });
      const pageRows = response.data ?? [];
      rows.push(...pageRows);

      if (!hasNextPage(response.meta, page, pageRows.length, Number(params.limit ?? 100))) {
        break;
      }
    }

    return rows;
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
    init?: RequestInit,
  ): Promise<T> {
    const url = new URL(`${this.config.cartrackBaseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${this.config.cartrackUsername}:${this.config.cartrackPassword}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cartrack ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
    }

    return (await response.json()) as T;
  }
}

export function getRegistration(vehicle: Vehicle): string | null {
  const value = vehicle.registration ?? vehicle.vehicle_registration ?? vehicle.reg;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getDriverName(driver?: Driver): string {
  if (!driver) {
    return "-";
  }

  const fullName = [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim();
  return fullName || String(driver.name ?? driver.driver_id ?? driver.id ?? "-");
}

export function getActivityDriverNames(activity?: VehicleActivity): string {
  const names = (activity?.drivers ?? [])
    .map((driver) => [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim())
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : "-";
}

export function getLinkDriverName(link?: VehicleDriverLink): string {
  const name = [link?.driver_name, link?.driver_surname].filter(Boolean).join(" ").trim();
  return name || "-";
}

export function getStatusDriverName(status?: VehicleStatus): string {
  const driver = status?.driver;
  const name = [driver?.first_name, driver?.last_name].filter(Boolean).join(" ").trim();
  return name || "-";
}

export function getDriverIdFromVehicle(vehicle: Vehicle): string | null {
  const driver = isRecord(vehicle.driver) ? vehicle.driver : {};
  const value = vehicle.driver_id ?? vehicle.current_driver_id ?? vehicle.default_driver ?? driver.driver_id ?? driver.id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function diff(start: number | null, end: number | null): number | null {
  if (typeof start !== "number" || typeof end !== "number") {
    return null;
  }
  return Math.max(0, end - start);
}

function metersToKm(value: number | null): number | null {
  return typeof value === "number" ? value / 1000 : null;
}

function hasNextPage(meta: UnknownRecord | undefined, page: number, count: number, limit: number): boolean {
  if (count < limit) {
    return false;
  }

  const current = Number(meta?.current_page ?? meta?.page ?? page);
  const last = Number(meta?.last_page ?? meta?.total_pages ?? 0);
  if (last > 0) {
    return current < last;
  }

  return count === limit;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}
