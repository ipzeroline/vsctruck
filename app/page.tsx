"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  Edit3,
  Fuel,
  Gauge,
  History,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UsersRound,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FleetStatusRow } from "./components/FleetMap";

const LIVE_REFRESH_INTERVAL_MS = 120_000;
const LIVE_REFRESH_STALE_MS = 30_000;

const FleetMapPanel = dynamic(
  () => import("./components/FleetMap").then((mod) => mod.FleetMapPanel),
  {
    ssr: false,
    loading: () => (
      <section className="map-shell">
        <div className="map-loading">
          <Loader2 className="spin" size={18} />
          กำลังโหลดแผนที่...
        </div>
      </section>
    ),
  },
);

type ReportRow = {
  registration: string;
  driverName: string;
  reportDate: string;
  firstIgnitionOn: string | null;
  lastIgnitionOff: string | null;
  distanceKm: number | null;
  fuelUsedLiters: number | null;
};

type ApiResult = {
  ok: boolean;
  message?: string;
  storageWarning?: string;
  report?: string;
  sent?: boolean;
  vehicleCount?: number;
  fuelAvailableCount?: number;
  summary?: {
    totalDistanceKm: number;
    totalFuelLiters: number;
    missingFuelCount: number;
  };
  window?: {
    labelDate: string;
    startTimestamp: string;
    endTimestamp: string;
  };
  rows?: ReportRow[];
};

type FleetStatusResult = {
  ok: boolean;
  message?: string;
  source?: "live" | "snapshot";
  fallback?: boolean;
  fallbackReason?: string;
  snapshotCreatedAt?: string;
  snapshotLabelDate?: string;
  rows?: FleetStatusRow[];
  summary?: {
    total: number;
    visible: number;
    ignitionOn: number;
    moving: number;
    withDriver: number;
  };
};

type FuelTodayResult = {
  ok: boolean;
  message?: string;
  note?: string;
  window?: {
    labelDate: string;
    startTimestamp: string;
    endTimestamp: string;
  };
  summary?: {
    labelDate: string;
    snapshotCount: number;
    vehicleCount: number;
    totalRefilledLiters: number;
    totalActualRefillLiters: number;
    totalFuelVarianceLiters: number;
    events: Array<{
      registration: string;
      driverName: string;
      beforeLiters: number;
      afterLiters: number;
      refilledLiters: number;
      beforeTime: string;
      afterTime: string;
      positionDescription: string;
    }>;
    actualRefills: ActualFuelRefill[];
    reconciliation: FuelReconciliation[];
    vehicles: Array<{
      registration: string;
      driverName: string;
      latestFuelLiters: number | null;
      latestFuelPercentage: number | null;
      odometerKm: number | null;
      sampleCount: number;
      estimatedRefillLiters: number;
      status: "refilled" | "none" | "waiting";
      lastUpdated: string;
      positionDescription: string;
    }>;
  };
};

type ActualFuelRefill = {
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

type FuelReconciliation = {
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
  sensorEvent: NonNullable<FuelTodayResult["summary"]>["events"][number] | null;
};

type ActualFuelForm = {
  registration: string;
  driverName: string;
  liters: string;
  filledAt: string;
  stationName: string;
  receiptNo: string;
  note: string;
};

type ReportListItem = {
  id: string;
  createdAt: string;
  sent: boolean;
  vehicleCount: number;
  fuelAvailableCount: number;
  summary: {
    totalDistanceKm: number;
    totalFuelLiters: number;
    missingFuelCount: number;
  };
  window: {
    labelDate: string;
    startTimestamp: string;
    endTimestamp: string;
  };
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "admin" | "manager" | "viewer";
  status: "active" | "inactive";
  telegramChatId: string;
};

type DriverAuditStatus = "open" | "investigating" | "resolved" | "ignored";

type DriverAuditCase = {
  id: string;
  labelDate: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
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
    sampleCount?: number;
  };
  createdAt: string;
  updatedAt: string;
  reviewer?: string;
  note?: string;
};

type DriverAuditResult = {
  ok: boolean;
  message?: string;
  audit?: {
    id: string;
    labelDate: string;
    generatedAt: string;
    summary: {
      driverCount: number;
      caseCount: number;
      openCaseCount: number;
      criticalCount: number;
      highCount: number;
      averageScore: number;
      snapshotCount: number;
    };
    drivers: Array<{
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
    }>;
    cases: DriverAuditCase[];
    dataQuality: {
      reportRows: number;
      snapshotCount: number;
      liveVehicleCount: number;
      missingDriverCount: number;
      missingFuelCount: number;
      staleGpsCount: number;
      badGpsCount: number;
    };
  };
};

type CronStatusResult = {
  ok: boolean;
  message?: string;
  status?: {
    latestAt: string | null;
    latestLabelDate: string | null;
    ageMinutes: number | null;
    status: "healthy" | "warning" | "stale" | "empty";
    fuelSnapshot: {
      createdAt: string;
      labelDate: string;
      rowCount: number;
    } | null;
    vehicleStatusSnapshot: {
      createdAt: string;
      labelDate: string;
      rowCount: number;
    } | null;
    latestDetectedRefill: {
      detectedAt: string;
      labelDate: string;
      registration: string;
      refilledLiters: number;
    } | null;
  };
};

type StaffForm = {
  name: string;
  email: string;
  username: string;
  password: string;
  role: StaffMember["role"];
  status: StaffMember["status"];
  telegramChatId: string;
};

type RunState = {
  status: "idle" | "ready" | "sent" | "error";
  report: string;
  data?: ApiResult;
  error?: string;
};

type DashboardView =
  | "overview"
  | "live"
  | "map"
  | "vehicles"
  | "fuel"
  | "audit"
  | "telegram"
  | "reports"
  | "reportDistance"
  | "reportFuel"
  | "reportRefuel"
  | "reportOvernightFuel"
  | "reportArchive"
  | "staff";

const DAILY_REPORT_VIEWS: DashboardView[] = ["overview", "vehicles", "telegram", "reports", "reportDistance", "reportFuel"];
const FLEET_STATUS_VIEWS: DashboardView[] = ["overview", "live", "map", "fuel"];
const CRON_STATUS_VIEWS: DashboardView[] = ["overview"];
const REPORT_LIST_VIEWS: DashboardView[] = ["overview", "reports", "reportArchive"];
const FUEL_TODAY_VIEWS: DashboardView[] = ["overview", "fuel", "reports", "reportRefuel"];
const DRIVER_AUDIT_VIEWS: DashboardView[] = ["overview", "audit", "reports", "reportOvernightFuel"];
const PAGE_META: Record<DashboardView, { eyebrow: string; title: string; subtitle: string }> = {
  overview: {
    eyebrow: "Fleet operations",
    title: "ภาพรวม",
    subtitle: "ดูตำแหน่งรถ ค้นหาทะเบียน ตรวจสอบคนขับ ระยะทาง และน้ำมัน พร้อมบันทึกรายงานไว้ตรวจสอบย้อนหลัง",
  },
  live: {
    eyebrow: "Live API",
    title: "ข้อมูลสด API",
    subtitle: "ตรวจสถานะรถล่าสุดจาก Cartrack API พร้อมสรุปรถที่เคลื่อนที่ ดับเครื่อง และมีข้อมูลคนขับ",
  },
  map: {
    eyebrow: "Fleet map",
    title: "แผนที่",
    subtitle: "ติดตามตำแหน่งรถบนแผนที่และค้นหาทะเบียนหรือคนขับจากข้อมูลล่าสุด",
  },
  vehicles: {
    eyebrow: "Vehicle report",
    title: "รายการรถ",
    subtitle: "ดูรายชื่อรถในรอบรายงาน พร้อมคนขับ เวลาเปิด-ปิดเครื่อง ระยะทาง และสถานะข้อมูลน้ำมัน",
  },
  fuel: {
    eyebrow: "Fuel operations",
    title: "เติมน้ำมันวันนี้",
    subtitle: "ตรวจระดับน้ำมันล่าสุด ยอดเติมจริง และความต่างระหว่าง sensor กับข้อมูลที่บันทึก",
  },
  audit: {
    eyebrow: "Driver audit",
    title: "Driver Audit",
    subtitle: "ตรวจเคสความเสี่ยงจากพฤติกรรมการใช้งานรถ น้ำมัน และข้อมูล snapshot ล่าสุด",
  },
  telegram: {
    eyebrow: "Telegram delivery",
    title: "Telegram",
    subtitle: "พรีวิวและส่งรายงานประจำวันไปยัง Telegram ตามการตั้งค่าที่กำหนด",
  },
  reports: {
    eyebrow: "Reports",
    title: "สรุปรวม",
    subtitle: "สรุปข้อมูลรายงาน ระยะทาง น้ำมัน การเติม และเคส audit จากวันที่เลือก",
  },
  reportDistance: {
    eyebrow: "Distance report",
    title: "ระยะทาง",
    subtitle: "จัดอันดับระยะทางรายคันและตรวจรถที่วิ่งมากหรือน้อยผิดปกติ",
  },
  reportFuel: {
    eyebrow: "Fuel usage report",
    title: "ใช้น้ำมัน",
    subtitle: "เปรียบเทียบการใช้น้ำมันของแต่ละคัน พร้อมระยะทางและอัตราสิ้นเปลืองโดยประมาณ",
  },
  reportRefuel: {
    eyebrow: "Refuel report",
    title: "เติมน้ำมัน",
    subtitle: "ตรวจรายการระดับน้ำมันเพิ่มขึ้นจาก snapshot และค้นหาตามทะเบียน คนขับ หรือจำนวนลิตร",
  },
  reportOvernightFuel: {
    eyebrow: "Overnight fuel loss",
    title: "น้ำมันหายข้ามคืน",
    subtitle: "ตรวจรถที่น้ำมันลดลงหลังจบรอบหรือหลังดับเครื่องจากข้อมูล snapshot ที่บันทึกไว้",
  },
  reportArchive: {
    eyebrow: "Report archive",
    title: "ประวัติรายงาน",
    subtitle: "ดูรายงานย้อนหลังที่บันทึกไว้ในระบบ พร้อมสถานะการส่งและตัวเลขสรุปหลัก",
  },
  staff: {
    eyebrow: "Staff operations",
    title: "Staff",
    subtitle: "จัดการบัญชีผู้ใช้งาน สิทธิ์เข้าใช้งาน และสถานะของทีมปฏิบัติการ",
  },
};

function getRunErrorDisplay(error?: string) {
  const message = error ?? "";
  const looksLikeMongoError =
    message.includes("MongoDB") ||
    message.includes("mongodb") ||
    message.includes("mongo.") ||
    message.includes("querySrv") ||
    message.includes("ECONNREFUSED");

  if (looksLikeMongoError) {
    return {
      title: "เชื่อมต่อ MongoDB ไม่สำเร็จ",
      hint: "ตรวจสอบ `MONGODB_URI`, DNS/network และสิทธิ์เชื่อมต่อฐานข้อมูลใน `.env.local`",
    };
  }

  return {
    title: "เชื่อมต่อ Cartrack ไม่สำเร็จ",
    hint: "ตรวจสอบ API password จาก Fleetweb และ `CARTRACK_BASE_URL` ใน `.env.local`",
  };
}

function getTodayInputDate(timezone = "Asia/Bangkok") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const sampleRows: ReportRow[] = [
  {
    registration: "รอข้อมูล",
    driverName: "กดพรีวิวรายงาน",
    reportDate: "-",
    firstIgnitionOn: "-",
    lastIgnitionOff: "-",
    distanceKm: null,
    fuelUsedLiters: null,
  },
];

