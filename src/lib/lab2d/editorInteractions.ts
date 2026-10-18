import type { Vec2 } from "@/lib/geometry/types";
import { dist, uid, type Entity } from "./core";
import { pruneGroups, type GroupDef } from "./groups";

export type ChamferClipboard = {
  entities: Entity[];
  anchor: Vec2;
  groups: GroupDef[];
};

const clone = <T>(value: T): T => structuredClone(value);

export function finishPolylinePoints(points: Vec2[], close = false): Vec2[] {
  if (points.length < 2) return [];
  const next = points.slice();
  while (next.length > 2 && dist(next[next.length - 1]!, next[next.length - 2]!) < 1e-6) next.pop();
  if (close && next.length > 2 && dist(next[0]!, next[next.length - 1]!) < 1e-6) next.pop();
  return next;
}

export function shouldClosePolyline(points: Vec2[], point: Vec2, tolerance: number): boolean {
  return points.length > 2 && dist(points[0]!, point) <= tolerance;
}

export function copySelection(
  entities: Entity[],
  selectedIds: string[],
  groups: GroupDef[] = [],
): ChamferClipboard | null {
  const selected = entities.filter((entity) => selectedIds.includes(entity.id));
  if (!selected.length) return null;
  const points = selected.flatMap((entity) => {
    if (entity.type === "line")
      return [
        { x: entity.x1, y: entity.y1 },
        { x: entity.x2, y: entity.y2 },
      ];
    if (entity.type === "polyline") return entity.pts;
    if (entity.type === "circle" || entity.type === "arc") return [{ x: entity.cx, y: entity.cy }];
    if (entity.type === "path") return [entity.start];
    if (entity.type === "ellipse") return [{ x: entity.cx, y: entity.cy }];
    if (entity.type === "point") return [{ x: entity.x, y: entity.y }];
    return [{ x: 0, y: 0 }];
  });
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const groupIds = new Set(selected.map((entity) => entity.group).filter(Boolean));
  return {
    entities: clone(selected),
    anchor: { x: minX, y: minY },
    groups: clone(groups.filter((group) => groupIds.has(group.id))),
  };
}

export function pasteClipboard(
  clipboard: ChamferClipboard,
  target: Vec2,
): { entities: Entity[]; ids: string[]; groups: GroupDef[] } {
  const dx = target.x - clipboard.anchor.x;
  const dy = target.y - clipboard.anchor.y;
  const groupIds = new Map<string, string>();
  const entities = clipboard.entities.map((entity) => {
    const group = entity.group
      ? (groupIds.get(entity.group) ??
        (() => {
          const next = uid();
          groupIds.set(entity.group as string, next);
          return next;
        })())
      : undefined;
    const base = { ...clone(entity), id: uid(), ...(group ? { group } : {}) };
    if (!group && "group" in base) delete base.group;
    if (base.type === "line")
      return { ...base, x1: base.x1 + dx, y1: base.y1 + dy, x2: base.x2 + dx, y2: base.y2 + dy };
    if (base.type === "polyline")
      return { ...base, pts: base.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    if (base.type === "circle" || base.type === "arc")
      return { ...base, cx: base.cx + dx, cy: base.cy + dy };
    if (base.type === "path") {
      return {
        ...base,
        start: { x: base.start.x + dx, y: base.start.y + dy },
        segs: base.segs.map((seg) =>
          seg.line
            ? { ...seg, p: { x: seg.p.x + dx, y: seg.p.y + dy } }
            : {
                ...seg,
                p: { x: seg.p.x + dx, y: seg.p.y + dy },
                c1: { x: seg.c1.x + dx, y: seg.c1.y + dy },
                c2: { x: seg.c2.x + dx, y: seg.c2.y + dy },
              },
        ),
      };
    }
    if (base.type === "ellipse") {
      return { ...base, cx: base.cx + dx, cy: base.cy + dy };
    }
    if (base.type === "point") {
      return { ...base, x: base.x + dx, y: base.y + dy };
    }
    return base;
  });
  const groups = [...groupIds].map(([oldId, id]) => ({
    id,
    name: clipboard.groups.find((group) => group.id === oldId)?.name ?? "Grupo copiado",
  }));
  return { entities, ids: entities.map((entity) => entity.id), groups };
}

export function removeEntityOnly(
  entities: Entity[],
  groups: GroupDef[],
  entityId: string,
): { entities: Entity[]; groups: GroupDef[] } {
  const next = entities.filter((entity) => entity.id !== entityId);
  return { entities: next, groups: pruneGroups(next, groups) };
}
