"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { APPLICATION_STATUSES, APPLICATION_STATUS_KEYS } from "@/config/taxonomy";
import type { ApplicationCardData, BoardData } from "@/features/applications/types";
import { canTransition } from "@/features/applications/lib/status-machine";
import { cn } from "@/lib/utils";
import { updateApplicationStatus } from "@/features/applications/server/actions";
import { ApplicationCard } from "./application-card";
import { ApplicationSheet } from "./application-sheet";

const TONE_BAR: Record<string, string> = { muted: "bg-muted-foreground/40", info: "bg-info", soft: "bg-primary", warning: "bg-warning", success: "bg-success", destructive: "bg-destructive" };

function SortableCard({ app, onOpen }: { app: ApplicationCardData; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id, data: { status: app.status } });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <ApplicationCard app={app} onOpen={onOpen} handleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>} />
    </div>
  );
}

function Column({ status, items, onOpen, activeStatus }: { status: ApplicationStatus; items: ApplicationCardData[]; onOpen: (id: string) => void; activeStatus: ApplicationStatus | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = APPLICATION_STATUSES[status];
  const allowed = activeStatus ? canTransition(activeStatus, status) : true;
  return (
    <section ref={setNodeRef} aria-label={meta.label} className={cn("flex w-[272px] shrink-0 snap-start flex-col rounded-2xl border bg-muted/40 transition-colors", isOver && allowed && "border-primary bg-primary-soft/40", activeStatus && !allowed && "opacity-50")}>
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn("size-2 rounded-full", TONE_BAR[meta.tone])} aria-hidden />
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </header>
      <p className="px-3 pb-2 text-[11px] text-muted-foreground">{meta.hint}</p>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
          {items.map((app) => (
            <SortableCard key={app.id} app={app} onOpen={onOpen} />
          ))}
          {items.length === 0 ? <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">Déposer ici</div> : null}
        </div>
      </SortableContext>
    </section>
  );
}

export function ApplicationKanban({ board }: { board: BoardData }) {
  const router = useRouter();
  const [columns, setColumns] = useState(board.columns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useQueryState("application", parseAsString);
  useEffect(() => setColumns(board.columns), [board.columns]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const all = useMemo(() => Object.values(columns).flat(), [columns]);
  const active = activeId ? all.find((a) => a.id === activeId) ?? null : null;

  function findColumn(id: string): ApplicationStatus | null {
    if ((APPLICATION_STATUS_KEYS as string[]).includes(id)) return id as ApplicationStatus;
    for (const status of APPLICATION_STATUS_KEYS) if (columns[status].some((a) => a.id === id)) return status;
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over) return;
    const from = findColumn(String(a.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    if (!canTransition(from, to)) return;
    setColumns((prev) => {
      const item = prev[from].find((x) => x.id === a.id);
      if (!item) return prev;
      const fromItems = prev[from].filter((x) => x.id !== a.id);
      const overIndex = prev[to].findIndex((x) => x.id === over.id);
      const toItems = [...prev[to]];
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, { ...item, status: to });
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    setActiveId(null);
    if (!over) return;
    const original = board.columns;
    const originalStatus = (Object.keys(original) as ApplicationStatus[]).find((s) => original[s].some((x) => x.id === a.id));
    const to = findColumn(String(over.id));
    if (!to || !originalStatus) return;
    if (!canTransition(originalStatus, to)) {
      toast.error(`Passage « ${APPLICATION_STATUSES[originalStatus].label} » → « ${APPLICATION_STATUSES[to].label} » non autorisé.`);
      setColumns(original);
      return;
    }
    // Réordonner dans la colonne cible
    let position = 0;
    setColumns((prev) => {
      const list = prev[to];
      const oldIndex = list.findIndex((x) => x.id === a.id);
      const newIndex = list.findIndex((x) => x.id === over.id);
      const next = oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex ? arrayMove(list, oldIndex, newIndex) : list;
      position = Math.max(0, next.findIndex((x) => x.id === a.id));
      return { ...prev, [to]: next };
    });
    if (originalStatus === to && !over) return;
    startTransition(async () => {
      const r = await updateApplicationStatus({ applicationId: String(a.id), status: to, position });
      if (!r.ok) {
        toast.error(r.error);
        setColumns(original);
        return;
      }
      if (originalStatus !== to) toast.success(`Déplacée vers « ${APPLICATION_STATUSES[to].label} »`);
      router.refresh();
    });
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setColumns(board.columns); }}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:px-6" role="list" aria-label="Colonnes du suivi">
          {APPLICATION_STATUS_KEYS.map((status) => (
            <Column key={status} status={status} items={columns[status]} onOpen={(id) => void setSelected(id)} activeStatus={active?.status ?? null} />
          ))}
        </div>
        <DragOverlay>{active ? <ApplicationCard app={active} onOpen={() => {}} dragging /> : null}</DragOverlay>
      </DndContext>
      <ApplicationSheet applicationId={selected} onClose={() => void setSelected(null)} />
    </>
  );
}