export default function Home({ view = "overview" }: { view?: DashboardView }) {
  const [loading, setLoading] = useState<"preview" | "send" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [reportDataLoading, setReportDataLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [actualFuelSaving, setActualFuelSaving] = useState(false);
  const [mapRows, setMapRows] = useState<FleetStatusRow[]>([]);
  const [mapSummary, setMapSummary] = useState<FleetStatusResult["summary"]>();
  const [mapError, setMapError] = useState<string | undefined>();
  const [mapFallback, setMapFallback] = useState<FleetStatusResult | undefined>();
  const [fuelError, setFuelError] = useState<string | undefined>();
  const [auditError, setAuditError] = useState<string | undefined>();
  const [fuelToday, setFuelToday] = useState<FuelTodayResult>();
  const [selectedFuelDate, setSelectedFuelDate] = useState(() => getTodayInputDate());
  const [fuelSearch, setFuelSearch] = useState("");
  const [selectedReportDate, setSelectedReportDate] = useState(() => getTodayInputDate());
  const [reportSearch, setReportSearch] = useState("");
  const [driverAudit, setDriverAudit] = useState<DriverAuditResult["audit"]>();
  const [cronStatus, setCronStatus] = useState<CronStatusResult["status"]>();
  const [cronStatusLoading, setCronStatusLoading] = useState(false);
  const [cronStatusError, setCronStatusError] = useState<string | undefined>();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffForm, setStaffForm] = useState<StaffForm>({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "viewer",
    status: "active",
    telegramChatId: "",
  });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | undefined>();
  const [actualFuelForm, setActualFuelForm] = useState<ActualFuelForm>({
    registration: "",
    driverName: "",
    liters: "",
    filledAt: "",
    stationName: "",
    receiptNo: "",
    note: "",
  });
  const didAutoLoad = useRef(false);
  const fleetStatusInFlight = useRef(false);
  const cronStatusInFlight = useRef(false);
  const lastLiveRefreshAt = useRef(0);
  const [state, setState] = useState<RunState>({
    status: "idle",
    report: "กดพรีวิวรายงานเพื่อดึงข้อมูลล่าสุดจาก Cartrack",
  });

  const needsDailyReportPreview = DAILY_REPORT_VIEWS.includes(view);
  const needsFleetStatus = FLEET_STATUS_VIEWS.includes(view);
  const needsCronStatus = CRON_STATUS_VIEWS.includes(view);
  const needsReportList = REPORT_LIST_VIEWS.includes(view);
  const needsFuelToday = FUEL_TODAY_VIEWS.includes(view);
  const needsDriverAudit = DRIVER_AUDIT_VIEWS.includes(view);
  const pageMeta = PAGE_META[view];
  const runErrorDisplay = getRunErrorDisplay(state.error);
  const rows = state.data?.rows?.length ? state.data.rows : sampleRows;
  const summary = state.data?.summary;
  const health = useMemo(
    () => getHealth(needsDailyReportPreview ? state.status : "idle"),
    [needsDailyReportPreview, state.status],
  );
  const visibleMapRows = mapRows.slice(0, 8);
  const auditSummary = useMemo(() => buildAuditSummary(rows, fuelToday), [rows, fuelToday]);
  const liveSummary = mapSummary ?? {
    total: mapRows.length,
    visible: mapRows.length,
    ignitionOn: mapRows.filter((row) => row.ignition === true).length,
    moving: mapRows.filter((row) => row.ignition === true && row.idling === false).length,
    withDriver: mapRows.filter((row) => row.driverName !== "-").length,
  };
  const liveDriverCoverage =
    liveSummary.visible > 0 ? Math.round((liveSummary.withDriver / liveSummary.visible) * 100) : 0;
  const liveFuelCoverage =
    liveSummary.visible > 0
      ? Math.round((mapRows.filter((row) => typeof row.fuelLevel === "number").length / liveSummary.visible) * 100)
      : 0;
  const liveLastUpdated =
    mapFallback?.snapshotCreatedAt
      ? formatDateTime(mapFallback.snapshotCreatedAt)
      : getLatestFleetUpdateLabel(mapRows);
  const overviewStats = useMemo(
    () => buildOverviewStats(rows, reports, liveSummary, fuelToday),
    [rows, reports, liveSummary, fuelToday],
  );
  const overnightFuelLoss = useMemo(() => buildOvernightFuelLossSummary(driverAudit?.cases ?? []), [driverAudit]);
  const fuelDashboard = useMemo(() => buildFuelDashboard(fuelToday), [fuelToday]);
  const realtimeFuel = useMemo(() => buildRealtimeFuel(mapRows, rows, selectedReportDate), [mapRows, rows, selectedReportDate]);
  const filteredDistanceRows = useMemo(
    () => filterReportRows(auditSummary.distanceRanking, reportSearch),
    [auditSummary.distanceRanking, reportSearch],
  );
  const filteredFuelRows = useMemo(
    () => filterReportRows(auditSummary.fuelRanking, reportSearch),
    [auditSummary.fuelRanking, reportSearch],
  );
  const filteredMissingFuelRows = useMemo(
    () => filterReportRows(auditSummary.missingFuelRows, reportSearch),
    [auditSummary.missingFuelRows, reportSearch],
  );
  const filteredReports = useMemo(() => filterReportList(reports, reportSearch), [reports, reportSearch]);
  const filteredOvernightCases = useMemo(
    () => filterOvernightCases(overnightFuelLoss.cases, reportSearch),
    [overnightFuelLoss.cases, reportSearch],
  );
  const filteredRefuelEvents = useMemo(() => {
    const query = fuelSearch.trim().toLowerCase();
    if (!query) {
      return auditSummary.refillEvents;
    }

    return auditSummary.refillEvents.filter((event) =>
      [
        event.registration,
        event.driverName,
        event.positionDescription,
        String(event.refilledLiters),
        String(event.beforeLiters),
        String(event.afterLiters),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [auditSummary.refillEvents, fuelSearch]);

  useEffect(() => {
    if (didAutoLoad.current) {
      return;
    }
    didAutoLoad.current = true;
    if (needsDailyReportPreview) {
      void loadLatestReport();
    }
    if (needsFleetStatus) {
      void loadFleetStatus();
    }
    if (needsCronStatus) {
      void loadCronStatus();
    }
    if (needsReportList) {
      void loadReports();
    }
    if (needsFuelToday) {
      void loadFuelToday(false);
    }
    if (needsDriverAudit) {
      void loadDriverAudit();
    }
    if (view === "staff") {
      void loadStaff();
    }
  }, []);

  useEffect(() => {
    if (!needsFleetStatus && !needsCronStatus) {
      return;
    }
    const refreshLiveData = (force = false) => {
      if (!force && document.visibilityState !== "visible") {
        return;
      }
      lastLiveRefreshAt.current = Date.now();
      if (needsFleetStatus) {
        void loadFleetStatus();
      }
      if (needsCronStatus) {
        void loadCronStatus();
      }
    };
    const refreshWhenStale = () => {
      if (Date.now() - lastLiveRefreshAt.current >= LIVE_REFRESH_STALE_MS) {
        refreshLiveData(true);
      }
    };
    const interval = window.setInterval(() => {
      refreshLiveData();
    }, LIVE_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenStale);
    document.addEventListener("visibilitychange", refreshWhenStale);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenStale);
      document.removeEventListener("visibilitychange", refreshWhenStale);
    };
  }, [needsCronStatus, needsFleetStatus]);

  async function loadFleetStatus() {
    if (fleetStatusInFlight.current) {
      return;
    }
    fleetStatusInFlight.current = true;
    setMapLoading(true);
    setMapError(undefined);

    try {
      const response = await fetch("/api/fleet/status", {
        method: "GET",
      });
      const data = (await response.json()) as FleetStatusResult;
      if (!response.ok || !data.ok) {
        setMapError(data.message ?? "โหลดตำแหน่งรถไม่สำเร็จ");
        return;
      }
      setMapRows(data.rows ?? []);
      setMapSummary(data.summary);
      setMapFallback(data.fallback ? data : undefined);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : "โหลดตำแหน่งรถไม่สำเร็จ");
      setMapFallback(undefined);
    } finally {
      fleetStatusInFlight.current = false;
      setMapLoading(false);
    }
  }

  async function loadCronStatus() {
    if (cronStatusInFlight.current) {
      return;
    }
    cronStatusInFlight.current = true;
    setCronStatusLoading(true);
    setCronStatusError(undefined);

    try {
      const response = await fetch("/api/cron/status", { method: "GET" });
      const data = (await response.json()) as CronStatusResult;
      if (!response.ok || !data.ok) {
        setCronStatusError(data.message ?? "โหลดสถานะ cronjob ไม่สำเร็จ");
        return;
      }
      setCronStatus(data.status);
    } catch (error) {
      setCronStatusError(error instanceof Error ? error.message : "โหลดสถานะ cronjob ไม่สำเร็จ");
    } finally {
      cronStatusInFlight.current = false;
      setCronStatusLoading(false);
    }
  }

  async function run(send: boolean) {
    setLoading(send ? "send" : "preview");
    setState((current) => ({
      ...current,
      status: "idle",
      error: undefined,
      report: "กำลังเชื่อมต่อ Cartrack และสร้างรายงาน...",
    }));

    try {
      const response = await fetch(`/api/report/run?send=${send ? "1" : "0"}`, {
        method: "POST",
      });
      const data = (await response.json()) as ApiResult;

      if (!response.ok || !data.ok) {
        setState({
          status: "error",
          report: data.message ?? "รันรายงานไม่สำเร็จ",
          error: data.message ?? "รันรายงานไม่สำเร็จ",
        });
        return;
      }

      setState({
        status: data.sent ? "sent" : "ready",
        report: data.report ?? "",
        data,
      });
      void loadReports();
    } catch (error) {
      setState({
        status: "error",
        report: error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
        error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
      });
    } finally {
      setLoading(null);
    }
  }

  async function loadLatestReport(date = selectedReportDate) {
    setReportDataLoading(true);
    try {
      const params = new URLSearchParams({ latest: "1", date });
      const response = await fetch(`/api/reports?${params.toString()}`);
      const data = (await response.json()) as {
        ok: boolean;
        latest?: (ApiResult & { id: string; createdAt: string; text?: string }) | null;
        message?: string;
      };

      if (!response.ok || !data.ok || !data.latest) {
        return;
      }

      const latestReport: ApiResult = {
        ok: true,
        sent: data.latest.sent,
        report: data.latest.text ?? data.latest.report ?? "",
        vehicleCount: data.latest.vehicleCount,
        fuelAvailableCount: data.latest.fuelAvailableCount,
        summary: data.latest.summary,
        window: data.latest.window,
        rows: data.latest.rows,
      };

      setState({
        status: "ready",
        report: latestReport.report ?? "โหลดรายงานล่าสุดจาก MongoDB สำเร็จ",
        data: latestReport,
      });
    } catch {
      // Keep cached-report failures silent. Manual preview still reports actionable Cartrack errors.
    } finally {
      setReportDataLoading(false);
    }
  }

  async function loadReports(date = selectedReportDate) {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", date });
      const response = await fetch(`/api/reports?${params.toString()}`);
      const data = (await response.json()) as { ok: boolean; reports?: ReportListItem[]; message?: string };
      if (response.ok && data.ok) {
        setReports(data.reports ?? []);
      }
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadFuelToday(snapshot = false, date = selectedFuelDate) {
    setFuelLoading(true);
    setFuelError(undefined);
    try {
      const params = new URLSearchParams({
        snapshot: snapshot ? "1" : "0",
        date,
      });
      const response = await fetch(`/api/fuel/today?${params.toString()}`);
      const data = (await response.json()) as FuelTodayResult;
      if (!response.ok || !data.ok) {
        setFuelError(data.message ?? "โหลดข้อมูลเติมน้ำมันไม่สำเร็จ");
        return;
      }
      setFuelToday(data);
    } catch (error) {
      setFuelError(error instanceof Error ? error.message : "โหลดข้อมูลเติมน้ำมันไม่สำเร็จ");
    } finally {
      setFuelLoading(false);
    }
  }

  async function saveActualFuelRefill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const labelDate = fuelToday?.window?.labelDate;
    const liters = Number(actualFuelForm.liters);
    if (!labelDate) {
      setFuelError("ยังไม่มีวันที่รายงาน กรุณาโหลดข้อมูลวันนี้ก่อน");
      return;
    }
    if (!actualFuelForm.registration.trim() || !Number.isFinite(liters) || liters <= 0) {
      setFuelError("กรอกทะเบียนและจำนวนลิตรที่เติมจริงให้ถูกต้อง");
      return;
    }

    setActualFuelSaving(true);
    setFuelError(undefined);
    try {
      const response = await fetch("/api/fuel/actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelDate,
          registration: actualFuelForm.registration.trim(),
          driverName: actualFuelForm.driverName.trim() || undefined,
          liters,
          filledAt: actualFuelForm.filledAt ? new Date(actualFuelForm.filledAt).toISOString() : undefined,
          stationName: actualFuelForm.stationName.trim() || undefined,
          receiptNo: actualFuelForm.receiptNo.trim() || undefined,
          note: actualFuelForm.note.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setFuelError(data.message ?? "บันทึกยอดเติมจริงไม่สำเร็จ");
        return;
      }

      resetActualFuelForm();
      await loadFuelToday(false);
    } catch (error) {
      setFuelError(error instanceof Error ? error.message : "บันทึกยอดเติมจริงไม่สำเร็จ");
    } finally {
      setActualFuelSaving(false);
    }
  }

  async function deleteActualFuelRefill(refill: ActualFuelRefill) {
    const confirmed = window.confirm(`ลบยอดเติมจริง ${refill.registration} ${formatNumber(refill.liters)} ลิตร ใช่ไหม?`);
    if (!confirmed) {
      return;
    }

    setActualFuelSaving(true);
    setFuelError(undefined);
    try {
      const response = await fetch(`/api/fuel/actual?id=${encodeURIComponent(refill.id)}`, { method: "DELETE" });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setFuelError(data.message ?? "ลบยอดเติมจริงไม่สำเร็จ");
        return;
      }
      await loadFuelToday(false);
    } catch (error) {
      setFuelError(error instanceof Error ? error.message : "ลบยอดเติมจริงไม่สำเร็จ");
    } finally {
      setActualFuelSaving(false);
    }
  }

  function resetActualFuelForm() {
    setActualFuelForm({
      registration: "",
      driverName: "",
      liters: "",
      filledAt: "",
      stationName: "",
      receiptNo: "",
      note: "",
    });
  }

  async function loadDriverAudit(date = selectedReportDate) {
    setAuditLoading(true);
    setAuditError(undefined);
    try {
      const response = await fetch(`/api/audit?date=${encodeURIComponent(date)}`);
      const data = (await response.json()) as DriverAuditResult;
      if (!response.ok || !data.ok) {
        setAuditError(data.message ?? "โหลด Driver Audit ไม่สำเร็จ");
        return;
      }
      setDriverAudit(data.audit);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "โหลด Driver Audit ไม่สำเร็จ");
    } finally {
      setAuditLoading(false);
    }
  }

  async function loadReportFilters() {
    if (needsDailyReportPreview) {
      await loadLatestReport(selectedReportDate);
    }
    if (needsReportList) {
      await loadReports(selectedReportDate);
    }
    if (view === "reports") {
      await Promise.all([loadFuelToday(false, selectedReportDate), loadDriverAudit(selectedReportDate)]);
    }
    if (view === "reportOvernightFuel") {
      await loadDriverAudit(selectedReportDate);
    }
  }

  async function syncDriverAudit(includeReport = false) {
    setAuditLoading(true);
    setAuditError(undefined);
    try {
      const response = await fetch(`/api/audit?report=${includeReport ? "1" : "0"}`, { method: "POST" });
      const data = (await response.json()) as DriverAuditResult;
      if (!response.ok || !data.ok) {
        setAuditError(data.message ?? "สร้าง Driver Audit ไม่สำเร็จ");
        return;
      }
      setDriverAudit(data.audit);
      void loadFleetStatus();
      void loadFuelToday(false);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "สร้าง Driver Audit ไม่สำเร็จ");
    } finally {
      setAuditLoading(false);
    }
  }

  async function updateAuditCase(id: string, status: DriverAuditStatus) {
    setAuditLoading(true);
    setAuditError(undefined);
    try {
      const response = await fetch("/api/audit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reviewer: "dashboard" }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setAuditError(data.message ?? "อัพเดทเคสไม่สำเร็จ");
        return;
      }
      await loadDriverAudit();
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "อัพเดทเคสไม่สำเร็จ");
    } finally {
      setAuditLoading(false);
    }
  }

  async function loadStaff() {
    setStaffLoading(true);
    setStaffError(undefined);
    try {
      const response = await fetch("/api/staff");
      const data = (await response.json()) as { ok: boolean; staff?: StaffMember[]; message?: string };
      if (!response.ok || !data.ok) {
        setStaffError(data.message ?? "โหลด staff ไม่สำเร็จ");
        return;
      }
      setStaff(data.staff ?? []);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "โหลด staff ไม่สำเร็จ");
    } finally {
      setStaffLoading(false);
    }
  }

  async function saveStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStaffSaving(true);
    setStaffError(undefined);
    const isEditing = Boolean(editingStaffId);

    try {
      const response = await fetch("/api/staff", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...staffForm,
          id: editingStaffId ?? undefined,
          password: staffForm.password.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setStaffError(data.message ?? "บันทึก staff ไม่สำเร็จ");
        return;
      }
      resetStaffForm();
      await loadStaff();
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "บันทึก staff ไม่สำเร็จ");
    } finally {
      setStaffSaving(false);
    }
  }

  function editStaff(member: StaffMember) {
    setEditingStaffId(member.id);
    setStaffError(undefined);
    setStaffForm({
      name: member.name,
      email: member.email,
      username: member.username,
      password: "",
      role: member.role,
      status: member.status,
      telegramChatId: member.telegramChatId,
    });
  }

  function resetStaffForm() {
    setEditingStaffId(null);
    setStaffForm({
      name: "",
      email: "",
      username: "",
      password: "",
      role: "viewer",
      status: "active",
      telegramChatId: "",
    });
  }

  async function removeStaff(member: StaffMember) {
    const confirmed = window.confirm(`ลบ staff "${member.name}" ใช่ไหม?`);
    if (!confirmed) {
      return;
    }

    setStaffSaving(true);
    setStaffError(undefined);
    try {
      const response = await fetch(`/api/staff?id=${encodeURIComponent(member.id)}`, { method: "DELETE" });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setStaffError(data.message ?? "ลบ staff ไม่สำเร็จ");
        return;
      }
      if (editingStaffId === member.id) {
        resetStaffForm();
      }
      await loadStaff();
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "ลบ staff ไม่สำเร็จ");
    } finally {
      setStaffSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="dashboard">
      <aside className={`sidebar ${mobileMenuOpen ? "menu-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Truck size={22} aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <strong>VSCTruck</strong>
            <span>Fleet Operations</span>
          </div>
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={mobileMenuOpen ? "ปิดเมนูนำทาง" : "เปิดเมนูนำทาง"}
            aria-expanded={mobileMenuOpen}
            aria-controls="dashboard-nav"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className="mobile-menu-icon" aria-hidden="true">
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </span>
            <span className="mobile-menu-copy">
              <span>{mobileMenuOpen ? "ปิด" : "เมนู"}</span>
            </span>
          </button>
        </div>

        <nav className="nav-list" id="dashboard-nav" aria-label="Dashboard sections">
          <span className="nav-group">การใช้งาน</span>
          <NavLink active={view === "overview"} href="/" icon={<Gauge size={18} />} label="ภาพรวม" />
          <NavLink active={view === "live"} href="/live" icon={<Activity size={18} />} label="ข้อมูลสด API" />
          <NavLink active={view === "map"} href="/map" icon={<MapPin size={18} />} label="แผนที่" />
          <NavLink active={view === "vehicles"} href="/vehicles" icon={<Truck size={18} />} label="รายการรถ" />
          <NavLink active={view === "fuel"} href="/fuel" icon={<Fuel size={18} />} label="เติมน้ำมันวันนี้" />
          <NavLink active={view === "audit"} href="/audit" icon={<ShieldCheck size={18} />} label="Driver Audit" />

          <span className="nav-group">รายงาน</span>
          <NavLink active={view === "reports"} href="/reports" icon={<History size={18} />} label="สรุปรวม" />
          <NavLink active={view === "reportDistance"} href="/reports/distance" icon={<Gauge size={18} />} label="ระยะทาง" />
          <NavLink active={view === "reportFuel"} href="/reports/fuel" icon={<Fuel size={18} />} label="ใช้น้ำมัน" />
          <NavLink active={view === "reportRefuel"} href="/reports/refuel" icon={<Fuel size={18} />} label="เติมน้ำมัน" />
          <NavLink active={view === "reportOvernightFuel"} href="/reports/overnight-fuel-loss" icon={<AlertCircle size={18} />} label="น้ำมันหายข้ามคืน" />
          <NavLink active={view === "reportArchive"} href="/reports/archive" icon={<Database size={18} />} label="ประวัติรายงาน" />

          <span className="nav-group">การแจ้งเตือน</span>
          <NavLink active={view === "telegram"} href="/telegram" icon={<Bot size={18} />} label="Telegram" />

          <span className="nav-group">ผู้ดูแลระบบ</span>
          <NavLink active={view === "staff"} href="/staff" icon={<UsersRound size={18} />} label="Staff" />
          <button className="nav-item nav-button" type="button" onClick={logout}>
            <LogOut size={18} aria-hidden="true" />
            <span>ออกจากระบบ</span>
          </button>
        </nav>

        <div className="sidebar-card">
          <span>เวลาส่งรายงาน</span>
          <strong>18:00</strong>
          <small>Asia/Bangkok ทุกวัน</small>
        </div>
        <div className="sidebar-mini">
          <span>API status</span>
          <strong>{mapLoading ? "Syncing" : mapError ? "Error" : "Online"}</strong>
          <small>{liveSummary.visible} vehicles visible</small>
        </div>
      </aside>

      <section className="main-area">
        <header className="dashboard-header" id="overview">
          <div>
            <p className="eyebrow">{pageMeta.eyebrow}</p>
            <h1>{pageMeta.title}</h1>
            <p className="subtitle">{pageMeta.subtitle}</p>
          </div>
          <div className={`health ${health.kind}`}>
            {health.icon}
            <div>
              <strong>{health.title}</strong>
              <span>{health.detail}</span>
            </div>
          </div>
        </header>

        {needsDailyReportPreview && state.error ? (
          <section className="alert-panel" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <strong>{runErrorDisplay.title}</strong>
              <p>{state.error}</p>
              <span>{runErrorDisplay.hint}</span>
            </div>
          </section>
        ) : null}

        {needsDailyReportPreview && state.data?.storageWarning ? (
          <section className="info-panel" role="status">
            {state.data.storageWarning}
          </section>
        ) : null}

        {needsFleetStatus && mapFallback ? (
          <section className="info-panel live-fallback-panel">
            <Database size={18} aria-hidden="true" />
            <div>
              <strong>ใช้ข้อมูลล่าสุดจาก MongoDB แทนข้อมูลสด</strong>
              <span>
                Snapshot ล่าสุด {mapFallback.snapshotCreatedAt ? formatDateTime(mapFallback.snapshotCreatedAt) : "-"}
                {mapFallback.fallbackReason ? ` · สาเหตุ: ${mapFallback.fallbackReason}` : ""}
              </span>
            </div>
          </section>
        ) : null}

        <section className="toolbar">
          <div className="toolbar-meta">
            <CalendarClock size={18} aria-hidden="true" />
            <div>
              <span>
                {needsDailyReportPreview
                  ? "Report window"
                  : needsFuelToday
                    ? "Fuel snapshot window"
                    : needsDriverAudit
                      ? "Audit window"
                      : "Workspace"}
              </span>
              <strong>
                {needsDailyReportPreview && state.data?.window
                  ? `${state.data.window.startTimestamp} - ${state.data.window.endTimestamp}`
                  : needsFuelToday && fuelToday?.window
                    ? `${fuelToday.window.startTimestamp} - ${fuelToday.window.endTimestamp}`
                    : needsDriverAudit && driverAudit
                      ? `${driverAudit.labelDate} · ${formatDateTime(driverAudit.generatedAt)}`
                      : needsDailyReportPreview
                        ? "กำลังโหลดรายงานล่าสุด"
                        : "กำลังโหลดข้อมูลล่าสุด"}
              </strong>
            </div>
          </div>
          <div className="actions">
            {needsDailyReportPreview ? (
              <button className="button secondary" disabled={loading !== null} onClick={() => run(false)}>
                {loading === "preview" ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                พรีวิวรายงาน
              </button>
            ) : null}
            {needsFleetStatus ? (
              <button className="button secondary" disabled={mapLoading} onClick={() => loadFleetStatus()}>
                {mapLoading ? <Loader2 className="spin" size={18} /> : <MapPin size={18} />}
                รีเฟรชตำแหน่ง
              </button>
            ) : null}
            {!needsFleetStatus && needsFuelToday ? (
              <button className="button secondary" disabled={fuelLoading} onClick={() => loadFuelToday(false)}>
                {fuelLoading ? <Loader2 className="spin" size={18} /> : <Fuel size={18} />}
                รีเฟรชน้ำมัน
              </button>
            ) : null}
            {!needsFuelToday && needsDriverAudit ? (
              <button className="button secondary" disabled={auditLoading} onClick={() => loadDriverAudit()}>
                {auditLoading ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
                รีเฟรช Audit
              </button>
            ) : null}
            {needsReportList && !needsDailyReportPreview ? (
              <button className="button secondary" disabled={reportsLoading} onClick={() => loadReports()}>
                {reportsLoading ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
                รีเฟรชรายงาน
              </button>
            ) : null}
            {view === "telegram" ? (
              <button className="button" disabled={loading !== null} onClick={() => run(true)}>
                {loading === "send" ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                ส่ง Telegram
              </button>
            ) : null}
          </div>
        </section>

        {view === "overview" ? (
          <>
            <section className="kpi-grid">
              <MetricCard
                label="จำนวนรถในรายงาน"
                value={state.data?.vehicleCount ?? overviewStats.reportVehicleCount}
                suffix="คัน"
                icon={<Truck size={20} aria-hidden="true" />}
                tone="fleet"
              />
              <MetricCard
                label="ระยะทางรวมวันนี้"
                value={formatNumber(summary?.totalDistanceKm ?? overviewStats.totalDistanceKm)}
                suffix="กม."
                icon={<Gauge size={20} aria-hidden="true" />}
                tone="distance"
              />
              <MetricCard
                label="ใช้น้ำมันรวม"
                value={formatNumber(summary?.totalFuelLiters ?? overviewStats.totalFuelLiters)}
                suffix="ลิตร"
                icon={<Fuel size={20} aria-hidden="true" />}
                tone="fuel"
              />
              <MetricCard
                label="น้ำมันเพิ่มจาก snapshot"
                value={formatNumber(overviewStats.totalRefilledLiters)}
                suffix="ลิตร"
                icon={<Fuel size={20} aria-hidden="true" />}
                tone="refuel"
              />
            </section>

            <section className="overview-pulse" aria-label="Operational summary">
              <OverviewPulseItem label="รถออนไลน์" value={`${liveSummary.visible}/${liveSummary.total}`} />
              <OverviewPulseItem label="กำลังวิ่ง" value={`${liveSummary.moving} คัน`} />
              <OverviewPulseItem label="ข้อมูลน้ำมันพร้อมตรวจ" value={`${overviewStats.fuelCoveragePercent}%`} />
              <OverviewPulseItem label="เคสข้ามคืน" value={`${overnightFuelLoss.count} เคส`} tone={overnightFuelLoss.count > 0 ? "danger" : "ok"} />
            </section>

            <section className="overview-grid">
              <div className="panel overview-command-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Operations health</p>
                    <h2>ภาพรวมสถานะรถแบบสด</h2>
                  </div>
                  <span className="pill">{liveSummary.visible} visible</span>
                </div>
                <div className="overview-command-body">
                  <FleetStatusDonut summary={liveSummary} />
                  <div className="overview-status-list">
                    <OverviewStatusItem label="กำลังวิ่ง" value={liveSummary.moving} tone="green" />
                    <OverviewStatusItem label="ติดเครื่องจอด/ชะลอ" value={Math.max(liveSummary.ignitionOn - liveSummary.moving, 0)} tone="orange" />
                    <OverviewStatusItem label="ดับเครื่องหรือไม่เคลื่อนที่" value={Math.max(liveSummary.visible - liveSummary.ignitionOn, 0)} tone="slate" />
                    <OverviewStatusItem label="มีข้อมูลคนขับ" value={liveSummary.withDriver} tone="blue" />
                  </div>
                </div>
              </div>

              <div className="panel overview-insight-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Today audit</p>
                    <h2>จุดที่ควรตรวจสอบ</h2>
                  </div>
                  <ShieldCheck size={22} aria-hidden="true" />
                </div>
                <div className="insight-list">
                  <InsightItem
                    icon={<Truck size={18} />}
                    title="รถที่มีข้อมูลน้ำมัน"
                    value={`${overviewStats.fuelCoveragePercent}%`}
                    detail={`${overviewStats.fuelVehicleCount}/${overviewStats.reportVehicleCount} คันพร้อมตรวจ`}
                  />
                  <InsightItem
                    icon={<AlertCircle size={18} />}
                    title="รอข้อมูล sensor"
                    value={`${overviewStats.missingFuelCount} คัน`}
                    detail="ใช้ตรวจต่อในรายงานน้ำมัน"
                  />
                  <InsightItem
                    icon={<Database size={18} />}
                    title="Snapshot น้ำมัน"
                    value={`${overviewStats.snapshotCount}`}
                    detail={`${overviewStats.refillCount} รายการเติมวันนี้`}
                  />
                </div>
              </div>

              <OvernightFuelLossPanel
                data={overnightFuelLoss}
                loading={auditLoading}
                onRefresh={loadDriverAudit}
                compact
              />

              <CronStatusPanel
                status={cronStatus}
                loading={cronStatusLoading}
                error={cronStatusError}
                onRefresh={loadCronStatus}
              />

              <RealtimeFuelPanel data={realtimeFuel} loading={mapLoading} onRefresh={loadFleetStatus} />

              <BarChartPanel
                title="อันดับระยะทางวันนี้"
                eyebrow="Distance ranking"
                rows={overviewStats.distanceBars}
                suffix="กม."
                emptyText="ยังไม่มีข้อมูลระยะทางจากรายงาน"
              />
              <BarChartPanel
                title="อันดับใช้น้ำมันวันนี้"
                eyebrow="Fuel usage"
                rows={overviewStats.fuelBars}
                suffix="ลิตร"
                emptyText="ยังไม่มีข้อมูลน้ำมันจาก sensor"
              />

              <div className="panel overview-wide-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Report trend</p>
                    <h2>แนวโน้มรายงานล่าสุด</h2>
                  </div>
                  <span className="pill">{overviewStats.reportTrend.length} วันล่าสุด</span>
                </div>
                <TrendChart reports={overviewStats.reportTrend} />
              </div>

              <div className="panel overview-wide-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Latest archive</p>
                    <h2>รายงานย้อนหลังล่าสุด</h2>
                  </div>
                  <button className="icon-action" onClick={() => loadReports()} disabled={reportsLoading}>
                    {reportsLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                  </button>
                </div>
                <div className="report-list compact">
                  {overviewStats.latestReportsByDate.slice(0, 4).length === 0 ? (
                    <div className="empty-state">ยังไม่มีรายงานย้อนหลัง</div>
                  ) : (
                    overviewStats.latestReportsByDate.slice(0, 4).map((report) => (
                      <div className="report-item overview-report-item" key={report.id}>
                        <div>
                          <strong>{report.window.labelDate}</strong>
                          <span>{formatDateTime(report.createdAt)}</span>
                        </div>
                        <div>
                          <span>รถ</span>
                          <strong>{report.vehicleCount}</strong>
                        </div>
                        <div>
                          <span>ระยะทาง</span>
                          <strong>{formatNumber(report.summary.totalDistanceKm)} กม.</strong>
                        </div>
                        <div>
                          <span>น้ำมัน</span>
                          <strong>{formatNumber(report.summary.totalFuelLiters)} ลิตร</strong>
                        </div>
                        <span className={report.sent ? "badge ok" : "badge neutral"}>{report.sent ? "ส่งแล้ว" : "พรีวิว"}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {view === "audit" ? (
          <section className="panel audit-command-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Driver audit center</p>
                <h2>ตรวจสอบพนักงานขับรถแบบมืออาชีพ</h2>
                <span className="panel-subtitle">Scorecard, exceptions, fuel evidence, data quality และ workflow ปิดเคส</span>
              </div>
              <div className="actions">
                <button className="button secondary" onClick={() => loadDriverAudit()} disabled={auditLoading}>
                  {auditLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                  โหลดล่าสุด
                </button>
                <button className="button secondary" onClick={() => syncDriverAudit(false)} disabled={auditLoading}>
                  {auditLoading ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
                  เก็บ Snapshot
                </button>
                <button className="button" onClick={() => syncDriverAudit(true)} disabled={auditLoading}>
                  {auditLoading ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
                  สร้าง Audit เต็ม
                </button>
              </div>
            </div>

            {auditError ? <div className="map-error">{auditError}</div> : null}
            {!driverAudit ? (
              <div className="empty-state">ยังไม่มี Driver Audit กด “สร้าง Audit เต็ม” เพื่อเก็บ snapshot และคำนวณคะแนน</div>
            ) : (
              <>
                <div className="audit-hero-panel">
                  <div>
                    <span>คะแนนเฉลี่ยทั้งทีม</span>
                    <strong>{driverAudit.summary.averageScore}</strong>
                    <small>จาก 100 คะแนน · {driverAudit.summary.driverCount} คนขับ</small>
                  </div>
                  <div className="audit-hero-grid">
                    <span><b>{driverAudit.summary.openCaseCount}</b> เคสเปิด</span>
                    <span><b>{driverAudit.summary.criticalCount + driverAudit.summary.highCount}</b> เคสเร่งด่วน</span>
                    <span><b>{driverAudit.dataQuality.missingDriverCount}</b> ไม่มีคนขับ</span>
                    <span><b>{driverAudit.dataQuality.staleGpsCount}</b> GPS stale</span>
                  </div>
                </div>

                <div className="audit-command-strip">
                  <AuditCard title="คะแนนเฉลี่ย" value={`${driverAudit.summary.averageScore}/100`} detail={`${driverAudit.summary.driverCount} คนขับ`} icon={<Gauge size={18} />} tone="orange" />
                  <AuditCard title="เคสเปิด" value={`${driverAudit.summary.openCaseCount}`} detail={`${driverAudit.summary.caseCount} เคสทั้งหมด`} icon={<AlertCircle size={18} />} />
                  <AuditCard title="Critical/High" value={`${driverAudit.summary.criticalCount}/${driverAudit.summary.highCount}`} detail="รายการที่ต้องตรวจทันที" icon={<ShieldCheck size={18} />} />
                  <AuditCard title="Snapshots" value={`${driverAudit.summary.snapshotCount}`} detail={`สร้างเมื่อ ${formatDateTime(driverAudit.generatedAt)}`} icon={<Database size={18} />} />
                </div>

                <div className="audit-quality-grid">
                  <MiniStat label="รถในรายงาน" value={driverAudit.dataQuality.reportRows} icon={<Truck size={18} />} />
                  <MiniStat label="รถ live ล่าสุด" value={driverAudit.dataQuality.liveVehicleCount} icon={<Activity size={18} />} />
                  <MiniStat label="ไม่มีคนขับ" value={driverAudit.dataQuality.missingDriverCount} icon={<UserRound size={18} />} />
                  <MiniStat label="ไม่มี fuel" value={driverAudit.dataQuality.missingFuelCount} icon={<Fuel size={18} />} />
                  <MiniStat label="GPS stale" value={driverAudit.dataQuality.staleGpsCount} icon={<MapPin size={18} />} />
                </div>

                <div className="audit-workbench">
                  <div>
                    <h2 className="section-title">Driver Scorecard</h2>
                    <div className="driver-score-list">
                      {driverAudit.drivers.length === 0 ? (
                        <div className="empty-state">ยังไม่มีข้อมูลคนขับใน audit นี้</div>
                      ) : (
                        driverAudit.drivers.map((driver) => (
                          <div className={`driver-score-card grade-${driver.grade.toLowerCase()}`} key={driver.driverName}>
                            <div className="driver-score-head">
                              <div>
                                <strong>{driver.driverName}</strong>
                                <span>{driver.registrations.join(", ") || "-"}</span>
                              </div>
                              <div className="score-badge">
                                <strong>{driver.score}</strong>
                                <span>{driver.grade}</span>
                              </div>
                            </div>
                            <div className="driver-grade-note">{getDriverGradeLabel(driver.grade)}</div>
                            <div className="driver-score-metrics">
                              <span>ระยะทาง <b>{formatNumber(driver.distanceKm)} กม.</b></span>
                              <span>น้ำมัน <b>{formatNumber(driver.fuelUsedLiters)} ลิตร</b></span>
                              <span>ลิตร/100 กม. <b>{driver.fuelEfficiencyLitersPer100Km === null ? "-" : formatNumber(driver.fuelEfficiencyLitersPer100Km)}</b></span>
                              <span>เติม <b>{formatNumber(driver.refillLiters)} ลิตร</b></span>
                              <span>idling <b>{driver.idlingSamples}</b></span>
                              <span>เคส <b>{driver.caseCount}</b></span>
                            </div>
                            <div className="driver-issue">{driver.topIssue}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="section-title">Exception Center</h2>
                    <div className="case-list">
                      {driverAudit.cases.length === 0 ? (
                        <div className="empty-state">ไม่พบเคสผิดปกติ</div>
                      ) : (
                        driverAudit.cases.map((item) => (
                          <div className={`case-card ${item.severity}`} key={item.id}>
                            <div className="case-head">
                              <span className={`severity ${item.severity}`}>{item.severity}</span>
                              <span className={`badge ${item.status === "resolved" || item.status === "ignored" ? "neutral" : item.status === "investigating" ? "warning" : "ok"}`}>{item.status}</span>
                            </div>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                            <div className="case-meta">
                              <span>{item.driverName}</span>
                              <span>{item.registration}</span>
                              <span>{item.evidence.time ? formatDateTime(item.evidence.time) : "-"}</span>
                            </div>
                            <small>{item.evidence.positionDescription ?? ""}</small>
                            <div className="case-actions">
                              <button className="button secondary" onClick={() => updateAuditCase(item.id, "investigating")} disabled={auditLoading}>ตรวจสอบ</button>
                              <button className="button secondary" onClick={() => updateAuditCase(item.id, "ignored")} disabled={auditLoading}>ข้าม</button>
                              <button className="button" onClick={() => updateAuditCase(item.id, "resolved")} disabled={auditLoading}>ปิดเคส</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <DriverScoreGuide />
              </>
            )}
          </section>
        ) : null}

        {view === "live" ? (
        <section className="panel live-panel" id="live">
          <div className="panel-heading live-heading">
            <div>
              <p className="eyebrow">Cartrack live API</p>
              <h2>ข้อมูลสดจากรถและอุปกรณ์</h2>
              <span>สถานะล่าสุดของรถ คนขับ ตำแหน่ง น้ำมัน และเลขไมล์</span>
            </div>
            <div className="live-heading-actions">
              <span className={`live-source-pill ${mapFallback ? "fallback" : "live"}`}>
                {mapFallback ? "Snapshot" : "Live API"}
              </span>
              <button className="icon-action" onClick={() => loadFleetStatus()} disabled={mapLoading}>
                {mapLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
          </div>

          <div className="live-status-strip">
            <div className="live-status-card moving">
              <div className="live-status-icon">
                <Navigation size={20} aria-hidden="true" />
              </div>
              <span>กำลังวิ่ง</span>
              <strong>{liveSummary.moving}</strong>
            </div>
            <div className="live-status-card idle">
              <div className="live-status-icon">
                <Activity size={20} aria-hidden="true" />
              </div>
              <span>ติดเครื่อง</span>
              <strong>{Math.max(liveSummary.ignitionOn - liveSummary.moving, 0)}</strong>
            </div>
            <div className="live-status-card off">
              <div className="live-status-icon">
                <Truck size={20} aria-hidden="true" />
              </div>
              <span>ดับเครื่อง/ไม่เคลื่อนที่</span>
              <strong>{Math.max(liveSummary.visible - liveSummary.ignitionOn, 0)}</strong>
            </div>
            <div className="live-status-card driver">
              <div className="live-status-icon">
                <UserRound size={20} aria-hidden="true" />
              </div>
              <span>มีข้อมูลคนขับ</span>
              <strong>{liveSummary.withDriver}</strong>
            </div>
          </div>

          <div className="live-ops-strip">
            <LiveSignal label="อัปเดตล่าสุด" value={liveLastUpdated} />
            <LiveSignal
              label="ข้อมูลคนขับ"
              value={`${liveDriverCoverage}%`}
              tone={liveDriverCoverage >= 80 ? "ok" : "warning"}
            />
            <LiveSignal
              label="ข้อมูลน้ำมัน"
              value={`${liveFuelCoverage}%`}
              tone={liveFuelCoverage >= 80 ? "ok" : "warning"}
            />
            <LiveSignal label="แหล่งข้อมูล" value={mapFallback ? "MongoDB snapshot" : "Cartrack live"} tone={mapFallback ? "warning" : "ok"} />
          </div>

          <div className="live-summary-grid">
            <MiniStat label="รถทั้งหมด" value={liveSummary.total} icon={<Truck size={18} />} />
            <MiniStat label="แสดงบนแผนที่" value={liveSummary.visible} icon={<MapPin size={18} />} />
            <MiniStat label="ติดเครื่อง" value={liveSummary.ignitionOn} icon={<Activity size={18} />} />
            <MiniStat label="กำลังวิ่ง" value={liveSummary.moving} icon={<Navigation size={18} />} />
            <MiniStat label="มีข้อมูลคนขับ" value={liveSummary.withDriver} icon={<UserRound size={18} />} />
          </div>

          <div className="api-detail-grid">
            {visibleMapRows.length === 0 ? (
              <div className="empty-state">ยังไม่มีข้อมูลตำแหน่งสดจาก API</div>
            ) : (
              visibleMapRows.map((row) => (
                <div className={`api-vehicle-card ${getLiveStatusClass(row)}`} key={row.key}>
                  <div className="api-card-head">
                    <div>
                      <strong>{row.registration}</strong>
                      <span>{row.vehicleId ? `Vehicle ID: ${row.vehicleId}` : "Vehicle ID: -"}</span>
                    </div>
                    <span className={`live-state-badge ${getLiveStatusClass(row)}`}>{getLiveStatusLabel(row)}</span>
                  </div>
                  <div className="api-driver-row">
                    <div className="driver-avatar">
                      <UserRound size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <span>คนขับ</span>
                      <strong>{row.driverName && row.driverName !== "-" ? row.driverName : "ไม่พบข้อมูลคนขับ"}</strong>
                    </div>
                  </div>
                  <div className="api-card-metrics">
                    <span>
                      <Gauge size={14} />
                      {row.speed ?? 0} กม./ชม.
                    </span>
                    <span>
                      <Fuel size={14} />
                      {formatNullable(row.fuelLevel, "ลิตร")}
                    </span>
                    <span>
                      <Database size={14} />
                      {formatNullable(row.odometerKm, "กม.")}
                    </span>
                  </div>
                  <div className="api-card-location">
                    <MapPin size={14} />
                    <span>{row.positionDescription}</span>
                  </div>
                  <div className="api-card-location">
                    <Clock3 size={14} />
                    <span>{row.locationUpdated ?? row.eventTs ?? "-"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        ) : null}

        {view === "map" ? (
        <FleetMapPanel rows={mapRows} loading={mapLoading} error={mapError} />
        ) : null}

        {view === "vehicles" || view === "telegram" ? (
        <section className={`split ${view === "vehicles" || view === "telegram" ? "single" : ""}`}>
          {view === "vehicles" ? (
          <div className="panel table-panel" id="vehicles">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Vehicle detail</p>
                <h2>รายการรถในรายงาน</h2>
              </div>
              <span className="pill">{rows.length} rows</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ทะเบียน</th>
                    <th>คนขับ</th>
                    <th>วันที่</th>
                    <th>สตาร์ท</th>
                    <th>ดับเครื่องล่าสุดของวัน</th>
                    <th>ระยะทาง</th>
                    <th>น้ำมัน</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.registration}-${index}`}>
                      <td>
                        <strong>{row.registration}</strong>
                      </td>
                      <td>
                        <span className="driver">
                          <UserRound size={16} aria-hidden="true" />
                          {row.driverName}
                        </span>
                      </td>
                      <td>{row.reportDate}</td>
                      <td>{row.firstIgnitionOn ?? "-"}</td>
                      <td>{row.lastIgnitionOff ?? "-"}</td>
                      <td>{row.distanceKm === null ? "-" : `${formatNumber(row.distanceKm)} กม.`}</td>
                      <td>{row.fuelUsedLiters === null ? "-" : `${formatNumber(row.fuelUsedLiters)} ลิตร`}</td>
                      <td>
                        <span className={row.fuelUsedLiters === null ? "badge warning" : "badge ok"}>
                          {row.fuelUsedLiters === null ? "รอ sensor" : "พร้อม"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : null}

          {view === "telegram" ? (
          <div className="panel" id="telegram">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Telegram preview</p>
                <h2>ข้อความที่จะส่ง</h2>
              </div>
              <Bot size={22} aria-hidden="true" />
            </div>
            <pre className="message-preview">{state.report}</pre>
          </div>
          ) : null}
        </section>
        ) : null}

        {view === "fuel" ? (
          <section className="panel fuel-page-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Fuel today</p>
                <h2>ระดับน้ำมันเพิ่มขึ้นวันนี้</h2>
              </div>
              <button className="icon-action" onClick={() => loadFuelToday(false)} disabled={fuelLoading}>
                {fuelLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>

            {fuelError ? <div className="map-error">{fuelError}</div> : null}
            {fuelToday?.note ? <div className="info-panel">{fuelToday.note}</div> : null}

            <div className="fuel-hero-grid">
              <div className="fuel-total-card">
                <span>เติมจริงที่บันทึก</span>
                <strong>{formatNumber(fuelDashboard.totalActualRefillLiters)} ลิตร</strong>
                <small>{fuelDashboard.actualRefillCount} บิล · เทียบกับ {fuelDashboard.snapshotCount} snapshots</small>
              </div>
              <MiniStat label="Sensor เห็นเพิ่ม" value={`${formatNumber(fuelDashboard.totalRefilledLiters)} ลิตร`} icon={<Fuel size={18} />} />
              <MiniStat label="ผลต่างต้องตรวจ" value={`${formatNumber(fuelDashboard.totalFuelVarianceLiters)} ลิตร`} icon={<AlertCircle size={18} />} />
              <MiniStat label="เคสผิดปกติ" value={`${fuelDashboard.anomalyCount} คัน`} icon={<ShieldCheck size={18} />} />
            </div>

            <div className="fuel-reconcile-layout">
              <form className="fuel-actual-form" onSubmit={saveActualFuelRefill}>
                <div className="staff-form-title">
                  <div>
                    <strong>บันทึกยอดเติมจริง</strong>
                    <span>ใช้ยอดจากบิล/เด็กปั๊ม/หลักฐานจริง แล้วระบบจะเทียบกับ fuel sensor อัตโนมัติ</span>
                  </div>
                  <button className="button secondary" type="button" onClick={resetActualFuelForm} disabled={actualFuelSaving}>
                    ล้างฟอร์ม
                  </button>
                </div>
                <input
                  value={actualFuelForm.registration}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, registration: event.target.value.toUpperCase() }))}
                  placeholder="ทะเบียน เช่น 0704777"
                />
                <input
                  value={actualFuelForm.driverName}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, driverName: event.target.value }))}
                  placeholder="คนขับ"
                />
                <input
                  value={actualFuelForm.liters}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, liters: event.target.value }))}
                  placeholder="จำนวนลิตรที่เติมจริง"
                  inputMode="decimal"
                />
                <input
                  value={actualFuelForm.filledAt}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, filledAt: event.target.value }))}
                  type="datetime-local"
                />
                <input
                  value={actualFuelForm.stationName}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, stationName: event.target.value }))}
                  placeholder="สถานี/ปั๊ม"
                />
                <input
                  value={actualFuelForm.receiptNo}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, receiptNo: event.target.value }))}
                  placeholder="เลขที่บิล"
                />
                <input
                  className="fuel-form-wide"
                  value={actualFuelForm.note}
                  onChange={(event) => setActualFuelForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="หมายเหตุ"
                />
                <button className="button" type="submit" disabled={actualFuelSaving}>
                  {actualFuelSaving ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                  บันทึกและตรวจเทียบ
                </button>
              </form>

              <div className="fuel-reconcile-panel">
                <div className="fuel-section-heading">
                  <div>
                    <p className="eyebrow">Actual vs sensor</p>
                    <h2>ตรวจเทียบยอดเติมจริง</h2>
                  </div>
                  <span className="pill">{fuelDashboard.reconciliation.length} คัน</span>
                </div>
                <div className="fuel-reconcile-list">
                  {fuelDashboard.reconciliation.length === 0 ? (
                    <div className="empty-state">ยังไม่มีบิลเติมจริงหรือระดับน้ำมันเพิ่มขึ้นให้ตรวจเทียบ</div>
                  ) : (
                    fuelDashboard.reconciliation.map((item) => (
                      <div className={`fuel-reconcile-card ${item.status}`} key={item.registration}>
                        <div className="fuel-reconcile-head">
                          <div>
                            <strong>{item.registration}</strong>
                            <span>{item.driverName}</span>
                          </div>
                          <span className={`badge ${getFuelReconcileTone(item.status)}`}>{getFuelReconcileLabel(item.status)}</span>
                        </div>
                        <div className="fuel-reconcile-metrics">
                          <div><span>เติมจริง</span><strong>{formatNumber(item.actualLiters)} ลิตร</strong></div>
                          <div><span>Sensor เห็น</span><strong>{formatNumber(item.sensorIncreaseLiters)} ลิตร</strong></div>
                          <div><span>ผลต่าง</span><strong>{formatNumber(Math.abs(item.varianceLiters))} ลิตร</strong></div>
                          <div><span>หลักฐาน</span><strong>{item.receiptCount} บิล / {item.sampleCount} samples</strong></div>
                        </div>
                        <div className="fuel-reconcile-foot">
                          <span>Confidence: {item.confidence}</span>
                          {item.actualRefills.map((refill) => (
                            <button
                              className="icon-action danger"
                              type="button"
                              onClick={() => deleteActualFuelRefill(refill)}
                              disabled={actualFuelSaving}
                              key={refill.id}
                              title={`ลบ ${formatNumber(refill.liters)} ลิตร`}
                            >
                              <Trash2 size={16} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="fuel-dashboard-grid">
              <div className="fuel-status-panel">
                <h2 className="section-title">เปรียบเทียบสถานะวันนี้</h2>
                <div className="fuel-status-bars">
                  {fuelDashboard.statusBars.map((item) => (
                    <div className="fuel-status-row" key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.value} คัน</span>
                      </div>
                      <div className="fuel-status-track" aria-hidden="true">
                        <span className={item.tone} style={{ width: `${Math.max(item.percent, item.value > 0 ? 8 : 0)}%` }} />
                      </div>
                      <b>{item.percent}%</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fuel-status-panel">
                <h2 className="section-title">รถที่น้ำมันเหลือมากสุด</h2>
                <div className="fuel-ranking-list">
                  {fuelDashboard.topVehicles.length === 0 ? (
                    <div className="empty-state">ยังไม่มีข้อมูล fuel sensor วันนี้</div>
                  ) : (
                    fuelDashboard.topVehicles.map((vehicle, index) => (
                      <div className="fuel-ranking-row" key={vehicle.registration}>
                        <span className="rank small">{index + 1}</span>
                        <div>
                          <strong>{vehicle.registration}</strong>
                          <span>{vehicle.driverName}</span>
                        </div>
                        <div className="fuel-mini-bar">
                          <span style={{ width: `${Math.max(vehicle.percent, 4)}%` }} />
                        </div>
                        <b>{formatNullable(vehicle.latestFuelLiters, "ลิตร")}</b>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="fuel-events-panel">
                <div className="fuel-section-heading">
                  <div>
                    <p className="eyebrow">Refuel evidence</p>
                    <h2>หลักฐานระดับน้ำมันเพิ่มขึ้น</h2>
                  </div>
                  <span className="pill">{fuelDashboard.refilledCount} รายการ</span>
                </div>
                <div className="fuel-event-timeline">
                  {fuelDashboard.events.length === 0 ? (
                    <div className="empty-state">ยังไม่พบระดับน้ำมันเพิ่มขึ้นจาก snapshot วันนี้</div>
                  ) : (
                    fuelDashboard.events.map((event) => (
                      <div className="fuel-event-card" key={`${event.registration}-${event.afterTime}`}>
                        <div className="fuel-event-main">
                          <strong>{event.registration}</strong>
                          <span>{event.driverName}</span>
                          <small>{event.positionDescription}</small>
                        </div>
                        <div className="fuel-event-compare">
                          <div>
                            <span>ก่อนเพิ่ม</span>
                            <strong>{formatNumber(event.beforeLiters)} ลิตร</strong>
                          </div>
                          <div className="fuel-arrow">→</div>
                          <div>
                            <span>หลังเพิ่ม</span>
                            <strong>{formatNumber(event.afterLiters)} ลิตร</strong>
                          </div>
                          <div className="fuel-added">
                            <span>เพิ่มขึ้น</span>
                            <strong>{formatNumber(event.refilledLiters)} ลิตร</strong>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="fuel-status-panel fuel-latest-panel">
                <h2 className="section-title">สถานะน้ำมันล่าสุด</h2>
                <div className="fuel-vehicle-list">
                  {fuelDashboard.vehicles.map((vehicle) => (
                    <div className="fuel-vehicle-card" key={vehicle.registration}>
                      <div className="fuel-vehicle-identity">
                        <strong>{vehicle.registration}</strong>
                        <span>{vehicle.driverName}</span>
                      </div>
                      <div className="fuel-level-cell">
                        <div className="fuel-level-head">
                          <span>น้ำมันล่าสุด</span>
                          <strong>{formatNullable(vehicle.latestFuelLiters, "ลิตร")}</strong>
                        </div>
                        <div className="fuel-level-bar" aria-hidden="true">
                          <span style={{ width: `${clampPercent(vehicle.latestFuelPercentage ?? 0)}%` }} />
                        </div>
                        <small>{vehicle.latestFuelPercentage === null ? "ไม่พบเปอร์เซ็นต์" : `${formatNumber(vehicle.latestFuelPercentage)}%`}</small>
                      </div>
                      <div className="fuel-vehicle-meta">
                        <span className={vehicle.status === "refilled" ? "badge ok" : vehicle.status === "waiting" ? "badge warning" : "badge neutral"}>
                          {vehicle.status === "refilled" ? "เติมแล้ว" : vehicle.status === "waiting" ? "รอ snapshot" : "ยังไม่พบ"}
                        </span>
                        <div>
                          <span>ตัวอย่าง</span>
                          <strong>{vehicle.sampleCount}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                  {fuelDashboard.vehicles.length === 0 ? (
                    <div className="empty-state">ยังไม่มีข้อมูล fuel sensor วันนี้</div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {view === "reports" ? (
        <section className="ops-grid">
          <div className="panel audit-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Staff audit report</p>
                <h2>สรุปตรวจสอบพนักงาน</h2>
              </div>
              <button className="icon-action" onClick={() => loadFuelToday(false)} disabled={fuelLoading}>
                {fuelLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
            <ReportFilterBar
              date={selectedReportDate}
              search={reportSearch}
              loading={reportDataLoading || reportsLoading || fuelLoading || auditLoading}
              searchPlaceholder="ทะเบียน, คนขับ, วันที่, ระยะทาง, น้ำมัน"
              onDateChange={setSelectedReportDate}
              onSearchChange={setReportSearch}
              onLoad={() => void loadReportFilters()}
            />

            {fuelError ? <div className="map-error">{fuelError}</div> : null}

            <div className="audit-kpi-grid">
              <AuditCard
                title="ระดับน้ำมันเพิ่มขึ้นวันนี้"
                value={`${formatNumber(auditSummary.totalRefilledLiters)} ลิตร`}
                detail={`${auditSummary.refillCount} รายการจาก snapshot · ${auditSummary.snapshotCount} snapshots`}
                icon={<Fuel size={18} />}
                tone="orange"
              />
              <AuditCard
                title="วิ่งระยะทางเยอะสุด"
                value={auditSummary.maxDistance ? `${formatNumber(auditSummary.maxDistance.distanceKm ?? 0)} กม.` : "-"}
                detail={auditSummary.maxDistance ? `${auditSummary.maxDistance.registration} · ${auditSummary.maxDistance.driverName}` : "ยังไม่มีข้อมูล"}
                icon={<Gauge size={18} />}
              />
              <AuditCard
                title="วิ่งระยะทางน้อยสุด"
                value={auditSummary.minDistance ? `${formatNumber(auditSummary.minDistance.distanceKm ?? 0)} กม.` : "-"}
                detail={auditSummary.minDistance ? `${auditSummary.minDistance.registration} · ${auditSummary.minDistance.driverName}` : "ยังไม่มีข้อมูล"}
                icon={<Gauge size={18} />}
              />
              <AuditCard
                title="ใช้น้ำมันเยอะสุด"
                value={auditSummary.maxFuel ? `${formatNumber(auditSummary.maxFuel.fuelUsedLiters ?? 0)} ลิตร` : "-"}
                detail={auditSummary.maxFuel ? `${auditSummary.maxFuel.registration} · ${auditSummary.maxFuel.driverName}` : "ยังไม่มีข้อมูล sensor"}
                icon={<Fuel size={18} />}
              />
              <AuditCard
                title="ใช้น้ำมันน้อยสุด"
                value={auditSummary.minFuel ? `${formatNumber(auditSummary.minFuel.fuelUsedLiters ?? 0)} ลิตร` : "-"}
                detail={auditSummary.minFuel ? `${auditSummary.minFuel.registration} · ${auditSummary.minFuel.driverName}` : "ยังไม่มีข้อมูล sensor"}
                icon={<Fuel size={18} />}
              />
            </div>

            <div className="audit-grid">
              <AuditList title="อันดับระยะทาง" rows={filteredDistanceRows} valueKey="distanceKm" suffix="กม." />
              <AuditList title="อันดับใช้น้ำมัน" rows={filteredFuelRows} valueKey="fuelUsedLiters" suffix="ลิตร" />
              <div>
                <h2 className="section-title">ระดับน้ำมันเพิ่มขึ้นวันนี้</h2>
                <div className="report-list">
                  {auditSummary.refillEvents.length === 0 ? (
                    <div className="empty-state">ยังไม่พบระดับน้ำมันเพิ่มขึ้นวันนี้</div>
                  ) : (
                    auditSummary.refillEvents.map((event) => (
                      <div className="audit-list-item" key={`${event.registration}-${event.afterTime}`}>
                        <div>
                          <strong>{event.registration}</strong>
                          <span>{event.driverName}</span>
                        </div>
                        <div>
                          <span>เติมโดยประมาณ</span>
                          <strong>{formatNumber(event.refilledLiters)} ลิตร</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        ) : null}

        {view === "reportDistance" ? (
          <section className="panel report-detail-panel">
            <ReportDetailHeading
              eyebrow="Distance audit"
              title="รายงานระยะทาง"
              description="เรียงลำดับรถที่วิ่งมากที่สุดถึงน้อยที่สุด พร้อมคนขับ เวลาเริ่มงาน เวลาดับเครื่อง และน้ำมันที่ใช้"
            />
            <ReportFilterBar
              date={selectedReportDate}
              search={reportSearch}
              loading={reportDataLoading}
              searchPlaceholder="ทะเบียน, คนขับ, วันที่, เวลา, กม."
              onDateChange={setSelectedReportDate}
              onSearchChange={setReportSearch}
              onLoad={() => void loadLatestReport(selectedReportDate)}
            />
            <div className="audit-kpi-grid compact">
              <AuditCard title="ระยะทางรวม" value={`${formatNumber(summary?.totalDistanceKm ?? 0)} กม.`} detail={`${filteredDistanceRows.length}/${auditSummary.distanceRanking.length} คันที่แสดง`} icon={<Gauge size={18} />} tone="orange" />
              <AuditCard title="วิ่งมากสุด" value={auditSummary.maxDistance ? `${formatNumber(auditSummary.maxDistance.distanceKm ?? 0)} กม.` : "-"} detail={auditSummary.maxDistance ? `${auditSummary.maxDistance.registration} · ${auditSummary.maxDistance.driverName}` : "ยังไม่มีข้อมูล"} icon={<Truck size={18} />} />
              <AuditCard title="วิ่งน้อยสุด" value={auditSummary.minDistance ? `${formatNumber(auditSummary.minDistance.distanceKm ?? 0)} กม.` : "-"} detail={auditSummary.minDistance ? `${auditSummary.minDistance.registration} · ${auditSummary.minDistance.driverName}` : "ยังไม่มีข้อมูล"} icon={<Truck size={18} />} />
              <AuditCard title="ค่าเฉลี่ยต่อคัน" value={`${formatNumber(average(auditSummary.distanceRanking.map((row) => row.distanceKm ?? 0)))} กม.`} detail="เฉพาะรถที่มีข้อมูลระยะทาง" icon={<Activity size={18} />} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>ทะเบียน</th>
                    <th>คนขับ</th>
                    <th>วันที่</th>
                    <th>สตาร์ท</th>
                    <th>ดับเครื่องล่าสุด</th>
                    <th>ระยะทาง</th>
                    <th>น้ำมัน</th>
                    <th>ตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDistanceRows.length === 0 ? (
                    <tr><td colSpan={9}>ไม่พบข้อมูลระยะทางในวันที่หรือคำค้นหาที่เลือก</td></tr>
                  ) : filteredDistanceRows.map((row, index) => (
                    <tr key={`distance-${row.registration}-${index}`}>
                      <td><span className="rank small">{index + 1}</span></td>
                      <td><strong>{row.registration}</strong></td>
                      <td>{row.driverName}</td>
                      <td>{row.reportDate}</td>
                      <td>{row.firstIgnitionOn ?? "-"}</td>
                      <td>{row.lastIgnitionOff ?? "-"}</td>
                      <td><strong>{formatNumber(row.distanceKm ?? 0)} กม.</strong></td>
                      <td>{row.fuelUsedLiters === null ? "-" : `${formatNumber(row.fuelUsedLiters)} ลิตร`}</td>
                      <td>{getDistanceAuditNote(row, auditSummary.maxDistance, auditSummary.minDistance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {view === "reportFuel" ? (
          <section className="panel report-detail-panel">
            <ReportDetailHeading
              eyebrow="Fuel usage audit"
              title="รายงานการใช้น้ำมัน"
              description="เปรียบเทียบการใช้น้ำมันของแต่ละคัน พร้อมระยะทางและอัตราสิ้นเปลืองโดยประมาณ เพื่อช่วยตรวจสอบความผิดปกติ"
            />
            <ReportFilterBar
              date={selectedReportDate}
              search={reportSearch}
              loading={reportDataLoading}
              searchPlaceholder="ทะเบียน, คนขับ, ลิตร, ลิตร/100 กม."
              onDateChange={setSelectedReportDate}
              onSearchChange={setReportSearch}
              onLoad={() => void loadLatestReport(selectedReportDate)}
            />
            <div className="audit-kpi-grid compact">
              <AuditCard title="น้ำมันรวม" value={`${formatNumber(summary?.totalFuelLiters ?? 0)} ลิตร`} detail={`${filteredFuelRows.length}/${auditSummary.fuelRanking.length} คันที่แสดง`} icon={<Fuel size={18} />} tone="orange" />
              <AuditCard title="ใช้เยอะสุด" value={auditSummary.maxFuel ? `${formatNumber(auditSummary.maxFuel.fuelUsedLiters ?? 0)} ลิตร` : "-"} detail={auditSummary.maxFuel ? `${auditSummary.maxFuel.registration} · ${auditSummary.maxFuel.driverName}` : "ยังไม่มีข้อมูล"} icon={<Fuel size={18} />} />
              <AuditCard title="ใช้น้อยสุด" value={auditSummary.minFuel ? `${formatNumber(auditSummary.minFuel.fuelUsedLiters ?? 0)} ลิตร` : "-"} detail={auditSummary.minFuel ? `${auditSummary.minFuel.registration} · ${auditSummary.minFuel.driverName}` : "ยังไม่มีข้อมูล"} icon={<Fuel size={18} />} />
              <AuditCard title="ไม่มีข้อมูลน้ำมัน" value={`${summary?.missingFuelCount ?? 0} คัน`} detail="ควรตรวจ sensor/ข้อมูลจากอุปกรณ์" icon={<AlertCircle size={18} />} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>ทะเบียน</th>
                    <th>คนขับ</th>
                    <th>ระยะทาง</th>
                    <th>น้ำมันใช้</th>
                    <th>ลิตร/100 กม.</th>
                    <th>สถานะ</th>
                    <th>ตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFuelRows.length === 0 && filteredMissingFuelRows.length === 0 ? (
                    <tr><td colSpan={8}>ไม่พบข้อมูลน้ำมันในวันที่หรือคำค้นหาที่เลือก</td></tr>
                  ) : filteredFuelRows.map((row, index) => (
                    <tr key={`fuel-${row.registration}-${index}`}>
                      <td><span className="rank small">{index + 1}</span></td>
                      <td><strong>{row.registration}</strong></td>
                      <td>{row.driverName}</td>
                      <td>{row.distanceKm === null ? "-" : `${formatNumber(row.distanceKm)} กม.`}</td>
                      <td><strong>{formatNumber(row.fuelUsedLiters ?? 0)} ลิตร</strong></td>
                      <td>{formatFuelEfficiency(row)}</td>
                      <td><span className="badge ok">มีข้อมูล</span></td>
                      <td>{getFuelAuditNote(row, auditSummary.maxFuel, auditSummary.minFuel)}</td>
                    </tr>
                  ))}
                  {filteredMissingFuelRows.map((row, index) => (
                    <tr key={`missing-fuel-${row.registration}-${index}`}>
                      <td>-</td>
                      <td><strong>{row.registration}</strong></td>
                      <td>{row.driverName}</td>
                      <td>{row.distanceKm === null ? "-" : `${formatNumber(row.distanceKm)} กม.`}</td>
                      <td>-</td>
                      <td>-</td>
                      <td><span className="badge warning">รอ sensor</span></td>
                      <td>ไม่มีข้อมูลน้ำมัน ควรตรวจ sensor หรืออุปกรณ์</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {view === "reportRefuel" ? (
          <section className="panel report-detail-panel">
            <ReportDetailHeading
              eyebrow="Refuel audit"
              title="รายงานระดับน้ำมันเพิ่มขึ้น"
              description="เลือกวันที่ย้อนหลังจาก MongoDB และค้นหาตามทะเบียน คนขับ สถานที่ หรือจำนวนลิตรที่เพิ่มขึ้น"
            />
            <div className="report-filter-bar">
              <label>
                <span>วันที่</span>
                <input
                  type="date"
                  value={selectedFuelDate}
                  onChange={(event) => setSelectedFuelDate(event.target.value)}
                />
              </label>
              <label className="report-search-field">
                <span>ค้นหา</span>
                <div>
                  <Search size={16} aria-hidden="true" />
                  <input
                    type="search"
                    value={fuelSearch}
                    onChange={(event) => setFuelSearch(event.target.value)}
                    placeholder="ทะเบียน, คนขับ, สถานที่, ลิตร"
                  />
                </div>
              </label>
              <button className="button secondary" onClick={() => loadFuelToday(false)} disabled={fuelLoading}>
                {fuelLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                โหลดข้อมูล
              </button>
            </div>
            {fuelError ? <div className="map-error">{fuelError}</div> : null}
            {fuelToday?.note ? <div className="info-panel">{fuelToday.note}</div> : null}
            <div className="audit-kpi-grid compact">
              <AuditCard title="เพิ่มขึ้นรวม" value={`${formatNumber(auditSummary.totalRefilledLiters)} ลิตร`} detail={`${auditSummary.refillCount} รายการจาก snapshot`} icon={<Fuel size={18} />} tone="orange" />
              <AuditCard title="Snapshots" value={`${auditSummary.snapshotCount}`} detail="จำนวนรอบข้อมูลที่เก็บวันนี้" icon={<Database size={18} />} />
              <AuditCard title="ผลค้นหา" value={`${filteredRefuelEvents.length} รายการ`} detail={`จากทั้งหมด ${auditSummary.refillCount} รายการ`} icon={<Search size={18} />} />
              <AuditCard title="วันที่" value={fuelToday?.window?.labelDate ?? "-"} detail="เวลาประเทศไทย" icon={<CalendarClock size={18} />} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ทะเบียน</th>
                    <th>คนขับ</th>
                    <th>ก่อนเพิ่ม</th>
                    <th>หลังเพิ่ม</th>
                    <th>เพิ่มขึ้น</th>
                    <th>เวลาที่พบ</th>
                    <th>สถานที่</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefuelEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        {auditSummary.refillEvents.length === 0
                          ? "ยังไม่พบระดับน้ำมันเพิ่มขึ้นในวันที่เลือก"
                          : "ไม่พบข้อมูลที่ตรงกับคำค้นหา"}
                      </td>
                    </tr>
                  ) : (
                    filteredRefuelEvents.map((event) => (
                      <tr key={`${event.registration}-${event.afterTime}`}>
                        <td><strong>{event.registration}</strong></td>
                        <td>{event.driverName}</td>
                        <td>{formatNumber(event.beforeLiters)} ลิตร</td>
                        <td>{formatNumber(event.afterLiters)} ลิตร</td>
                        <td><strong>{formatNumber(event.refilledLiters)} ลิตร</strong></td>
                        <td>{formatDateTime(event.afterTime)}</td>
                        <td>{event.positionDescription}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {view === "reportOvernightFuel" ? (
          <section className="panel report-detail-panel">
            <ReportDetailHeading
              eyebrow="Overnight fuel loss"
              title="รายงานน้ำมันหายข้ามคืน"
              description="ตรวจรถที่น้ำมันลดลงหลังดับเครื่องหรือหลังจบรอบ โดยเทียบ snapshot ล่าสุดของวันก่อนหน้ากับ snapshot แรกของวันนี้"
            />
            <ReportFilterBar
              date={selectedReportDate}
              search={reportSearch}
              loading={auditLoading}
              searchPlaceholder="ทะเบียน, คนขับ, ระดับ, ลิตร, สถานที่"
              onDateChange={setSelectedReportDate}
              onSearchChange={setReportSearch}
              onLoad={() => void loadDriverAudit(selectedReportDate)}
            />
            {auditError ? <div className="map-error">{auditError}</div> : null}
            <div className="actions report-actions">
              <button className="button secondary" onClick={() => loadDriverAudit()} disabled={auditLoading}>
                {auditLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                โหลด Audit ล่าสุด
              </button>
              <button className="button" onClick={() => syncDriverAudit(false)} disabled={auditLoading}>
                {auditLoading ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
                เก็บ Snapshot / ตรวจซ้ำ
              </button>
            </div>

            <div className="audit-kpi-grid compact">
              <AuditCard title="รถที่พบเคส" value={`${filteredOvernightCases.length} คัน`} detail={`จากทั้งหมด ${overnightFuelLoss.count} เคส`} icon={<AlertCircle size={18} />} tone={overnightFuelLoss.count > 0 ? "red" : "green"} />
              <AuditCard title="น้ำมันหายรวม" value={`${formatNumber(overnightFuelLoss.totalLiters)} ลิตร`} detail="รวมเฉพาะเคสเปิดใน Audit ล่าสุด" icon={<Fuel size={18} />} tone="orange" />
              <AuditCard title="Critical" value={`${overnightFuelLoss.criticalCount} เคส`} detail="หาย 30 ลิตรขึ้นไป" icon={<ShieldCheck size={18} />} tone={overnightFuelLoss.criticalCount > 0 ? "red" : undefined} />
              <AuditCard title="อัพเดท Audit" value={driverAudit ? formatDateTime(driverAudit.generatedAt) : "-"} detail={driverAudit?.labelDate ?? "ยังไม่มีข้อมูล"} icon={<Clock3 size={18} />} />
            </div>

            <OvernightFuelLossTable cases={filteredOvernightCases} />
          </section>
        ) : null}

        {view === "reportArchive" ? (
        <section className="ops-grid">
          <div className="panel" id="reports">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Report archive</p>
                <h2>รายงานย้อนหลัง</h2>
              </div>
              <button className="icon-action" onClick={() => loadReports()} disabled={reportsLoading}>
                {reportsLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
            <ReportFilterBar
              date={selectedReportDate}
              search={reportSearch}
              loading={reportsLoading}
              searchPlaceholder="วันที่, สถานะ, จำนวนรถ, ระยะทาง, น้ำมัน"
              onDateChange={setSelectedReportDate}
              onSearchChange={setReportSearch}
              onLoad={() => void loadReports(selectedReportDate)}
            />
            <div className="report-list">
              {filteredReports.length === 0 ? (
                <div className="empty-state">ไม่พบรายงานย้อนหลังในวันที่หรือคำค้นหาที่เลือก</div>
              ) : (
                filteredReports.map((report) => (
                  <div className="report-item" key={report.id}>
                    <div>
                      <strong>{report.window.labelDate}</strong>
                      <span>{formatDateTime(report.createdAt)}</span>
                    </div>
                    <div>
                      <span>รถ</span>
                      <strong>{report.vehicleCount}</strong>
                    </div>
                    <div>
                      <span>ระยะทาง</span>
                      <strong>{formatNumber(report.summary.totalDistanceKm)} กม.</strong>
                    </div>
                    <div>
                      <span>น้ำมัน</span>
                      <strong>{formatNumber(report.summary.totalFuelLiters)} ลิตร</strong>
                    </div>
                    <span className={report.sent ? "badge ok" : "badge neutral"}>{report.sent ? "ส่งแล้ว" : "พรีวิว"}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>
        ) : null}

        {view === "staff" ? (
          <section className="panel staff-page-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Staff operations</p>
                <h2>จัดการ Staff</h2>
              </div>
              <span className="pill">{staff.length} users</span>
            </div>

            <div className="staff-admin-layout">
              <form className="staff-form" onSubmit={saveStaff}>
                <div className="staff-form-title">
                  <div>
                    <strong>{editingStaffId ? "อัพเดท Staff" : "เพิ่ม Staff"}</strong>
                    <span>{editingStaffId ? "แก้ไขบัญชีและสิทธิ์เข้าใช้งาน" : "สร้างผู้ใช้สำหรับเข้า VSCTruck"}</span>
                  </div>
                  {editingStaffId ? (
                    <button className="icon-action" type="button" onClick={resetStaffForm}>
                      <X size={18} />
                    </button>
                  ) : null}
                </div>
                <input
                  value={staffForm.name}
                  onChange={(event) => setStaffForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="ชื่อ staff"
                  required
                />
                <input
                  value={staffForm.email}
                  onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="email"
                  type="email"
                  required
                />
                <input
                  value={staffForm.username}
                  onChange={(event) => setStaffForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="username สำหรับ login"
                  required
                />
                <input
                  value={staffForm.password}
                  onChange={(event) => setStaffForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editingStaffId ? "password ใหม่ ถ้าต้องการเปลี่ยน" : "password"}
                  required={!editingStaffId}
                  type="password"
                  minLength={editingStaffId ? undefined : 8}
                />
                <select
                  value={staffForm.role}
                  onChange={(event) =>
                    setStaffForm((current) => ({ ...current, role: event.target.value as StaffForm["role"] }))
                  }
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={staffForm.status}
                  onChange={(event) =>
                    setStaffForm((current) => ({ ...current, status: event.target.value as StaffForm["status"] }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <input
                  value={staffForm.telegramChatId}
                  onChange={(event) => setStaffForm((current) => ({ ...current, telegramChatId: event.target.value }))}
                  placeholder="Telegram chat id"
                />
                <button className="button" disabled={staffSaving}>
                  {staffSaving ? <Loader2 className="spin" size={18} /> : <UsersRound size={18} />}
                  {editingStaffId ? "บันทึกการแก้ไข" : "เพิ่ม Staff"}
                </button>
              </form>

              {staffError ? <div className="map-error">{staffError}</div> : null}

              <div className="staff-list">
                {staffLoading ? (
                  <div className="empty-state">กำลังโหลด staff...</div>
                ) : staff.length === 0 ? (
                  <div className="empty-state">ยังไม่มี staff</div>
                ) : (
                  staff.map((member) => (
                    <div className="staff-item" key={member.id}>
                      <div className="staff-avatar">{member.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{member.name}</strong>
                        <span>{member.username} · {member.email}</span>
                      </div>
                      <span className="badge neutral">{member.role}</span>
                      <span className={member.status === "active" ? "badge ok" : "badge warning"}>{member.status}</span>
                      <div className="staff-actions">
                        <button className="icon-action" type="button" onClick={() => editStaff(member)}>
                          <Edit3 size={16} />
                        </button>
                        <button className="icon-action danger" type="button" onClick={() => removeStaff(member)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  suffix: string;
  icon: React.ReactNode;
  tone?: "fleet" | "distance" | "fuel" | "refuel";
}) {
  return (
    <div className={`metric-card ${tone ? `tone-${tone}` : ""}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>
        {value} <small>{suffix}</small>
      </strong>
    </div>
  );
}

function OverviewPulseItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "danger";
}) {
  return (
    <div className={`overview-pulse-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LiveSignal({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warning";
}) {
  return (
    <div className={`live-ops-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NavLink({
  active,
  href,
  icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link className={`nav-item ${active ? "active" : ""}`} href={href}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="mini-stat">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FleetStatusDonut({ summary }: { summary: NonNullable<FleetStatusResult["summary"]> }) {
  const total = Math.max(summary.visible, 1);
  const moving = clampPercent((summary.moving / total) * 100);
  const idle = clampPercent((Math.max(summary.ignitionOn - summary.moving, 0) / total) * 100);
  const off = clampPercent((Math.max(summary.visible - summary.ignitionOn, 0) / total) * 100);
  const movingEnd = moving;
  const idleEnd = moving + idle;
  const offEnd = moving + idle + off;
  const background = `conic-gradient(#16a34a 0 ${movingEnd}%, #f97316 ${movingEnd}% ${idleEnd}%, #64748b ${idleEnd}% ${offEnd}%, #e2e8f0 ${offEnd}% 100%)`;

  return (
    <div className="fleet-donut-wrap">
      <div className="fleet-donut" style={{ background }}>
        <div>
          <strong>{summary.visible}</strong>
          <span>คันออนไลน์</span>
        </div>
      </div>
      <div className="donut-legend">
        <span><i className="green" /> กำลังวิ่ง</span>
        <span><i className="orange" /> ติดเครื่อง</span>
        <span><i className="slate" /> ดับเครื่อง</span>
      </div>
    </div>
  );
}

function OverviewStatusItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "orange" | "slate" | "blue";
}) {
  return (
    <div className={`overview-status-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CronStatusPanel({
  status,
  loading,
  error,
  onRefresh,
}: {
  status?: CronStatusResult["status"];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
}) {
  const health = getCronHealth(status?.status);

  return (
    <div className={`panel cron-status-panel ${health.tone}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Cronjob status</p>
          <h2>การอัพเดทล่าสุด</h2>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="รีเฟรชสถานะ cronjob">
          {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </div>

      <div className="cron-status-main">
        <div className="cron-status-icon">{health.icon}</div>
        <div>
          <strong>{health.title}</strong>
          <span>{error ?? health.detail}</span>
        </div>
      </div>

      <div className="cron-status-grid">
        <MiniStat
          label="บันทึกล่าสุด"
          value={status?.latestAt ? formatRelativeMinutes(status.ageMinutes) : "-"}
          icon={<Clock3 size={18} />}
        />
        <MiniStat
          label="Fuel snapshot"
          value={status?.fuelSnapshot ? `${status.fuelSnapshot.rowCount} คัน` : "-"}
          icon={<Fuel size={18} />}
        />
        <MiniStat
          label="Vehicle snapshot"
          value={status?.vehicleStatusSnapshot ? `${status.vehicleStatusSnapshot.rowCount} คัน` : "-"}
          icon={<Truck size={18} />}
        />
      </div>

      <div className="cron-status-detail">
        <span>
          ล่าสุด: {status?.latestAt ? formatDateTime(status.latestAt) : "ยังไม่มีข้อมูล"}
        </span>
        <span>
          เติมน้ำมันล่าสุด:{" "}
          {status?.latestDetectedRefill
            ? `${status.latestDetectedRefill.registration} +${formatNumber(status.latestDetectedRefill.refilledLiters)} ลิตร`
            : "ยังไม่พบ event เติมจาก sensor"}
        </span>
      </div>
    </div>
  );
}

function InsightItem({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="insight-item">
      <div className="insight-icon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function RealtimeFuelPanel({
  data,
  loading,
  onRefresh,
}: {
  data: ReturnType<typeof buildRealtimeFuel>;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="panel realtime-fuel-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Realtime fuel</p>
          <h2>การใช้น้ำมันแบบ Realtime</h2>
          <span className="panel-subtitle">ข้อมูลสดจาก Cartrack status อัพเดทอัตโนมัติทุก 60 วินาที</span>
        </div>
        <button className="icon-action" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </div>

      <div className="realtime-fuel-summary">
        <MiniStat label="รถที่ใช้งานวันนี้" value={`${data.vehicleCount} คัน`} icon={<Truck size={18} />} />
        <MiniStat label="น้ำมันรวม" value={`${formatNumber(data.totalFuelLiters)} ลิตร`} icon={<Fuel size={18} />} />
        <MiniStat label="เฉลี่ยต่อคัน" value={`${formatNumber(data.averageFuelLiters)} ลิตร`} icon={<Gauge size={18} />} />
        <MiniStat label="ข้อมูลล่าสุด" value={data.latestUpdatedLabel} icon={<Clock3 size={18} />} />
      </div>

      <div className="realtime-fuel-chart">
        {data.rows.length === 0 ? (
          <div className="empty-state">ยังไม่มีรถที่ใช้งานวันนี้พร้อมข้อมูล fuel level สดจาก API</div>
        ) : (
          data.rows.map((row, index) => (
            <div className="realtime-fuel-row" key={`${row.registration}-${index}`}>
              <div>
                <strong>{row.registration}</strong>
                <span>{row.driverName}</span>
              </div>
              <div className="realtime-fuel-track" aria-hidden="true">
                <span className={row.tone} style={{ width: `${Math.max(row.percent, 4)}%` }} />
              </div>
              <b>{formatNumber(row.fuelLiters)} ลิตร</b>
              <small>{row.fuelPercentage === null ? "-" : `${formatNumber(row.fuelPercentage)}%`}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BarChartPanel({
  title,
  eyebrow,
  rows,
  suffix,
  emptyText,
}: {
  title: string;
  eyebrow: string;
  rows: Array<{ label: string; subLabel: string; value: number; percent: number }>;
  suffix: string;
  emptyText: string;
}) {
  return (
    <div className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="bar-chart-list">
        {rows.length === 0 ? (
          <div className="empty-state">{emptyText}</div>
        ) : (
          rows.map((row, index) => (
            <div className="bar-row" key={`${title}-${row.label}-${index}`}>
              <div className="bar-row-head">
                <div>
                  <strong>{row.label}</strong>
                  <span>{row.subLabel}</span>
                </div>
                <b>{formatNumber(row.value)} {suffix}</b>
              </div>
              <div className="bar-track" aria-hidden="true">
                <span style={{ width: `${Math.max(row.percent, 4)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrendChart({
  reports,
}: {
  reports: Array<{ label: string; distanceKm: number; fuelLiters: number; vehicleCount: number }>;
}) {
  const maxDistance = Math.max(...reports.map((report) => report.distanceKm), 1);
  const maxFuel = Math.max(...reports.map((report) => report.fuelLiters), 1);

  return (
    <div className="trend-chart">
      {reports.length === 0 ? (
        <div className="empty-state">ยังไม่มีข้อมูลแนวโน้มจากรายงานย้อนหลัง</div>
      ) : (
        reports.map((report, index) => (
          <div className="trend-column" key={`${report.label}-${index}`}>
            <div className="trend-bars">
              <span
                className="distance"
                style={{ height: `${Math.max((report.distanceKm / maxDistance) * 100, 8)}%` }}
                title={`ระยะทาง ${formatNumber(report.distanceKm)} กม.`}
              />
              <span
                className="fuel"
                style={{ height: `${Math.max((report.fuelLiters / maxFuel) * 100, 8)}%` }}
                title={`น้ำมัน ${formatNumber(report.fuelLiters)} ลิตร`}
              />
            </div>
            <strong>{report.label}</strong>
            <small>{report.vehicleCount} คัน</small>
          </div>
        ))
      )}
    </div>
  );
}

function AuditCard({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone?: "orange" | "red" | "green";
}) {
  return (
    <div className={`audit-card ${tone ?? ""}`}>
      <div className="audit-card-icon">{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function DriverScoreGuide() {
  return (
    <div className="driver-score-guide">
      <div>
        <p className="eyebrow">Score guide</p>
        <h2>อ่านคะแนน Driver Audit อย่างไร</h2>
        <span>
          คะแนนเริ่มจาก 100 แล้วระบบหักคะแนนจากความเสี่ยงที่พบในรายงานและ snapshot เช่น เคสผิดปกติ,
          รถวิ่งแต่ไม่มีคนขับ, วิ่งนอกเวลา, จอดติดเครื่อง, GPS ไม่อัพเดท, fuel sensor ขาด และการใช้น้ำมันผิดปกติ
        </span>
      </div>
      <div className="score-guide-grid">
        <div className="score-guide-item grade-a">
          <strong>90-100 A</strong>
          <span>ปกติหรือมีความเสี่ยงต่ำ เช่น 100 A คือยังไม่พบข้อผิดปกติหลักในข้อมูลชุดนี้</span>
        </div>
        <div className="score-guide-item grade-b">
          <strong>75-89 B</strong>
          <span>มีประเด็นเล็กน้อย ควรติดตามแต่ยังไม่ใช่เคสเร่งด่วน</span>
        </div>
        <div className="score-guide-item grade-c">
          <strong>60-74 C</strong>
          <span>มีความเสี่ยงหลายจุด ต้องตรวจพฤติกรรมและคุณภาพข้อมูลเพิ่มเติม</span>
        </div>
        <div className="score-guide-item grade-d">
          <strong>0-59 D</strong>
          <span>ต้องตรวจทันที เช่น 0 D มักเกิดจากไม่มีข้อมูลคนขับหรือมีเคส/ข้อมูลผิดปกติสะสมจำนวนมาก</span>
        </div>
      </div>
      <div className="score-example-row">
        <span><b>0 D</b> = เสี่ยงสูง/ข้อมูลผิดปกติมาก ต้องตรวจคนขับและทะเบียนที่เกี่ยวข้องก่อน</span>
        <span><b>92 A</b> = โดยรวมดี แต่มีคะแนนถูกหักเล็กน้อย เช่น idling หรือเคสเล็ก</span>
        <span><b>100 A</b> = ไม่พบข้อผิดปกติหลักจากข้อมูลที่ระบบมี</span>
      </div>
    </div>
  );
}

function getDriverGradeLabel(grade: "A" | "B" | "C" | "D") {
  if (grade === "A") return "สถานะดี";
  if (grade === "B") return "ควรติดตาม";
  if (grade === "C") return "ต้องตรวจสอบ";
  return "เร่งตรวจ";
}

function AuditList({
  title,
  rows,
  valueKey,
  suffix,
}: {
  title: string;
  rows: Array<ReportRow & { distanceKm: number | null; fuelUsedLiters: number | null }>;
  valueKey: "distanceKm" | "fuelUsedLiters";
  suffix: string;
}) {
  return (
    <div>
      <h2 className="section-title">{title}</h2>
      <div className="report-list">
        {rows.length === 0 ? (
          <div className="empty-state">ยังไม่มีข้อมูล</div>
        ) : (
          rows.slice(0, 5).map((row, index) => (
            <div className="audit-list-item" key={`${title}-${row.registration}-${index}`}>
              <div className="rank">{index + 1}</div>
              <div>
                <strong>{row.registration}</strong>
                <span>{row.driverName}</span>
              </div>
              <div>
                <span>{valueKey === "distanceKm" ? "ระยะทาง" : "น้ำมัน"}</span>
                <strong>{formatNumber(row[valueKey] ?? 0)} {suffix}</strong>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OvernightFuelLossPanel({
  data,
  loading,
  onRefresh,
  compact = false,
}: {
  data: ReturnType<typeof buildOvernightFuelLossSummary>;
  loading: boolean;
  onRefresh: () => void;
  compact?: boolean;
}) {
  const topCases = data.cases.slice(0, compact ? 3 : 6);

  return (
    <div className={`panel overnight-fuel-panel ${data.count > 0 ? "danger" : "clear"}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Overnight fuel loss</p>
          <h2>น้ำมันหายข้ามคืน</h2>
          <span className="panel-subtitle">เทียบน้ำมันหลังจบรอบกับ snapshot แรกของเช้าวันถัดไป</span>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="รีเฟรชเคสน้ำมันหายข้ามคืน">
          {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </div>

      <div className="overnight-fuel-hero">
        <div>
          <span>รถที่ต้องตรวจ</span>
          <strong>{data.count}</strong>
          <small>{data.count > 0 ? `หายรวม ${formatNumber(data.totalLiters)} ลิตร` : "ยังไม่พบเคสผิดปกติ"}</small>
        </div>
        <div>
          <span>Critical</span>
          <strong>{data.criticalCount}</strong>
          <small>หาย 30 ลิตรขึ้นไป</small>
        </div>
      </div>

      <div className="overnight-fuel-list">
        {topCases.length === 0 ? (
          <div className="empty-state">ยังไม่พบเคสน้ำมันหายข้ามคืนใน Audit ล่าสุด</div>
        ) : (
          topCases.map((item) => (
            <div className="overnight-fuel-item" key={item.id}>
              <div>
                <strong>{item.registration}</strong>
                <span>{item.driverName}</span>
              </div>
              <div>
                <span>ก่อน</span>
                <strong>{formatNullable(item.evidence.fuelBefore ?? null, "ลิตร")}</strong>
              </div>
              <div>
                <span>เช้า</span>
                <strong>{formatNullable(item.evidence.fuelAfter ?? null, "ลิตร")}</strong>
              </div>
              <div className="overnight-loss-value">
                <span>หาย</span>
                <strong>{formatNumber(item.lossLiters)} ลิตร</strong>
              </div>
              <span className={`badge ${item.severity === "critical" ? "danger" : "warning"}`}>{item.severity}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReportFilterBar({
  date,
  search,
  loading,
  searchPlaceholder,
  onDateChange,
  onSearchChange,
  onLoad,
}: {
  date: string;
  search: string;
  loading: boolean;
  searchPlaceholder: string;
  onDateChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onLoad: () => void;
}) {
  return (
    <div className="report-filter-bar">
      <label>
        <span>วันที่</span>
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
      <label className="report-search-field">
        <span>ค้นหา</span>
        <div>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      </label>
      <button className="button secondary" onClick={onLoad} disabled={loading}>
        {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        โหลดข้อมูล
      </button>
    </div>
  );
}

function OvernightFuelLossTable({ cases }: { cases: ReturnType<typeof buildOvernightFuelLossSummary>["cases"] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ทะเบียน</th>
            <th>คนขับ</th>
            <th>หลังจบรอบ</th>
            <th>เช้าวันถัดไป</th>
            <th>หายไป</th>
            <th>Odometer เพิ่ม</th>
            <th>ระดับ</th>
            <th>เวลาที่พบ</th>
            <th>สถานที่</th>
          </tr>
        </thead>
        <tbody>
          {cases.length === 0 ? (
            <tr><td colSpan={9}>ยังไม่พบเคสน้ำมันหายข้ามคืนใน Audit ล่าสุด</td></tr>
          ) : (
            cases.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.registration}</strong></td>
                <td>{item.driverName}</td>
                <td>{formatNullable(item.evidence.fuelBefore ?? null, "ลิตร")}</td>
                <td>{formatNullable(item.evidence.fuelAfter ?? null, "ลิตร")}</td>
                <td><strong>{formatNumber(item.lossLiters)} ลิตร</strong></td>
                <td>{formatNullable(item.evidence.distanceKm ?? null, "กม.")}</td>
                <td><span className={`badge ${item.severity === "critical" ? "danger" : "warning"}`}>{item.severity}</span></td>
                <td>{item.evidence.time ? formatDateTime(item.evidence.time) : "-"}</td>
                <td>{item.evidence.positionDescription ?? "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportDetailHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="report-detail-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <span>{description}</span>
    </div>
  );
}

function getFuelReconcileLabel(status: FuelReconciliation["status"]) {
  if (status === "critical") return "ต่างมาก";
  if (status === "warning") return "ต้องตรวจ";
  if (status === "actual_only") return "มีบิลแต่ sensor ไม่เห็น";
  if (status === "sensor_only") return "sensor เห็นแต่ไม่มีบิล";
  return "ตรงกัน";
}

function getFuelReconcileTone(status: FuelReconciliation["status"]) {
  if (status === "critical" || status === "actual_only") return "danger";
  if (status === "warning" || status === "sensor_only") return "warning";
  return "ok";
}

function filterReportRows(rows: ReportRow[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.registration,
      row.driverName,
      row.reportDate,
      row.firstIgnitionOn,
      row.lastIgnitionOff,
      String(row.distanceKm ?? ""),
      String(row.fuelUsedLiters ?? ""),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function filterReportList(reports: ReportListItem[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return reports;
  }

  return reports.filter((report) =>
    [
      report.window.labelDate,
      report.window.startTimestamp,
      report.window.endTimestamp,
      report.sent ? "ส่งแล้ว sent" : "พรีวิว preview",
      String(report.vehicleCount),
      String(report.fuelAvailableCount),
      String(report.summary.totalDistanceKm),
      String(report.summary.totalFuelLiters),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function filterOvernightCases(cases: ReturnType<typeof buildOvernightFuelLossSummary>["cases"], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return cases;
  }

  return cases.filter((item) =>
    [
      item.registration,
      item.driverName,
      item.severity,
      item.title,
      item.detail,
      item.evidence.positionDescription,
      item.evidence.time,
      String(item.lossLiters),
      String(item.evidence.fuelBefore ?? ""),
      String(item.evidence.fuelAfter ?? ""),
      String(item.evidence.distanceKm ?? ""),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function buildAuditSummary(rows: ReportRow[], fuelToday?: FuelTodayResult) {
  const realRows = rows.filter((row) => row.registration !== "รอข้อมูล");
  const distanceRows = realRows.filter((row) => typeof row.distanceKm === "number");
  const fuelRows = realRows.filter((row) => typeof row.fuelUsedLiters === "number");
  const missingFuelRows = realRows.filter((row) => row.fuelUsedLiters === null);
  const distanceRanking = [...distanceRows].sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
  const fuelRanking = [...fuelRows].sort((a, b) => (b.fuelUsedLiters ?? 0) - (a.fuelUsedLiters ?? 0));
  const distanceLowRanking = [...distanceRows].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  const fuelLowRanking = [...fuelRows].sort((a, b) => (a.fuelUsedLiters ?? 0) - (b.fuelUsedLiters ?? 0));

  return {
    maxDistance: distanceRanking[0],
    minDistance: distanceLowRanking[0],
    maxFuel: fuelRanking[0],
    minFuel: fuelLowRanking[0],
    distanceRanking,
    fuelRanking,
    missingFuelRows,
    refillEvents: fuelToday?.summary?.events ?? [],
    refillCount: fuelToday?.summary?.events.length ?? 0,
    snapshotCount: fuelToday?.summary?.snapshotCount ?? 0,
    totalRefilledLiters: fuelToday?.summary?.totalRefilledLiters ?? 0,
  };
}

function buildOverviewStats(
  rows: ReportRow[],
  reports: ReportListItem[],
  liveSummary: NonNullable<FleetStatusResult["summary"]>,
  fuelToday?: FuelTodayResult,
) {
  const realRows = rows.filter((row) => row.registration !== "รอข้อมูล");
  const distanceRows = realRows.filter((row) => typeof row.distanceKm === "number");
  const fuelRows = realRows.filter((row) => typeof row.fuelUsedLiters === "number");
  const latestReportByDate = new Map<string, ReportListItem>();
  for (const report of reports) {
    if (!latestReportByDate.has(report.window.labelDate)) {
      latestReportByDate.set(report.window.labelDate, report);
    }
  }
  const maxDistance = Math.max(...distanceRows.map((row) => row.distanceKm ?? 0), 1);
  const maxFuel = Math.max(...fuelRows.map((row) => row.fuelUsedLiters ?? 0), 1);
  const reportVehicleCount = realRows.length || liveSummary.visible || fuelToday?.summary?.vehicleCount || 0;
  const fuelVehicleCount = fuelRows.length || fuelToday?.summary?.vehicleCount || 0;
  const missingFuelCount = realRows.filter((row) => row.fuelUsedLiters === null).length;

  return {
    reportVehicleCount,
    totalDistanceKm: distanceRows.reduce((total, row) => total + (row.distanceKm ?? 0), 0),
    totalFuelLiters: fuelRows.reduce((total, row) => total + (row.fuelUsedLiters ?? 0), 0),
    totalRefilledLiters: fuelToday?.summary?.totalRefilledLiters ?? 0,
    refillCount: fuelToday?.summary?.events.length ?? 0,
    snapshotCount: fuelToday?.summary?.snapshotCount ?? 0,
    fuelVehicleCount,
    missingFuelCount,
    fuelCoveragePercent: reportVehicleCount === 0 ? 0 : Math.round((fuelVehicleCount / reportVehicleCount) * 100),
    latestReportsByDate: Array.from(latestReportByDate.values()),
    distanceBars: [...distanceRows]
      .sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0))
      .slice(0, 6)
      .map((row) => ({
        label: row.registration,
        subLabel: row.driverName,
        value: row.distanceKm ?? 0,
        percent: ((row.distanceKm ?? 0) / maxDistance) * 100,
      })),
    fuelBars: [...fuelRows]
      .sort((a, b) => (b.fuelUsedLiters ?? 0) - (a.fuelUsedLiters ?? 0))
      .slice(0, 6)
      .map((row) => ({
        label: row.registration,
        subLabel: row.driverName,
        value: row.fuelUsedLiters ?? 0,
        percent: ((row.fuelUsedLiters ?? 0) / maxFuel) * 100,
      })),
    reportTrend: Array.from(latestReportByDate.values())
      .slice(0, 6)
      .reverse()
      .map((report) => ({
        label: report.window.labelDate,
        distanceKm: report.summary.totalDistanceKm,
        fuelLiters: report.summary.totalFuelLiters,
        vehicleCount: report.vehicleCount,
      })),
  };
}

function buildFuelDashboard(fuelToday?: FuelTodayResult) {
  const vehicles = fuelToday?.summary?.vehicles ?? [];
  const events = fuelToday?.summary?.events ?? [];
  const actualRefills = fuelToday?.summary?.actualRefills ?? [];
  const reconciliation = fuelToday?.summary?.reconciliation ?? [];
  const vehicleCount = vehicles.length;
  const refilledCount = vehicles.filter((vehicle) => vehicle.status === "refilled").length;
  const waitingCount = vehicles.filter((vehicle) => vehicle.status === "waiting").length;
  const noneCount = vehicles.filter((vehicle) => vehicle.status === "none").length;
  const totalLatestFuelLiters = vehicles.reduce((total, vehicle) => total + (vehicle.latestFuelLiters ?? 0), 0);
  const totalActualRefillLiters = fuelToday?.summary?.totalActualRefillLiters ?? actualRefills.reduce((total, item) => total + item.liters, 0);
  const totalSensorIncreaseLiters = fuelToday?.summary?.totalRefilledLiters ?? 0;
  const totalFuelVarianceLiters = fuelToday?.summary?.totalFuelVarianceLiters ?? totalActualRefillLiters - totalSensorIncreaseLiters;
  const maxFuel = Math.max(...vehicles.map((vehicle) => vehicle.latestFuelLiters ?? 0), 1);

  return {
    vehicles,
    events,
    actualRefills,
    reconciliation,
    vehicleCount,
    refilledCount: events.length,
    actualRefillCount: actualRefills.length,
    anomalyCount: reconciliation.filter((item) => item.status === "critical" || item.status === "warning" || item.status === "actual_only" || item.status === "sensor_only").length,
    snapshotCount: fuelToday?.summary?.snapshotCount ?? 0,
    totalRefilledLiters: totalSensorIncreaseLiters,
    totalActualRefillLiters,
    totalFuelVarianceLiters,
    totalLatestFuelLiters,
    statusBars: [
      { label: "เติมแล้ว", value: refilledCount, tone: "ok" },
      { label: "ยังไม่พบการเติม", value: noneCount, tone: "neutral" },
      { label: "รอ snapshot", value: waitingCount, tone: "warning" },
    ].map((item) => ({
      ...item,
      percent: vehicleCount === 0 ? 0 : Math.round((item.value / vehicleCount) * 100),
    })),
    topVehicles: [...vehicles]
      .sort((a, b) => (b.latestFuelLiters ?? 0) - (a.latestFuelLiters ?? 0))
      .slice(0, 6)
      .map((vehicle) => ({
        ...vehicle,
        percent: ((vehicle.latestFuelLiters ?? 0) / maxFuel) * 100,
      })),
  };
}

function buildOvernightFuelLossSummary(cases: DriverAuditCase[]) {
  const overnightCases = cases
    .filter((item) => item.type === "overnight_fuel_loss")
    .map((item) => ({
      ...item,
      lossLiters: Math.max(
        item.evidence.fuelLiters ?? 0,
        typeof item.evidence.fuelBefore === "number" && typeof item.evidence.fuelAfter === "number"
          ? item.evidence.fuelBefore - item.evidence.fuelAfter
          : 0,
      ),
    }))
    .sort((a, b) => b.lossLiters - a.lossLiters);

  return {
    cases: overnightCases,
    count: overnightCases.length,
    criticalCount: overnightCases.filter((item) => item.severity === "critical").length,
    totalLiters: overnightCases.reduce((total, item) => total + item.lossLiters, 0),
  };
}

function buildRealtimeFuel(rows: FleetStatusRow[], reportRows: ReportRow[], labelDate: string) {
  const activeRegistrations = new Set(
    reportRows
      .filter(isActiveReportRow)
      .map((row) => normalizeRegistration(row.registration)),
  );
  const hasReportActivity = activeRegistrations.size > 0;
  const byRegistration = new Map<string, {
    registration: string;
    driverName: string;
    fuelLiters: number;
    fuelPercentage: number | null;
    updatedAt: string | null | undefined;
  }>();
  rows
    .filter((row) =>
      typeof row.fuelLevel === "number" &&
      (hasReportActivity
        ? activeRegistrations.has(normalizeRegistration(row.registration))
        : isActiveLiveRowForDate(row, labelDate))
    )
    .forEach((row) => {
      const updatedAt = row.fuelUpdated ?? row.locationUpdated ?? row.eventTs;
      const current = byRegistration.get(row.registration);
      const currentTime = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
      const nextTime = updatedAt ? new Date(updatedAt).getTime() : 0;
      if (!current || nextTime >= currentTime) {
        byRegistration.set(row.registration, {
          registration: row.registration,
          driverName: row.driverName && row.driverName !== "-" ? row.driverName : "ไม่พบข้อมูลคนขับ",
          fuelLiters: row.fuelLevel ?? 0,
          fuelPercentage: row.fuelPercentage,
          updatedAt,
        });
      }
    });
  const fuelRows = Array.from(byRegistration.values());
  const maxFuel = Math.max(...fuelRows.map((row) => row.fuelLiters), 1);
  const latestUpdated = fuelRows
    .map((row) => (row.updatedAt ? new Date(row.updatedAt).getTime() : 0))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  return {
    vehicleCount: fuelRows.length,
    totalFuelLiters: fuelRows.reduce((total, row) => total + row.fuelLiters, 0),
    averageFuelLiters: average(fuelRows.map((row) => row.fuelLiters)),
    latestUpdatedLabel: latestUpdated ? formatDateTime(new Date(latestUpdated).toISOString()) : "-",
    rows: fuelRows
      .sort((a, b) => b.fuelLiters - a.fuelLiters)
      .slice(0, 10)
      .map((row) => {
        const percent = row.fuelPercentage ?? (row.fuelLiters / maxFuel) * 100;
        return {
          ...row,
          percent: clampPercent(percent),
          tone: percent < 20 ? "low" : percent < 45 ? "mid" : "good",
        };
      }),
  };
}

function isActiveLiveRowForDate(row: FleetStatusRow, labelDate: string) {
  const updatedAt = row.locationUpdated ?? row.eventTs ?? row.fuelUpdated;
  return getBangkokDateLabel(updatedAt) === labelDate && ((row.speed ?? 0) > 0 || row.ignition === true);
}

function isActiveReportRow(row: ReportRow) {
  if (row.registration === "รอข้อมูล") {
    return false;
  }
  if ((row.distanceKm ?? 0) > 0) {
    return true;
  }
  return hasReportTime(row.firstIgnitionOn) || hasReportTime(row.lastIgnitionOff);
}

function hasReportTime(value: string | null) {
  return Boolean(value && value !== "-");
}

function normalizeRegistration(value: string) {
  return value.trim().toUpperCase();
}

function getBangkokDateLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) {
    return 0;
  }
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function formatFuelEfficiency(row: ReportRow) {
  if (!row.distanceKm || !row.fuelUsedLiters || row.distanceKm <= 0) {
    return "-";
  }
  return `${formatNumber((row.fuelUsedLiters / row.distanceKm) * 100)} ลิตร`;
}

function getDistanceAuditNote(row: ReportRow, max?: ReportRow, min?: ReportRow) {
  if (max?.registration === row.registration) {
    return "วิ่งมากสุด ควรเทียบกับงานที่ได้รับ";
  }
  if (min?.registration === row.registration) {
    return "วิ่งน้อยสุด ตรวจว่ามีงานน้อยหรือจอดนาน";
  }
  if ((row.distanceKm ?? 0) === 0) {
    return "ไม่มีระยะทาง ตรวจสถานะงาน/อุปกรณ์";
  }
  return "ปกติ";
}

function getFuelAuditNote(row: ReportRow, max?: ReportRow, min?: ReportRow) {
  if (max?.registration === row.registration) {
    return "ใช้น้ำมันสูงสุด ควรเทียบระยะทางและพฤติกรรมขับ";
  }
  if (min?.registration === row.registration) {
    return "ใช้น้ำมันต่ำสุด ตรวจว่าใช้งานจริงหรือข้อมูล sensor";
  }
  return "มีข้อมูลตรวจสอบได้";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function getLatestFleetUpdateLabel(rows: FleetStatusRow[]) {
  let latestTime = 0;
  let fallback: string | null = null;

  rows.forEach((row) => {
    const value = row.locationUpdated ?? row.eventTs ?? row.fuelUpdated;
    if (!value) {
      return;
    }
    fallback ??= value;
    const time = new Date(value).getTime();
    if (Number.isFinite(time) && time > latestTime) {
      latestTime = time;
    }
  });

  if (latestTime > 0) {
    return formatDateTime(new Date(latestTime).toISOString());
  }
  return fallback ?? "-";
}

function formatRelativeMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (value <= 0) {
    return "เมื่อสักครู่";
  }
  if (value < 60) {
    return `${value} นาทีที่แล้ว`;
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes === 0 ? `${hours} ชม.ที่แล้ว` : `${hours} ชม. ${minutes} นาที`;
}

function formatNullable(value: number | null, suffix: string) {
  return value === null ? "-" : `${formatNumber(value)} ${suffix}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 100);
}

function getIgnitionLabel(value: boolean | null) {
  if (value === true) {
    return "ติดเครื่อง";
  }
  if (value === false) {
    return "ดับเครื่อง";
  }
  return "ไม่ทราบ";
}

function getLiveStatusClass(row: FleetStatusRow) {
  if (row.ignition === true && row.idling === false) {
    return "moving";
  }
  if (row.ignition === true) {
    return "idle";
  }
  return "off";
}

function getLiveStatusLabel(row: FleetStatusRow) {
  if (row.ignition === true && row.idling === false) {
    return "กำลังวิ่ง";
  }
  if (row.ignition === true) {
    return "ติดเครื่อง";
  }
  if (row.ignition === false) {
    return "ดับเครื่อง";
  }
  return "ไม่ทราบ";
}

function getHealth(status: RunState["status"]) {
  if (status === "error") {
    return {
      kind: "bad",
      title: "Needs attention",
      detail: "Cartrack ยังไม่ผ่าน authentication",
      icon: <AlertCircle size={20} aria-hidden="true" />,
    };
  }

  if (status === "sent") {
    return {
      kind: "good",
      title: "Telegram sent",
      detail: "รายงานล่าสุดถูกส่งแล้ว",
      icon: <CheckCircle2 size={20} aria-hidden="true" />,
    };
  }

  if (status === "ready") {
    return {
      kind: "good",
      title: "Preview ready",
      detail: "ตรวจสอบข้อมูลก่อนส่งได้",
      icon: <ShieldCheck size={20} aria-hidden="true" />,
    };
  }

  return {
    kind: "neutral",
    title: "Ready to run",
    detail: "กดพรีวิวเพื่อดึงข้อมูลสด",
    icon: <ShieldCheck size={20} aria-hidden="true" />,
  };
}

function getCronHealth(status: NonNullable<CronStatusResult["status"]>["status"] | undefined) {
  if (status === "healthy") {
    return {
      tone: "healthy",
      title: "Cronjob ทำงานปกติ",
      detail: "มี snapshot ใหม่ในช่วงไม่กี่นาทีล่าสุด",
      icon: <CheckCircle2 size={22} aria-hidden="true" />,
    };
  }
  if (status === "warning") {
    return {
      tone: "warning",
      title: "Cronjob เริ่มช้า",
      detail: "snapshot ล่าสุดเกิน 3 นาที ควรติดตาม",
      icon: <Clock3 size={22} aria-hidden="true" />,
    };
  }
  if (status === "stale") {
    return {
      tone: "stale",
      title: "Cronjob ค้าง",
      detail: "snapshot ล่าสุดเกิน 10 นาที ควรตรวจ server log",
      icon: <AlertCircle size={22} aria-hidden="true" />,
    };
  }
  return {
    tone: "empty",
    title: "ยังไม่มี snapshot",
    detail: "ยังไม่พบข้อมูลจาก cronjob",
    icon: <Database size={22} aria-hidden="true" />,
  };
}
