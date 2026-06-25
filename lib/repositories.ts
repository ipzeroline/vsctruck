import { ObjectId, type WithId } from "mongodb";
import type { FleetStatusRow } from "./cartrack";
import type { DailyReport } from "./report";
import { hashPassword, verifyPassword } from "./auth";
import { ensureMongoIndexes, getDb } from "./mongodb";
import { deleteTimedCache } from "./server/timed-cache";

export type ReportDocument = {
  _id?: ObjectId;
  createdAt: Date;
  sent: boolean;
  vehicleCount: number;
  fuelAvailableCount: number;
  summary: DailyReport["summary"];
  window: DailyReport["window"];
  rows: DailyReport["rows"];
  text: string;
};

export type StaffDocument = {
  _id?: ObjectId;
  name: string;
  email: string;
  username: string;
  passwordHash?: string;
  role: "admin" | "manager" | "viewer";
  status: "active" | "inactive";
  telegramChatId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StaffInput = {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: StaffDocument["role"];
  status?: StaffDocument["status"];
  telegramChatId?: string;
};

export type FuelSnapshotDocument = {
  _id?: ObjectId;
  createdAt: Date;
  labelDate: string;
  rows: FuelSnapshotRow[];
};

export type FuelSnapshotRow = {
  registration: string;
  vehicleId: string;
  driverName: string;
  fuelLevel: number | null;
  fuelPercentage: number | null;
  fuelTotalConsumed?: number | null;
  fuelUpdated?: string | null;
  odometerKm: number | null;
  locationUpdated: string | null;
  positionDescription: string;
};

export type FuelRefillEvent = {
  registration: string;
  driverName: string;
  beforeLiters: number;
  afterLiters: number;
  refilledLiters: number;
  beforeTime: string;
  afterTime: string;
  positionDescription: string;
};

export type FuelDetectedRefillDocument = FuelRefillEvent & {
  _id?: ObjectId;
  eventKey: string;
  labelDate: string;
  vehicleId: string;
  status: "detected" | "confirmed" | "dismissed";
  confidence: "high" | "medium" | "low";
  sampleCount: number;
  odometerBefore: number | null;
  odometerAfter: number | null;
  detectedAt: Date;
  updatedAt: Date;
};

export type ActualFuelRefillDocument = {
  _id?: ObjectId;
  labelDate: string;
  registration: string;
  driverName: string;
  liters: number;
  filledAt: Date;
  stationName: string;
  receiptNo: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ActualFuelRefillInput = {
  labelDate: string;
  registration: string;
  driverName?: string;
  liters: number;
  filledAt?: string;
  stationName?: string;
  receiptNo?: string;
  note?: string;
};

export type ActualFuelRefill = {
  id: string;
  labelDate: string;
  registration: string;
  driverName: string;
  liters: number;
  filledAt: string;
  stationName: string;
  receiptNo: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type FuelReconciliation = {
  registration: string;
  driverName: string;
  actualLiters: number;
  sensorIncreaseLiters: number;
  varianceLiters: number;
  status: "matched" | "warning" | "critical" | "sensor_only" | "actual_only";
  confidence: "high" | "medium" | "low";
  receiptCount: number;
  sampleCount: number;
  latestFuelLiters: number | null;
  actualRefills: ActualFuelRefill[];
  sensorEvent: FuelRefillEvent | null;
};

const FUEL_REFILL_MIN_INCREASE_LITERS = 10;
const FUEL_SENSOR_NOISE_TOLERANCE_LITERS = 3;

export type VehicleStatusSnapshotDocument = {
  _id?: ObjectId;
  createdAt: Date;
  labelDate: string;
  rows: VehicleStatusSnapshotRow[];
};

export type VehicleStatusSnapshotRow = FuelSnapshotRow & {
  latitude: number;
  longitude: number;
  speed: number | null;
  ignition: boolean | null;
  idling: boolean | null;
  bearing: number | null;
  eventTs: string | null;
  gpsFixType: number | null;
};

export type DriverAuditSeverity = "critical" | "high" | "medium" | "low";
export type DriverAuditStatus = "open" | "investigating" | "resolved" | "ignored";
export type DriverAuditCaseType =
  | "no_driver_moving"
  | "long_idling"
  | "after_hours_usage"
  | "stale_gps"
  | "gps_quality_bad"
  | "fuel_drop_anomaly"
  | "overnight_fuel_loss"
  | "fuel_refill_detected"
  | "fuel_actual_mismatch"
  | "low_distance_high_fuel"
  | "missing_fuel_sensor";

export type DriverAuditCaseDocument = {
  _id?: ObjectId;
  caseKey: string;
  labelDate: string;
  type: DriverAuditCaseType;
  severity: DriverAuditSeverity;
  status: DriverAuditStatus;
  driverName: string;
  registration: string;
  title: string;
  detail: string;
  evidence: {
    time?: string;
    positionDescription?: string;
    speed?: number | null;
    fuelBefore?: number | null;
    fuelAfter?: number | null;
    distanceKm?: number | null;
    fuelLiters?: number | null;
    actualFuelLiters?: number | null;
    sensorFuelLiters?: number | null;
    varianceLiters?: number | null;
    sampleCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  reviewer?: string;
  note?: string;
};

export type DriverDailyAuditDocument = {
  _id?: ObjectId;
  labelDate: string;
  generatedAt: Date;
  summary: {
    driverCount: number;
    caseCount: number;
    openCaseCount: number;
    criticalCount: number;
    highCount: number;
    averageScore: number;
    snapshotCount: number;
  };
  drivers: DriverAuditRow[];
};

export type DriverAuditRow = {
  driverName: string;
  registrations: string[];
  score: number;
  grade: "A" | "B" | "C" | "D";
  distanceKm: number;
  fuelUsedLiters: number;
  fuelEfficiencyLitersPer100Km: number | null;
  refillLiters: number;
  movingSamples: number;
  idlingSamples: number;
  afterHoursSamples: number;
  staleGpsSamples: number;
  noDriverSamples: number;
  missingFuelVehicles: number;
  caseCount: number;
  topIssue: string;
};

export async function getCronStatus() {
  await ensureMongoIndexes();
  const db = await getDb();
  const [latestFuelSnapshot, latestVehicleStatusSnapshot, latestDetectedRefill] = await Promise.all([
    db
      .collection<FuelSnapshotDocument>("fuel_snapshots")
      .findOne({}, { sort: { createdAt: -1 }, projection: { createdAt: 1, labelDate: 1, rows: 1 } }),
    db
      .collection<VehicleStatusSnapshotDocument>("vehicle_status_snapshots")
      .findOne({}, { sort: { createdAt: -1 }, projection: { createdAt: 1, labelDate: 1, rows: 1 } }),
    db
      .collection<FuelDetectedRefillDocument>("fuel_detected_refills")
      .findOne({}, { sort: { detectedAt: -1 }, projection: { detectedAt: 1, labelDate: 1, registration: 1, refilledLiters: 1 } }),
  ]);

  const latestAt = latestFuelSnapshot?.createdAt ?? latestVehicleStatusSnapshot?.createdAt ?? null;
  const ageMinutes = latestAt ? Math.max(0, Math.round((Date.now() - latestAt.getTime()) / 60000)) : null;

  return {
    latestAt: latestAt?.toISOString() ?? null,
    latestLabelDate: latestFuelSnapshot?.labelDate ?? latestVehicleStatusSnapshot?.labelDate ?? null,
    ageMinutes,
    status: getCronHealthStatus(ageMinutes),
    fuelSnapshot: latestFuelSnapshot
      ? {
          createdAt: latestFuelSnapshot.createdAt.toISOString(),
          labelDate: latestFuelSnapshot.labelDate,
          rowCount: latestFuelSnapshot.rows.length,
        }
      : null,
    vehicleStatusSnapshot: latestVehicleStatusSnapshot
      ? {
          createdAt: latestVehicleStatusSnapshot.createdAt.toISOString(),
          labelDate: latestVehicleStatusSnapshot.labelDate,
          rowCount: latestVehicleStatusSnapshot.rows.length,
        }
      : null,
    latestDetectedRefill: latestDetectedRefill
      ? {
          detectedAt: latestDetectedRefill.detectedAt.toISOString(),
          labelDate: latestDetectedRefill.labelDate,
          registration: latestDetectedRefill.registration,
          refilledLiters: latestDetectedRefill.refilledLiters,
        }
      : null,
  };
}

export async function saveReport(report: DailyReport, sent: boolean): Promise<string> {
  await ensureMongoIndexes();
  const db = await getDb();
  const doc: ReportDocument = {
    createdAt: new Date(),
    sent,
    vehicleCount: report.vehicleCount,
    fuelAvailableCount: report.fuelAvailableCount,
    summary: report.summary,
    window: report.window,
    rows: report.rows,
    text: report.text,
  };

  const result = await db.collection<ReportDocument>("reports").insertOne(doc);
  deleteTimedCache("reports");
  return result.insertedId.toString();
}

export async function saveFuelSnapshot(labelDate: string, rows: FleetStatusRow[]) {
  await ensureMongoIndexes();
  const db = await getDb();
  const doc: FuelSnapshotDocument = {
    createdAt: new Date(),
    labelDate,
    rows: rows.map((row) => ({
      registration: row.registration,
      vehicleId: row.vehicleId,
      driverName: row.driverName,
      fuelLevel: row.fuelLevel,
      fuelPercentage: row.fuelPercentage,
      fuelTotalConsumed: row.fuelTotalConsumed,
      fuelUpdated: row.fuelUpdated,
      odometerKm: row.odometerKm,
      locationUpdated: row.locationUpdated,
      positionDescription: row.positionDescription,
    })),
  };

  await db.collection<FuelSnapshotDocument>("fuel_snapshots").insertOne(doc);
  await syncDetectedFuelRefills(labelDate);
  deleteTimedCache(`fuel-summary:${labelDate}`);
  return buildFuelSummary(labelDate);
}

export async function createActualFuelRefill(input: ActualFuelRefillInput): Promise<ActualFuelRefill> {
  await ensureMongoIndexes();
  const db = await getDb();
  const now = new Date();
  const doc: ActualFuelRefillDocument = {
    labelDate: input.labelDate.trim(),
    registration: input.registration.trim(),
    driverName: input.driverName?.trim() || "-",
    liters: round(input.liters),
    filledAt: input.filledAt ? new Date(input.filledAt) : now,
    stationName: input.stationName?.trim() || "-",
    receiptNo: input.receiptNo?.trim() || "-",
    note: input.note?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection<ActualFuelRefillDocument>("fuel_actual_refills").insertOne(doc);
  deleteTimedCache(`fuel-summary:${doc.labelDate}`);
  return serializeActualFuelRefill({ ...doc, _id: result.insertedId });
}

export async function listActualFuelRefills(labelDate: string): Promise<ActualFuelRefill[]> {
  await ensureMongoIndexes();
  const db = await getDb();
  const docs = await db
    .collection<ActualFuelRefillDocument>("fuel_actual_refills")
    .find({ labelDate })
    .sort({ filledAt: -1, createdAt: -1 })
    .toArray();

  return docs.map(serializeActualFuelRefill);
}

export async function deleteActualFuelRefill(id: string): Promise<boolean> {
  await ensureMongoIndexes();
  const db = await getDb();
  const doc = await db.collection<ActualFuelRefillDocument>("fuel_actual_refills").findOne({ _id: new ObjectId(id) });
  const result = await db.collection<ActualFuelRefillDocument>("fuel_actual_refills").deleteOne({ _id: new ObjectId(id) });
  if (doc) {
    deleteTimedCache(`fuel-summary:${doc.labelDate}`);
  }
  return result.deletedCount > 0;
}

export async function saveVehicleStatusSnapshot(labelDate: string, rows: FleetStatusRow[]) {
  await ensureMongoIndexes();
  const db = await getDb();
  const doc: VehicleStatusSnapshotDocument = {
    createdAt: new Date(),
    labelDate,
    rows: rows.map((row) => ({
      registration: row.registration,
      vehicleId: row.vehicleId,
      driverName: row.driverName,
      latitude: row.latitude,
      longitude: row.longitude,
      speed: row.speed,
      ignition: row.ignition,
      idling: row.idling,
      bearing: row.bearing,
      eventTs: row.eventTs,
      fuelLevel: row.fuelLevel,
      fuelPercentage: row.fuelPercentage,
      fuelTotalConsumed: row.fuelTotalConsumed,
      fuelUpdated: row.fuelUpdated,
      odometerKm: row.odometerKm,
      locationUpdated: row.locationUpdated,
      positionDescription: row.positionDescription,
      gpsFixType: row.gpsFixType,
    })),
  };

  await db.collection<VehicleStatusSnapshotDocument>("vehicle_status_snapshots").insertOne(doc);
  return doc;
}

export async function buildDriverDailyAudit(labelDate: string) {
  await ensureMongoIndexes();
  const db = await getDb();
  const previousLabelDate = getPreviousLabelDate(labelDate);
  const [latestReport, snapshots, previousSnapshots, fuelSummary] = await Promise.all([
    db.collection<ReportDocument>("reports").findOne({ "window.labelDate": labelDate }, { sort: { createdAt: -1 } }),
    db
      .collection<VehicleStatusSnapshotDocument>("vehicle_status_snapshots")
      .find({ labelDate })
      .sort({ createdAt: 1 })
      .toArray(),
    previousLabelDate
      ? db
          .collection<VehicleStatusSnapshotDocument>("vehicle_status_snapshots")
          .find({ labelDate: previousLabelDate })
          .sort({ createdAt: 1 })
          .toArray()
      : Promise.resolve([]),
    buildFuelSummary(labelDate),
  ]);

  const reportRows = latestReport?.rows ?? [];
  const cases = detectDriverAuditCases(
    labelDate,
    snapshots,
    reportRows,
    fuelSummary.events,
    fuelSummary.reconciliation,
    previousSnapshots,
  );
  const now = new Date();
  for (const item of cases) {
    await db.collection<DriverAuditCaseDocument>("driver_audit_cases").updateOne(
      { caseKey: item.caseKey },
      {
        $setOnInsert: {
          status: "open",
          createdAt: now,
        },
        $set: {
          labelDate: item.labelDate,
          type: item.type,
          driverName: item.driverName,
          registration: item.registration,
          severity: item.severity,
          title: item.title,
          detail: item.detail,
          evidence: item.evidence,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }

  const openCases = await db
    .collection<DriverAuditCaseDocument>("driver_audit_cases")
    .find({ labelDate, status: { $in: ["open", "investigating"] } })
    .sort({ severity: 1, createdAt: -1 })
    .toArray();

  const drivers = buildDriverAuditRows(reportRows, snapshots, fuelSummary.events, openCases);
  const audit: DriverDailyAuditDocument = {
    labelDate,
    generatedAt: now,
    summary: {
      driverCount: drivers.length,
      caseCount: openCases.length,
      openCaseCount: openCases.filter((item) => item.status === "open").length,
      criticalCount: openCases.filter((item) => item.severity === "critical").length,
      highCount: openCases.filter((item) => item.severity === "high").length,
      averageScore: average(drivers.map((driver) => driver.score)),
      snapshotCount: snapshots.length,
    },
    drivers,
  };

  await db.collection<DriverDailyAuditDocument>("driver_daily_audits").insertOne(audit);
  return {
    ...serializeDriverDailyAudit(audit),
    cases: openCases.map(serializeDriverAuditCase),
    dataQuality: buildDataQuality(reportRows, snapshots),
  };
}

export async function getLatestDriverDailyAudit(labelDate?: string) {
  await ensureMongoIndexes();
  const db = await getDb();
  const query = labelDate ? { labelDate } : {};
  const audit = await db
    .collection<DriverDailyAuditDocument>("driver_daily_audits")
    .findOne(query, { sort: { generatedAt: -1 } });
  if (!audit) {
    return null;
  }
  const cases = await db
    .collection<DriverAuditCaseDocument>("driver_audit_cases")
    .find({ labelDate: audit.labelDate })
    .sort({ status: 1, severity: 1, createdAt: -1 })
    .limit(200)
    .toArray();
  const snapshots = await db.collection<VehicleStatusSnapshotDocument>("vehicle_status_snapshots").find({ labelDate: audit.labelDate }).toArray();
  const latestReport = await db.collection<ReportDocument>("reports").findOne({ "window.labelDate": audit.labelDate }, { sort: { createdAt: -1 } });
  return {
    ...serializeDriverDailyAudit(audit),
    cases: cases.map(serializeDriverAuditCase),
    dataQuality: buildDataQuality(latestReport?.rows ?? [], snapshots),
  };
}

export async function listDriverAuditCases(labelDate?: string, status?: DriverAuditStatus) {
  await ensureMongoIndexes();
  const db = await getDb();
  const query: Partial<Pick<DriverAuditCaseDocument, "labelDate" | "status">> = {};
  if (labelDate) query.labelDate = labelDate;
  if (status) query.status = status;
  const docs = await db
    .collection<DriverAuditCaseDocument>("driver_audit_cases")
    .find(query)
    .sort({ labelDate: -1, status: 1, severity: 1, createdAt: -1 })
    .limit(300)
    .toArray();
  return docs.map(serializeDriverAuditCase);
}

export async function updateDriverAuditCase(id: string, input: { status?: DriverAuditStatus; note?: string; reviewer?: string }) {
  await ensureMongoIndexes();
  const db = await getDb();
  const status = input.status;
  const update: Partial<DriverAuditCaseDocument> = {
    updatedAt: new Date(),
  };
  if (status) update.status = status;
  if (typeof input.note === "string") update.note = input.note.trim();
  if (typeof input.reviewer === "string") update.reviewer = input.reviewer.trim();
  if (status === "resolved" || status === "ignored") update.resolvedAt = new Date();

  const doc = await db.collection<DriverAuditCaseDocument>("driver_audit_cases").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" },
  );
  return doc ? serializeDriverAuditCase(doc) : null;
}

export async function buildFuelSummary(labelDate: string) {
  await ensureMongoIndexes();
  const db = await getDb();
  const [snapshots, actualRefillDocs, detectedRefillDocs] = await Promise.all([
    db
      .collection<FuelSnapshotDocument>("fuel_snapshots")
      .find({ labelDate })
      .sort({ createdAt: 1 })
      .toArray(),
    db
      .collection<ActualFuelRefillDocument>("fuel_actual_refills")
      .find({ labelDate })
      .sort({ filledAt: -1, createdAt: -1 })
      .toArray(),
    db
      .collection<FuelDetectedRefillDocument>("fuel_detected_refills")
      .find({ labelDate, status: { $ne: "dismissed" } })
      .sort({ refilledLiters: -1, afterTime: -1 })
      .toArray(),
  ]);

  const byRegistration = new Map<
    string,
    Array<FuelSnapshotRow & { recordedAt: Date }>
  >();

  for (const snapshot of snapshots) {
    const rowsByRegistration = new Map<string, FuelSnapshotRow>();
    for (const row of snapshot.rows) {
      if (typeof row.fuelLevel !== "number") {
        continue;
      }
      rowsByRegistration.set(row.registration, row);
    }

    for (const row of rowsByRegistration.values()) {
      const items = byRegistration.get(row.registration) ?? [];
      items.push({ ...row, recordedAt: snapshot.createdAt });
      byRegistration.set(row.registration, items);
    }
  }

  const vehicles = Array.from(byRegistration.entries()).map(([registration, items]) => {
    const orderedItems = items.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    let minRow = orderedItems[0];
    let maxIncrease = 0;
    let latest = orderedItems[orderedItems.length - 1];

    for (const row of orderedItems.slice(1)) {
      if (row.fuelLevel! < minRow.fuelLevel!) {
        minRow = row;
      }
      const increase = row.fuelLevel! - minRow.fuelLevel!;
      if (increase >= FUEL_REFILL_MIN_INCREASE_LITERS && increase > maxIncrease) {
        maxIncrease = increase;
      }
      latest = row;
    }

    return {
      registration,
      driverName: latest.driverName || "-",
      latestFuelLiters: latest.fuelLevel,
      latestFuelPercentage: latest.fuelPercentage,
      odometerKm: latest.odometerKm,
      sampleCount: orderedItems.length,
      estimatedRefillLiters: maxIncrease,
      status: maxIncrease >= 5 ? "refilled" : orderedItems.length >= 2 ? "none" : "waiting",
      lastUpdated: latest.recordedAt.toISOString(),
      positionDescription: latest.positionDescription || "-",
    };
  });

  const detectedEvents = detectedRefillDocs.map(serializeDetectedRefillEvent);
  const fallbackEvents = detectedEvents.length > 0 ? [] : detectFuelRefillEvents(labelDate, snapshots);
  const events = detectedEvents.length > 0 ? detectedEvents : fallbackEvents;

  events.sort((a, b) => b.refilledLiters - a.refilledLiters);
  vehicles.sort((a, b) => b.estimatedRefillLiters - a.estimatedRefillLiters || a.registration.localeCompare(b.registration));
  const actualRefills = actualRefillDocs.map(serializeActualFuelRefill);
  const reconciliation = buildFuelReconciliation(actualRefills, events, vehicles);

  return {
    labelDate,
    snapshotCount: snapshots.length,
    vehicleCount: vehicles.length,
    totalRefilledLiters: events.reduce((total, event) => total + event.refilledLiters, 0),
    totalActualRefillLiters: actualRefills.reduce((total, item) => total + item.liters, 0),
    totalFuelVarianceLiters: reconciliation.reduce((total, item) => total + Math.abs(item.varianceLiters), 0),
    events,
    vehicles,
    actualRefills,
    reconciliation,
  };
}

export async function syncDetectedFuelRefills(labelDate: string): Promise<FuelRefillEvent[]> {
  await ensureMongoIndexes();
  const db = await getDb();
  const snapshots = await db
    .collection<FuelSnapshotDocument>("fuel_snapshots")
    .find({ labelDate })
    .sort({ createdAt: 1 })
    .toArray();
  const events = detectFuelRefillEvents(labelDate, snapshots);
  const now = new Date();

  if (events.length === 0) {
    return [];
  }

  await Promise.all(
    events.map((event) =>
      db.collection<FuelDetectedRefillDocument>("fuel_detected_refills").updateOne(
        { eventKey: event.eventKey },
        {
          $set: {
            registration: event.registration,
            vehicleId: event.vehicleId,
            driverName: event.driverName,
            beforeLiters: event.beforeLiters,
            afterLiters: event.afterLiters,
            refilledLiters: event.refilledLiters,
            beforeTime: event.beforeTime,
            afterTime: event.afterTime,
            positionDescription: event.positionDescription,
            confidence: event.confidence,
            sampleCount: event.sampleCount,
            odometerBefore: event.odometerBefore,
            odometerAfter: event.odometerAfter,
            updatedAt: now,
          },
          $setOnInsert: {
            eventKey: event.eventKey,
            labelDate: event.labelDate,
            status: "detected",
            detectedAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );

  return events.map(serializeDetectedRefillEvent);
}

function detectFuelRefillEvents(
  labelDate: string,
  snapshots: WithId<FuelSnapshotDocument>[],
): FuelDetectedRefillDocument[] {
  type FuelSample = FuelSnapshotRow & { recordedAt: Date };
  type Candidate = {
    before: FuelSample;
    after: FuelSample;
    sampleCount: number;
  };

  const byRegistration = new Map<string, FuelSample[]>();

  for (const snapshot of snapshots) {
    const rowsByRegistration = new Map<string, FuelSnapshotRow>();
    for (const row of snapshot.rows) {
      if (typeof row.fuelLevel !== "number") {
        continue;
      }
      rowsByRegistration.set(row.registration, row);
    }

    for (const row of rowsByRegistration.values()) {
      const samples = byRegistration.get(row.registration) ?? [];
      samples.push({ ...row, recordedAt: snapshot.createdAt });
      byRegistration.set(row.registration, samples);
    }
  }

  const events: FuelDetectedRefillDocument[] = [];

  for (const [registration, samples] of byRegistration.entries()) {
    const ordered = samples.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    if (ordered.length < 2) {
      continue;
    }

    let baseline = ordered[0];
    let candidate: Candidate | null = null;

    const closeCandidate = () => {
      if (!candidate) {
        return;
      }

      const refilledLiters = round(candidate.after.fuelLevel! - candidate.before.fuelLevel!);
      if (refilledLiters >= FUEL_REFILL_MIN_INCREASE_LITERS) {
        const beforeTime = candidate.before.recordedAt.toISOString();
        const afterTime = candidate.after.recordedAt.toISOString();
        events.push({
          eventKey: `${labelDate}:${registration}:${beforeTime}`,
          labelDate,
          registration,
          vehicleId: candidate.after.vehicleId || candidate.before.vehicleId || "-",
          driverName: candidate.after.driverName || candidate.before.driverName || "-",
          beforeLiters: round(candidate.before.fuelLevel!),
          afterLiters: round(candidate.after.fuelLevel!),
          refilledLiters,
          beforeTime,
          afterTime,
          positionDescription: candidate.after.positionDescription || candidate.before.positionDescription || "-",
          status: "detected",
          confidence: getDetectedFuelConfidence(refilledLiters, candidate.sampleCount),
          sampleCount: candidate.sampleCount,
          odometerBefore: candidate.before.odometerKm,
          odometerAfter: candidate.after.odometerKm,
          detectedAt: new Date(),
          updatedAt: new Date(),
        });
      }

      candidate = null;
    };

    for (const sample of ordered.slice(1)) {
      if (sample.fuelLevel! < baseline.fuelLevel! - FUEL_SENSOR_NOISE_TOLERANCE_LITERS) {
        closeCandidate();
        baseline = sample;
        continue;
      }

      const increase = sample.fuelLevel! - baseline.fuelLevel!;
      if (increase >= FUEL_REFILL_MIN_INCREASE_LITERS) {
        if (!candidate) {
          candidate = {
            before: baseline,
            after: sample,
            sampleCount: 2,
          };
          continue;
        }

        candidate.sampleCount += 1;
        if (sample.fuelLevel! > candidate.after.fuelLevel! + FUEL_SENSOR_NOISE_TOLERANCE_LITERS) {
          candidate.after = sample;
        }
      }
    }

    closeCandidate();
  }

  return events.sort((a, b) => b.refilledLiters - a.refilledLiters);
}

function serializeDetectedRefillEvent(doc: FuelDetectedRefillDocument): FuelRefillEvent {
  return {
    registration: doc.registration,
    driverName: doc.driverName,
    beforeLiters: doc.beforeLiters,
    afterLiters: doc.afterLiters,
    refilledLiters: doc.refilledLiters,
    beforeTime: doc.beforeTime,
    afterTime: doc.afterTime,
    positionDescription: doc.positionDescription,
  };
}

function getDetectedFuelConfidence(refilledLiters: number, sampleCount: number): FuelDetectedRefillDocument["confidence"] {
  if (refilledLiters >= 30 && sampleCount >= 2) {
    return "high";
  }
  if (refilledLiters >= 15) {
    return "medium";
  }
  return "low";
}

function getCronHealthStatus(ageMinutes: number | null): "healthy" | "warning" | "stale" | "empty" {
  if (ageMinutes === null) {
    return "empty";
  }
  if (ageMinutes <= 3) {
    return "healthy";
  }
  if (ageMinutes <= 10) {
    return "warning";
  }
  return "stale";
}

function buildFuelReconciliation(
  actualRefills: ActualFuelRefill[],
  events: FuelRefillEvent[],
  vehicles: Array<{
    registration: string;
    driverName: string;
    latestFuelLiters: number | null;
    sampleCount: number;
  }>,
): FuelReconciliation[] {
  const byRegistration = new Map<string, FuelReconciliation>();

  for (const vehicle of vehicles) {
    byRegistration.set(vehicle.registration, {
      registration: vehicle.registration,
      driverName: vehicle.driverName,
      actualLiters: 0,
      sensorIncreaseLiters: 0,
      varianceLiters: 0,
      status: "matched",
      confidence: vehicle.sampleCount >= 12 ? "high" : vehicle.sampleCount >= 4 ? "medium" : "low",
      receiptCount: 0,
      sampleCount: vehicle.sampleCount,
      latestFuelLiters: vehicle.latestFuelLiters,
      actualRefills: [],
      sensorEvent: null,
    });
  }

  for (const event of events) {
    const current = byRegistration.get(event.registration) ?? {
      registration: event.registration,
      driverName: event.driverName,
      actualLiters: 0,
      sensorIncreaseLiters: 0,
      varianceLiters: 0,
      status: "sensor_only" as const,
      confidence: "low" as const,
      receiptCount: 0,
      sampleCount: 0,
      latestFuelLiters: null,
      actualRefills: [],
      sensorEvent: null,
    };
    current.sensorIncreaseLiters += event.refilledLiters;
    current.sensorEvent = event;
    current.driverName = current.driverName !== "-" ? current.driverName : event.driverName;
    byRegistration.set(event.registration, current);
  }

  for (const actual of actualRefills) {
    const current = byRegistration.get(actual.registration) ?? {
      registration: actual.registration,
      driverName: actual.driverName,
      actualLiters: 0,
      sensorIncreaseLiters: 0,
      varianceLiters: 0,
      status: "actual_only" as const,
      confidence: "low" as const,
      receiptCount: 0,
      sampleCount: 0,
      latestFuelLiters: null,
      actualRefills: [],
      sensorEvent: null,
    };
    current.actualLiters += actual.liters;
    current.receiptCount += 1;
    current.actualRefills.push(actual);
    current.driverName = actual.driverName !== "-" ? actual.driverName : current.driverName;
    byRegistration.set(actual.registration, current);
  }

  return Array.from(byRegistration.values())
    .map((item) => {
      const variance = round(item.actualLiters - item.sensorIncreaseLiters);
      const absoluteVariance = Math.abs(variance);
      let status: FuelReconciliation["status"] = "matched";
      if (item.actualLiters > 0 && item.sensorIncreaseLiters === 0) {
        status = "actual_only";
      } else if (item.actualLiters === 0 && item.sensorIncreaseLiters > 0) {
        status = "sensor_only";
      } else if (absoluteVariance >= 30 || (item.actualLiters >= 50 && item.sensorIncreaseLiters / item.actualLiters < 0.55)) {
        status = "critical";
      } else if (absoluteVariance >= 10 || (item.actualLiters >= 20 && item.sensorIncreaseLiters / item.actualLiters < 0.75)) {
        status = "warning";
      }

      return {
        ...item,
        actualLiters: round(item.actualLiters),
        sensorIncreaseLiters: round(item.sensorIncreaseLiters),
        varianceLiters: variance,
        status,
      };
    })
    .filter((item) => item.actualLiters > 0 || item.sensorIncreaseLiters > 0)
    .sort((a, b) => {
      const severity = { critical: 5, warning: 4, actual_only: 3, sensor_only: 2, matched: 1 };
      return severity[b.status] - severity[a.status] || Math.abs(b.varianceLiters) - Math.abs(a.varianceLiters);
    });
}

export async function listReports(limit = 20) {
  await ensureMongoIndexes();
  const db = await getDb();
  const docs = await db
    .collection<ReportDocument>("reports")
    .find(
      {},
      {
        projection: {
          text: 0,
          rows: 0,
        },
      },
    )
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();

  return docs.map(serializeReportListItem);
}

export async function getLatestReport() {
  await ensureMongoIndexes();
  const db = await getDb();
  const doc = await db.collection<ReportDocument>("reports").findOne({}, { sort: { createdAt: -1 } });
  return doc ? serializeReport(doc) : null;
}

export async function listStaff() {
  await ensureMongoIndexes();
  const db = await getDb();
  const docs = await db.collection<StaffDocument>("staff").find({}).sort({ status: 1, name: 1 }).toArray();
  return docs.map(serializeStaff);
}

export async function validateStaffLogin(username: string, password: string) {
  await ensureMongoIndexes();
  const db = await getDb();
  const staff = await db.collection<StaffDocument>("staff").findOne({
    username: username.trim().toLowerCase(),
    status: "active",
  });

  if (!staff?.passwordHash || !verifyPassword(password, staff.passwordHash)) {
    return null;
  }

  return serializeStaff(staff);
}

export async function createStaff(input: StaffInput) {
  await ensureMongoIndexes();
  const db = await getDb();
  const now = new Date();
  const doc: StaffDocument = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    username: input.username.trim().toLowerCase(),
    passwordHash: input.password ? hashPassword(input.password) : undefined,
    role: input.role,
    status: input.status ?? "active",
    telegramChatId: input.telegramChatId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<StaffDocument>("staff").insertOne(doc);
  return serializeStaff({ ...doc, _id: result.insertedId });
}

export async function updateStaff(id: string, input: Partial<StaffInput>) {
  await ensureMongoIndexes();
  const db = await getDb();
  const update: Partial<StaffDocument> = {
    updatedAt: new Date(),
  };

  if (typeof input.name === "string") update.name = input.name.trim();
  if (typeof input.email === "string") update.email = input.email.trim().toLowerCase();
  if (typeof input.username === "string") update.username = input.username.trim().toLowerCase();
  if (typeof input.password === "string" && input.password.trim()) update.passwordHash = hashPassword(input.password);
  if (input.role) update.role = input.role;
  if (input.status) update.status = input.status;
  if (typeof input.telegramChatId === "string") update.telegramChatId = input.telegramChatId.trim() || undefined;

  const result = await db.collection<StaffDocument>("staff").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" },
  );

  return result ? serializeStaff(result) : null;
}

export async function deleteStaff(id: string) {
  await ensureMongoIndexes();
  const db = await getDb();
  const result = await db.collection<StaffDocument>("staff").deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

function serializeReport(doc: WithId<ReportDocument>) {
  return {
    id: doc._id.toString(),
    createdAt: doc.createdAt.toISOString(),
    sent: doc.sent,
    vehicleCount: doc.vehicleCount,
    fuelAvailableCount: doc.fuelAvailableCount,
    summary: doc.summary,
    window: doc.window,
    rows: doc.rows,
    text: doc.text,
  };
}

function serializeReportListItem(doc: WithId<Omit<ReportDocument, "rows" | "text">>) {
  return {
    id: doc._id.toString(),
    createdAt: doc.createdAt.toISOString(),
    sent: doc.sent,
    vehicleCount: doc.vehicleCount,
    fuelAvailableCount: doc.fuelAvailableCount,
    summary: doc.summary,
    window: doc.window,
  };
}

function serializeStaff(doc: WithId<StaffDocument>) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    username: doc.username ?? "",
    role: doc.role,
    status: doc.status,
    telegramChatId: doc.telegramChatId ?? "",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeActualFuelRefill(doc: WithId<ActualFuelRefillDocument> | ActualFuelRefillDocument): ActualFuelRefill {
  const id = doc._id ? doc._id.toString() : "";
  return {
    id,
    labelDate: doc.labelDate,
    registration: doc.registration,
    driverName: doc.driverName,
    liters: doc.liters,
    filledAt: doc.filledAt.toISOString(),
    stationName: doc.stationName,
    receiptNo: doc.receiptNo,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function detectDriverAuditCases(
  labelDate: string,
  snapshots: WithId<VehicleStatusSnapshotDocument>[],
  reportRows: DailyReport["rows"],
  refillEvents: FuelRefillEvent[],
  reconciliation: FuelReconciliation[] = [],
  previousSnapshots: WithId<VehicleStatusSnapshotDocument>[] = [],
) {
  const cases = new Map<string, Omit<DriverAuditCaseDocument, "_id" | "status" | "createdAt" | "updatedAt">>();
  const rowsByRegistration = new Map(reportRows.map((row) => [row.registration, row]));

  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      const driverName = normalizeDriver(row.driverName);
      const moving = (row.speed ?? 0) > 5 || row.ignition === true && row.idling === false;
      if (driverName === "-" && moving) {
        addCase(cases, {
          labelDate,
          type: "no_driver_moving",
          severity: "high",
          driverName,
          registration: row.registration,
          title: "รถเคลื่อนที่แต่ไม่มีข้อมูลคนขับ",
          detail: `${row.registration} มีการเคลื่อนที่โดยไม่มี driver link ในระบบ`,
          evidence: snapshotEvidence(snapshot.createdAt, row),
        });
      }

      if (row.ignition === true && row.idling === true) {
        addCase(cases, {
          labelDate,
          type: "long_idling",
          severity: "medium",
          driverName,
          registration: row.registration,
          title: "จอดติดเครื่อง",
          detail: `${row.registration} ติดเครื่องขณะ idling ควรตรวจเวลาจอดและเหตุผล`,
          evidence: snapshotEvidence(snapshot.createdAt, row),
        });
      }

      const hour = getBangkokHour(snapshot.createdAt);
      if ((hour < 7 || hour >= 18) && (moving || row.ignition === true)) {
        addCase(cases, {
          labelDate,
          type: "after_hours_usage",
          severity: "high",
          driverName,
          registration: row.registration,
          title: "ใช้งานนอกเวลาปกติ",
          detail: `${row.registration} มีการใช้งานนอกช่วง 07:00-18:00`,
          evidence: snapshotEvidence(snapshot.createdAt, row),
        });
      }

      const staleMinutes = getStaleMinutes(snapshot.createdAt, row.locationUpdated);
      if (staleMinutes >= 30) {
        addCase(cases, {
          labelDate,
          type: "stale_gps",
          severity: "medium",
          driverName,
          registration: row.registration,
          title: "GPS ไม่อัพเดท",
          detail: `${row.registration} ตำแหน่งล่าสุดเก่ากว่า ${Math.round(staleMinutes)} นาที`,
          evidence: snapshotEvidence(snapshot.createdAt, row),
        });
      }

      if (typeof row.gpsFixType === "number" && row.gpsFixType <= 0) {
        addCase(cases, {
          labelDate,
          type: "gps_quality_bad",
          severity: "low",
          driverName,
          registration: row.registration,
          title: "คุณภาพ GPS ต่ำ",
          detail: `${row.registration} มีค่า gps fix type ผิดปกติ`,
          evidence: snapshotEvidence(snapshot.createdAt, row),
        });
      }

      const reportRow = rowsByRegistration.get(row.registration);
      if (reportRow?.fuelUsedLiters === null) {
        addCase(cases, {
          labelDate,
          type: "missing_fuel_sensor",
          severity: "low",
          driverName,
          registration: row.registration,
          title: "ไม่มีข้อมูล fuel sensor",
          detail: `${row.registration} ไม่มีข้อมูลน้ำมันในรายงานวันนี้`,
          evidence: {
            ...snapshotEvidence(snapshot.createdAt, row),
            distanceKm: reportRow.distanceKm,
          },
        });
      }
    }
  }

  for (const [registration, rows] of groupSnapshotRows(snapshots).entries()) {
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (typeof previous.row.fuelLevel !== "number" || typeof current.row.fuelLevel !== "number") {
        continue;
      }
      const fuelDrop = previous.row.fuelLevel - current.row.fuelLevel;
      const distanceDelta =
        typeof previous.row.odometerKm === "number" && typeof current.row.odometerKm === "number"
          ? Math.max(0, current.row.odometerKm - previous.row.odometerKm)
          : 0;
      if (fuelDrop >= 10 && distanceDelta < 2) {
        addCase(cases, {
          labelDate,
          type: "fuel_drop_anomaly",
          severity: "critical",
          driverName: normalizeDriver(current.row.driverName),
          registration,
          title: "น้ำมันลดผิดปกติ",
          detail: `${registration} น้ำมันลด ${round(fuelDrop)} ลิตร ขณะที่ระยะทางเพิ่มเพียง ${round(distanceDelta)} กม.`,
          evidence: {
            ...snapshotEvidence(current.createdAt, current.row),
            fuelBefore: previous.row.fuelLevel,
            fuelAfter: current.row.fuelLevel,
            distanceKm: distanceDelta,
          },
        });
      }
    }
  }

  for (const item of detectOvernightFuelLoss(labelDate, previousSnapshots, snapshots)) {
    addCase(cases, item);
  }

  for (const row of reportRows) {
    if ((row.distanceKm ?? 0) < 20 && (row.fuelUsedLiters ?? 0) > 20) {
      addCase(cases, {
        labelDate,
        type: "low_distance_high_fuel",
        severity: "high",
        driverName: normalizeDriver(row.driverName),
        registration: row.registration,
        title: "ระยะทางต่ำแต่น้ำมันสูง",
        detail: `${row.registration} วิ่ง ${round(row.distanceKm ?? 0)} กม. แต่ใช้น้ำมัน ${round(row.fuelUsedLiters ?? 0)} ลิตร`,
        evidence: {
          distanceKm: row.distanceKm,
          fuelLiters: row.fuelUsedLiters,
        },
      });
    }
  }

  for (const event of refillEvents) {
    addCase(cases, {
      labelDate,
      type: "fuel_refill_detected",
      severity: "medium",
      driverName: normalizeDriver(event.driverName),
      registration: event.registration,
      title: "พบระดับน้ำมันเพิ่มขึ้น",
      detail: `${event.registration} ระดับน้ำมันเพิ่มขึ้นจาก snapshot ประมาณ ${round(event.refilledLiters)} ลิตร`,
      evidence: {
        time: event.afterTime,
        positionDescription: event.positionDescription,
        fuelBefore: event.beforeLiters,
        fuelAfter: event.afterLiters,
        fuelLiters: event.refilledLiters,
      },
    });
  }

  for (const item of reconciliation) {
    if (item.status !== "critical" && item.status !== "warning" && item.status !== "actual_only") {
      continue;
    }
    addCase(cases, {
      labelDate,
      type: "fuel_actual_mismatch",
      severity: item.status === "critical" || item.status === "actual_only" ? "high" : "medium",
      driverName: normalizeDriver(item.driverName),
      registration: item.registration,
      title: "ยอดเติมจริงไม่ตรงกับ sensor",
      detail: `${item.registration} เติมจริง ${round(item.actualLiters)} ลิตร แต่ sensor เห็นเพิ่ม ${round(item.sensorIncreaseLiters)} ลิตร ต่าง ${round(item.varianceLiters)} ลิตร`,
      evidence: {
        time: item.sensorEvent?.afterTime ?? item.actualRefills[0]?.filledAt,
        positionDescription: item.sensorEvent?.positionDescription ?? item.actualRefills[0]?.stationName,
        actualFuelLiters: item.actualLiters,
        sensorFuelLiters: item.sensorIncreaseLiters,
        varianceLiters: item.varianceLiters,
        sampleCount: item.sampleCount,
      },
    });
  }

  return Array.from(cases.values());
}

function detectOvernightFuelLoss(
  labelDate: string,
  previousSnapshots: WithId<VehicleStatusSnapshotDocument>[],
  currentSnapshots: WithId<VehicleStatusSnapshotDocument>[],
): Array<Omit<DriverAuditCaseDocument, "_id" | "caseKey" | "status" | "createdAt" | "updatedAt">> {
  const cases: Array<Omit<DriverAuditCaseDocument, "_id" | "caseKey" | "status" | "createdAt" | "updatedAt">> = [];
  if (previousSnapshots.length === 0 || currentSnapshots.length === 0) {
    return cases;
  }

  const previousLastRows = latestRowsByRegistration(previousSnapshots);
  const currentFirstRows = firstRowsByRegistration(currentSnapshots);

  for (const [registration, previous] of previousLastRows.entries()) {
    const current = currentFirstRows.get(registration);
    if (!current || typeof previous.row.fuelLevel !== "number" || typeof current.row.fuelLevel !== "number") {
      continue;
    }

    const fuelLoss = round(previous.row.fuelLevel - current.row.fuelLevel);
    const distanceDelta =
      typeof previous.row.odometerKm === "number" && typeof current.row.odometerKm === "number"
        ? Math.max(0, current.row.odometerKm - previous.row.odometerKm)
        : 0;

    if (fuelLoss < 15 || distanceDelta > 3) {
      continue;
    }

    cases.push({
      labelDate,
      type: "overnight_fuel_loss",
      severity: fuelLoss >= 30 ? "critical" : "high",
      driverName: normalizeDriver(current.row.driverName || previous.row.driverName),
      registration,
      title: "น้ำมันหายข้ามคืน",
      detail: `${registration} หลังจบรอบมีน้ำมัน ${round(previous.row.fuelLevel)} ลิตร แต่เช้านี้เหลือ ${round(current.row.fuelLevel)} ลิตร หาย ${fuelLoss} ลิตร โดย odometer เพิ่ม ${round(distanceDelta)} กม.`,
      evidence: {
        time: current.createdAt.toISOString(),
        positionDescription: current.row.positionDescription || previous.row.positionDescription,
        fuelBefore: previous.row.fuelLevel,
        fuelAfter: current.row.fuelLevel,
        fuelLiters: fuelLoss,
        distanceKm: distanceDelta,
        sampleCount: previousSnapshots.length + currentSnapshots.length,
      },
    });
  }

  return cases;
}

function buildDriverAuditRows(
  reportRows: DailyReport["rows"],
  snapshots: WithId<VehicleStatusSnapshotDocument>[],
  refillEvents: FuelRefillEvent[],
  cases: WithId<DriverAuditCaseDocument>[],
): DriverAuditRow[] {
  const byDriver = new Map<string, DriverAuditRow>();

  for (const row of reportRows) {
    const driverName = normalizeDriver(row.driverName);
    const item = getDriverAuditRow(byDriver, driverName);
    item.registrations = unique([...item.registrations, row.registration]);
    item.distanceKm += row.distanceKm ?? 0;
    item.fuelUsedLiters += row.fuelUsedLiters ?? 0;
    if (row.fuelUsedLiters === null) item.missingFuelVehicles += 1;
  }

  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      const driverName = normalizeDriver(row.driverName);
      const item = getDriverAuditRow(byDriver, driverName);
      item.registrations = unique([...item.registrations, row.registration]);
      if ((row.speed ?? 0) > 5 || row.ignition === true && row.idling === false) item.movingSamples += 1;
      if (row.ignition === true && row.idling === true) item.idlingSamples += 1;
      if (driverName === "-" && ((row.speed ?? 0) > 5 || row.ignition === true)) item.noDriverSamples += 1;
      if (getStaleMinutes(snapshot.createdAt, row.locationUpdated) >= 30) item.staleGpsSamples += 1;
      const hour = getBangkokHour(snapshot.createdAt);
      if ((hour < 7 || hour >= 18) && ((row.speed ?? 0) > 5 || row.ignition === true)) item.afterHoursSamples += 1;
    }
  }

  for (const event of refillEvents) {
    const item = getDriverAuditRow(byDriver, normalizeDriver(event.driverName));
    item.registrations = unique([...item.registrations, event.registration]);
    item.refillLiters += event.refilledLiters;
  }

  for (const item of cases) {
    const driver = getDriverAuditRow(byDriver, normalizeDriver(item.driverName));
    driver.caseCount += 1;
    if (!driver.topIssue || severityWeight(item.severity) > severityWeight(titleSeverity(driver.topIssue))) {
      driver.topIssue = item.title;
    }
  }

  return Array.from(byDriver.values())
    .map((driver) => {
      const efficiency =
        driver.distanceKm > 0 && driver.fuelUsedLiters > 0 ? (driver.fuelUsedLiters / driver.distanceKm) * 100 : null;
      const penalty =
        driver.caseCount * 6 +
        driver.noDriverSamples * 2 +
        driver.afterHoursSamples * 2 +
        driver.idlingSamples * 1 +
        driver.staleGpsSamples * 1 +
        driver.missingFuelVehicles * 4 +
        (efficiency !== null && efficiency > 60 ? 8 : 0);
      const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
      const grade: DriverAuditRow["grade"] = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
      return {
        ...driver,
        score,
        grade,
        fuelEfficiencyLitersPer100Km: efficiency,
        topIssue: driver.topIssue || "ไม่พบข้อผิดปกติหลัก",
        distanceKm: round(driver.distanceKm),
        fuelUsedLiters: round(driver.fuelUsedLiters),
        refillLiters: round(driver.refillLiters),
      };
    })
    .sort((a, b) => a.score - b.score || b.caseCount - a.caseCount || a.driverName.localeCompare(b.driverName));
}

function getDriverAuditRow(map: Map<string, DriverAuditRow>, driverName: string) {
  const current = map.get(driverName);
  if (current) return current;
  const row: DriverAuditRow = {
    driverName,
    registrations: [],
    score: 100,
    grade: "A",
    distanceKm: 0,
    fuelUsedLiters: 0,
    fuelEfficiencyLitersPer100Km: null,
    refillLiters: 0,
    movingSamples: 0,
    idlingSamples: 0,
    afterHoursSamples: 0,
    staleGpsSamples: 0,
    noDriverSamples: 0,
    missingFuelVehicles: 0,
    caseCount: 0,
    topIssue: "",
  };
  map.set(driverName, row);
  return row;
}

function addCase(
  cases: Map<string, Omit<DriverAuditCaseDocument, "_id" | "status" | "createdAt" | "updatedAt">>,
  item: Omit<DriverAuditCaseDocument, "_id" | "caseKey" | "status" | "createdAt" | "updatedAt">,
) {
  const caseKey = `${item.labelDate}:${item.type}:${item.registration}:${item.driverName}`;
  const current = cases.get(caseKey);
  if (!current || severityWeight(item.severity) > severityWeight(current.severity)) {
    cases.set(caseKey, { ...item, caseKey });
  }
}

function groupSnapshotRows(snapshots: WithId<VehicleStatusSnapshotDocument>[]) {
  const grouped = new Map<string, Array<{ createdAt: Date; row: VehicleStatusSnapshotRow }>>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      const items = grouped.get(row.registration) ?? [];
      items.push({ createdAt: snapshot.createdAt, row });
      grouped.set(row.registration, items);
    }
  }
  return grouped;
}

function firstRowsByRegistration(snapshots: WithId<VehicleStatusSnapshotDocument>[]) {
  const rows = new Map<string, { createdAt: Date; row: VehicleStatusSnapshotRow }>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      if (!rows.has(row.registration)) {
        rows.set(row.registration, { createdAt: snapshot.createdAt, row });
      }
    }
  }
  return rows;
}

function latestRowsByRegistration(snapshots: WithId<VehicleStatusSnapshotDocument>[]) {
  const rows = new Map<string, { createdAt: Date; row: VehicleStatusSnapshotRow }>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      rows.set(row.registration, { createdAt: snapshot.createdAt, row });
    }
  }
  return rows;
}

function snapshotEvidence(createdAt: Date, row: VehicleStatusSnapshotRow) {
  return {
    time: createdAt.toISOString(),
    positionDescription: row.positionDescription,
    speed: row.speed,
    fuelAfter: row.fuelLevel,
    sampleCount: 1,
  };
}

function getPreviousLabelDate(labelDate: string): string | null {
  const match = labelDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  date.setUTCDate(date.getUTCDate() - 1);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function buildDataQuality(reportRows: DailyReport["rows"], snapshots: WithId<VehicleStatusSnapshotDocument>[]) {
  const latestRows = snapshots.at(-1)?.rows ?? [];
  return {
    reportRows: reportRows.length,
    snapshotCount: snapshots.length,
    liveVehicleCount: latestRows.length,
    missingDriverCount: latestRows.filter((row) => normalizeDriver(row.driverName) === "-").length,
    missingFuelCount: latestRows.filter((row) => typeof row.fuelLevel !== "number").length,
    staleGpsCount: latestRows.filter((row) => getStaleMinutes(snapshots.at(-1)?.createdAt ?? new Date(), row.locationUpdated) >= 30).length,
    badGpsCount: latestRows.filter((row) => typeof row.gpsFixType === "number" && row.gpsFixType <= 0).length,
  };
}

function serializeDriverDailyAudit(doc: WithId<DriverDailyAuditDocument> | DriverDailyAuditDocument) {
  return {
    id: doc._id?.toString() ?? "",
    labelDate: doc.labelDate,
    generatedAt: doc.generatedAt.toISOString(),
    summary: doc.summary,
    drivers: doc.drivers,
  };
}

function serializeDriverAuditCase(doc: WithId<DriverAuditCaseDocument>) {
  return {
    id: doc._id.toString(),
    caseKey: doc.caseKey,
    labelDate: doc.labelDate,
    type: doc.type,
    severity: doc.severity,
    status: doc.status,
    driverName: doc.driverName,
    registration: doc.registration,
    title: doc.title,
    detail: doc.detail,
    evidence: doc.evidence,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    resolvedAt: doc.resolvedAt?.toISOString(),
    reviewer: doc.reviewer ?? "",
    note: doc.note ?? "",
  };
}

function normalizeDriver(value: string) {
  return value && value.trim() ? value.trim() : "-";
}

function getBangkokHour(value: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    }).format(value),
  );
}

function getStaleMinutes(reference: Date, value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (reference.getTime() - time) / 60000);
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function severityWeight(value: DriverAuditSeverity) {
  return value === "critical" ? 4 : value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function titleSeverity(_value: string): DriverAuditSeverity {
  return "low";
}
