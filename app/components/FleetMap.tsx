"use client";

import { LocateFixed, MapPin, Navigation, Search, Truck, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DivIcon, LatLngBoundsExpression, Map as LeafletMap, Marker } from "leaflet";

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
  fuelTotalConsumed?: number | null;
  fuelUpdated?: string | null;
  gpsFixType?: number | null;
  odometerKm: number | null;
};

type FleetMapProps = {
  rows: FleetStatusRow[];
  loading: boolean;
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

export function FleetMap({ rows, loading, selectedKey, onSelect }: FleetMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function setup() {
      if (!mapNodeRef.current || mapRef.current) {
        return;
      }

      const L = await import("leaflet");
      if (disposed || !mapNodeRef.current) {
        return;
      }

      const map = L.map(mapNodeRef.current, {
        zoomControl: false,
      }).setView([19.166, 99.9], 11);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setLeafletReady(true);
    }

    void setup();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapRef.current) {
      return;
    }

    let disposed = false;

    async function renderMarkers() {
      const L = await import("leaflet");
      if (disposed || !mapRef.current) {
        return;
      }

      const map = mapRef.current;
      const markers = markersRef.current;
      const activeKeys = new Set(rows.map((row) => row.key));

      for (const [key, marker] of markers.entries()) {
        if (!activeKeys.has(key)) {
          marker.remove();
          markers.delete(key);
        }
      }

      for (const row of rows) {
        const marker = markers.get(row.key);
        const icon = createVehicleIcon(L, row, selectedKey === row.key);
        const popup = [
          `<strong>${escapeHtml(row.registration)}</strong>`,
          `คนขับ: ${escapeHtml(row.driverName)}`,
          `ความเร็ว: ${row.speed ?? 0} กม./ชม.`,
          escapeHtml(row.positionDescription),
        ].join("<br/>");

        if (marker) {
          marker.setLatLng([row.latitude, row.longitude]);
          marker.setIcon(icon);
          marker.bindPopup(popup);
        } else {
          const nextMarker = L.marker([row.latitude, row.longitude], { icon }).addTo(map);
          nextMarker.bindPopup(popup);
          nextMarker.on("click", () => onSelect(row.key));
          markers.set(row.key, nextMarker);
        }
      }

      if (rows.length > 0) {
        const bounds = rows.map((row) => [row.latitude, row.longitude]) as LatLngBoundsExpression;
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
      }
    }

    void renderMarkers();

    return () => {
      disposed = true;
    };
  }, [leafletReady, rows, selectedKey, onSelect]);

  useEffect(() => {
    if (!selectedKey || !mapRef.current) {
      return;
    }

    const row = rows.find((item) => item.key === selectedKey);
    const marker = markersRef.current.get(selectedKey);
    if (row) {
      mapRef.current.setView([row.latitude, row.longitude], 15, { animate: true });
      marker?.openPopup();
    }
  }, [rows, selectedKey]);

  return (
    <div className="map-stage">
      <div ref={mapNodeRef} className="map-canvas" />
      {loading ? (
        <div className="map-loading">
          <LocateFixed size={18} />
          กำลังโหลดตำแหน่งรถ...
        </div>
      ) : null}
    </div>
  );
}

export function FleetMapPanel({
  rows,
  loading,
  error,
}: {
  rows: FleetStatusRow[];
  loading: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return rows;
    }

    return rows.filter((row) =>
      [row.registration, row.driverName, row.positionDescription]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, rows]);
  const selectedRow =
    rows.find((row) => row.key === selectedKey) ?? filteredRows[0] ?? rows[0] ?? null;

  useEffect(() => {
    if (!selectedKey && filteredRows[0]) {
      setSelectedKey(filteredRows[0].key);
    }
  }, [filteredRows, selectedKey]);

  return (
    <section className="map-shell" id="map">
      <div className="map-sidebar">
        <div className="map-search">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาทะเบียน คนขับ หรือสถานที่"
          />
        </div>

        <div className="map-stats">
          <div>
            <strong>{rows.length}</strong>
            <span>ยานพาหนะ</span>
          </div>
          <div>
            <strong>{rows.filter((row) => row.ignition === true).length}</strong>
            <span>ติดเครื่อง</span>
          </div>
          <div>
            <strong>{rows.filter((row) => row.driverName !== "-").length}</strong>
            <span>มีคนขับ</span>
          </div>
        </div>

        {error ? <div className="map-error">{error}</div> : null}

        <div className="vehicle-list">
          {filteredRows.map((row) => (
            <button
              key={row.key}
              className={`vehicle-item ${selectedRow?.key === row.key ? "selected" : ""}`}
              onClick={() => setSelectedKey(row.key)}
            >
              <span className={`vehicle-dot ${getStatusClass(row)}`}>
                <Truck size={16} aria-hidden="true" />
              </span>
              <span className="vehicle-copy">
                <strong>{row.registration}</strong>
                <small>
                  <UserRound size={13} aria-hidden="true" />
                  {row.driverName}
                </small>
              </span>
              <span className="vehicle-speed">{row.speed ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="map-main">
        <FleetMap
          rows={filteredRows}
          loading={loading}
          selectedKey={selectedRow?.key ?? null}
          onSelect={setSelectedKey}
        />
        {selectedRow ? (
          <div className="map-detail">
            <div>
              <span>Selected vehicle</span>
              <strong>{selectedRow.registration}</strong>
            </div>
            <div>
              <span>Driver</span>
              <strong>{selectedRow.driverName}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{getStatusLabel(selectedRow)}</strong>
            </div>
            <div>
              <span>Speed</span>
              <strong>{selectedRow.speed ?? 0} กม./ชม.</strong>
            </div>
            <div className="wide">
              <MapPin size={15} aria-hidden="true" />
              {selectedRow.positionDescription}
            </div>
            <div className="wide">
              <Navigation size={15} aria-hidden="true" />
              {selectedRow.locationUpdated ?? selectedRow.eventTs ?? "-"}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function createVehicleIcon(
  L: typeof import("leaflet"),
  row: FleetStatusRow,
  selected: boolean,
): DivIcon {
  const statusClass = getStatusClass(row);
  return L.divIcon({
    className: "",
    html: `<div class="map-marker ${statusClass} ${selected ? "selected" : ""}"><span>${escapeHtml(row.registration)}</span><div class="marker-symbol"></div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -20],
  });
}

function getStatusClass(row: FleetStatusRow) {
  if (row.ignition === true && row.idling === false) {
    return "moving";
  }
  if (row.ignition === true) {
    return "idle";
  }
  return "off";
}

function getStatusLabel(row: FleetStatusRow) {
  if (row.ignition === true && row.idling === false) {
    return "กำลังวิ่ง";
  }
  if (row.ignition === true) {
    return "ติดเครื่อง";
  }
  if (row.ignition === false) {
    return "ดับเครื่อง";
  }
  return "ไม่ทราบสถานะ";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}
