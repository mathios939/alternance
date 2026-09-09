"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Map, { Layer, NavigationControl, Popup, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import type { LayerProps } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Briefcase, Building2, Loader2, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_FAMILIES, JOB_FAMILY_KEYS, SECTORS, SECTOR_KEYS } from "@/config/taxonomy";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/error-state";

type Feature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { id: string; slug: string; title: string; company: string; city: string; score: number | null; level: string | null; jobs?: number; isDemo: boolean } };
type Collection = { type: "FeatureCollection"; features: Feature[] };

const OSM_STYLE = {
  version: 8 as const,
  sources: { osm: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

const clusterLayer: LayerProps = { id: "clusters", type: "circle", source: "points", filter: ["has", "point_count"], paint: { "circle-color": ["step", ["get", "point_count"], "#6d5dfc", 10, "#5b4bd6", 30, "#4838b3"], "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30], "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } };
const clusterCountLayer: LayerProps = { id: "cluster-count", type: "symbol", source: "points", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#ffffff" } };
const pointLayer: LayerProps = { id: "unclustered", type: "circle", source: "points", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["case", [">=", ["coalesce", ["get", "score"], 0], 85], "#16a34a", [">=", ["coalesce", ["get", "score"], 0], 70], "#6d5dfc", [">=", ["coalesce", ["get", "score"], 0], 1], "#f59e0b", "#64748b"], "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } };

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
const noopSubscribe = () => () => {};

type Props = { center: { lat: number; lng: number }; zoom?: number; mapStyleUrl?: string | null; hasProfile: boolean };

export function OpportunityMap({ center, zoom = 10, mapStyleUrl, hasProfile }: Props) {
  const [mode, setMode] = useState<"jobs" | "companies">("jobs");
  const [family, setFamily] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [state, setState] = useState<{ key: string; data: Collection | null; error: string | null } | null>(null);
  const [popup, setPopup] = useState<Feature | null>(null);
  const webgl = useSyncExternalStore(noopSubscribe, detectWebgl, () => true);
  const mapRef = useRef<MapRef>(null);
  const key = `${mode}|${family}|${sector}`;

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ type: mode });
    if (family !== "all") params.set("family", family);
    if (sector !== "all") params.set("sector", sector);
    fetch(`/api/map?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Impossible de charger les points.");
        return (await r.json()) as Collection;
      })
      .then((d) => setState({ key, data: d, error: null }))
      .catch((e: Error) => e.name !== "AbortError" && setState({ key, data: null, error: e.message }));
    return () => ctrl.abort();
  }, [mode, family, sector, key]);

  const data = state?.data ?? null;
  const error = state?.key === key ? state.error : null;
  const loading = state?.key !== key;

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setPopup(null);
      return;
    }
    if (feature.properties && "cluster_id" in feature.properties) {
      const map = mapRef.current?.getMap();
      const source = map?.getSource("points") as { getClusterExpansionZoom?: (id: number) => Promise<number> } | undefined;
      const clusterId = Number(feature.properties["cluster_id"]);
      void source?.getClusterExpansionZoom?.(clusterId).then((z) => {
        const [lng, lat] = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates;
        map?.easeTo({ center: [lng, lat], zoom: z });
      });
      return;
    }
    setPopup({ type: "Feature", geometry: feature.geometry as Feature["geometry"], properties: feature.properties as Feature["properties"] });
  }, []);

  const style = useMemo(() => mapStyleUrl || OSM_STYLE, [mapStyleUrl]);
  const count = data?.features.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Type de points">
          {(["jobs", "companies"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setPopup(null); }} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {m === "jobs" ? <Briefcase className="size-4" aria-hidden /> : <Building2 className="size-4" aria-hidden />} {m === "jobs" ? "Offres" : "Entreprises"}
            </button>
          ))}
        </div>
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger size="sm" className="w-56" aria-label="Métier"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous les métiers</SelectItem>{JOB_FAMILY_KEYS.map((k) => <SelectItem key={k} value={k}>{JOB_FAMILIES[k].label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger size="sm" className="w-56" aria-label="Secteur"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous les secteurs</SelectItem>{SECTOR_KEYS.map((k) => <SelectItem key={k} value={k}>{SECTORS[k].emoji} {SECTORS[k].label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {count} point{count > 1 ? "s" : ""}
          {hasProfile ? <span className="hidden sm:inline"> · vert ≥ 85 % · violet ≥ 70 % · orange &lt; 70 %</span> : null}
        </span>
      </div>
      {error ? (
        <ErrorState description={error} />
      ) : !webgl ? (
        <div className="surface p-6">
          <p className="inline-flex items-center gap-2 font-medium"><MapPinned className="size-5 text-muted-foreground" aria-hidden /> Carte indisponible sur cet appareil (WebGL désactivé)</p>
          <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto text-sm">
            {data?.features.slice(0, 100).map((f) => (
              <li key={f.properties.id}><Link href={mode === "jobs" ? `/jobs/${f.properties.slug}` : `/companies/${f.properties.slug}`} className="hover:underline">{f.properties.title}</Link> <span className="text-muted-foreground">· {f.properties.city}{f.properties.score !== null ? ` · ${f.properties.score} %` : ""}</span></li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="surface h-[min(70vh,640px)] overflow-hidden">
          <Map ref={mapRef} initialViewState={{ latitude: center.lat, longitude: center.lng, zoom }} mapStyle={style} interactiveLayerIds={["clusters", "unclustered"]} onClick={onClick} style={{ width: "100%", height: "100%" }}>
            <NavigationControl position="top-right" />
            {data ? (
              <Source id="points" type="geojson" data={data} cluster clusterMaxZoom={13} clusterRadius={48}>
                <Layer {...clusterLayer} />
                <Layer {...clusterCountLayer} />
                <Layer {...pointLayer} />
              </Source>
            ) : null}
            {popup ? (
              <Popup longitude={popup.geometry.coordinates[0]} latitude={popup.geometry.coordinates[1]} anchor="bottom" onClose={() => setPopup(null)} closeButton={false} maxWidth="280px">
                <div className="p-3 text-sm">
                  <p className="font-semibold">{popup.properties.title}</p>
                  <p className="text-xs text-muted-foreground">{mode === "jobs" ? popup.properties.company : popup.properties.city}{popup.properties.score !== null ? ` · ${popup.properties.score} %` : ""}{popup.properties.jobs ? ` · ${popup.properties.jobs} offre${popup.properties.jobs > 1 ? "s" : ""}` : ""}{popup.properties.isDemo ? " · démo" : ""}</p>
                  <Button asChild size="sm" className="mt-2 w-full"><Link href={mode === "jobs" ? `/jobs/${popup.properties.slug}` : `/companies/${popup.properties.slug}`}>Ouvrir</Link></Button>
                </div>
              </Popup>
            ) : null}
          </Map>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Fond de carte : {mapStyleUrl ? "style personnalisé (MapLibre)" : "OpenStreetMap"}. Les positions des offres sont celles des sites indiqués ; les temps de trajet sont estimés sur chaque fiche.</p>
    </div>
  );
}
