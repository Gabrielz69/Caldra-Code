import { describe, it, expect } from "vitest";
import { type Entity, translate } from "./core";
import { unprojectPointFromIsoPlane, unprojectEntityFromIso, type IsoPlane } from "./isometricEngine";
import { findSmartSnap } from "./cadReferenceSnaps";

describe("Deterministic Entity Dragging Pipeline (CHAMFER)", () => {
  it("computes world coordinates correctly with camera pan and zoom", () => {
    const canvasRect = { left: 100, top: 50 };
    const pan = { tx: 40, ty: 20 };
    const zoom = 2.5;

    const clientPos = { clientX: 250, clientY: 170 };
    const worldX = (clientPos.clientX - canvasRect.left - pan.tx) / zoom;
    const worldY = (clientPos.clientY - canvasRect.top - pan.ty) / zoom;

    // (250 - 100 - 40) / 2.5 = 110 / 2.5 = 44
    // (170 - 50 - 20) / 2.5 = 100 / 2.5 = 40
    expect(worldX).toBeCloseTo(44, 4);
    expect(worldY).toBeCloseTo(40, 4);
  });

  it("preserves snapshot immutability across multiple drag frames (no snowball drift)", () => {
    const initialEntity: Entity = {
      id: "line-1",
      layer: "corte",
      type: "line",
      x1: 10,
      y1: 20,
      x2: 60,
      y2: 20,
    };

    // Snapshot inicial imutável
    const snapshot: Entity = { ...initialEntity };

    const startWorld = { x: 10, y: 20 };

    // Simula 3 frames de movimento com dedos
    const frameMovements = [
      { currentWorld: { x: 15, y: 22 } }, // delta +5, +2
      { currentWorld: { x: 22, y: 26 } }, // delta +12, +6
      { currentWorld: { x: 30, y: 35 } }, // delta +20, +15
    ];

    let currentEntity = initialEntity;

    frameMovements.forEach(({ currentWorld }) => {
      const totalDeltaX = currentWorld.x - startWorld.x;
      const totalDeltaY = currentWorld.y - startWorld.y;

      // REGRA DE OURO: estritamente calculado a partir do snapshot
      currentEntity = translate(snapshot, totalDeltaX, totalDeltaY);

      // Snapshot NUNCA deve ser alterado
      expect(snapshot.type === "line" && snapshot.x1).toBe(10);
      expect(snapshot.type === "line" && snapshot.y1).toBe(20);
    });

    // Posição final deve corresponder ao delta acumulado exato (30-10, 35-20) = (+20, +15)
    expect(currentEntity.type === "line" && currentEntity.x1).toBe(30);
    expect(currentEntity.type === "line" && currentEntity.y1).toBe(35);
    expect(currentEntity.type === "line" && currentEntity.x2).toBe(80);
    expect(currentEntity.type === "line" && currentEntity.y2).toBe(35);
  });

  it("updates canonical2D coordinates using inverse isometric matrix when dragging in isometric mode", () => {
    const origCan: Entity = {
      id: "rect-1",
      layer: "corte",
      type: "polyline",
      pts: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 30 },
        { x: 0, y: 30 },
      ],
      closed: true,
    };

    const isoEntity: Entity = {
      id: "rect-1-iso",
      layer: "corte",
      type: "polyline",
      pts: [
        { x: 100, y: 100 },
        { x: 143.3, y: 125 },
        { x: 117.3, y: 140 },
        { x: 74, y: 115 },
      ],
      closed: true,
      params: {
        isIsoSolidFace: true,
        isoPlane: "top",
        canonical2D: origCan,
      },
    };

    const deltaIso = { x: 20, y: 10 };
    const entPlane = (isoEntity.params?.isoPlane as IsoPlane) || "top";

    const canDelta = unprojectPointFromIsoPlane(deltaIso, entPlane, { x: 0, y: 0 });

    const translatedIso = translate(isoEntity, deltaIso.x, deltaIso.y);
    translatedIso.params = {
      ...translatedIso.params,
      canonical2D: translate(origCan, canDelta.x, canDelta.y),
    };

    // A entidade projetada deslocou em deltaIso
    expect(translatedIso.pts[0].x).toBeCloseTo(120, 1);
    expect(translatedIso.pts[0].y).toBeCloseTo(110, 1);

    // A entidade canônica foi preservada e transladada analiticamente sem distorção
    const updatedCan = translatedIso.params.canonical2D as Entity;
    expect(updatedCan.type).toBe("polyline");
    if (updatedCan.type === "polyline") {
      expect(Number.isFinite(updatedCan.pts[0].x)).toBe(true);
      expect(Number.isFinite(updatedCan.pts[0].y)).toBe(true);
      // Largura da chapa canônica continua 50mm e altura 30mm
      expect(Math.hypot(updatedCan.pts[1].x - updatedCan.pts[0].x, updatedCan.pts[1].y - updatedCan.pts[0].y)).toBeCloseTo(50, 2);
      expect(Math.hypot(updatedCan.pts[2].x - updatedCan.pts[1].x, updatedCan.pts[2].y - updatedCan.pts[1].y)).toBeCloseTo(30, 2);
    }
  });

  it("prevents dragged entities from snapping to their own previous-frame vertices", () => {
    const draggedCircle: Entity = {
      id: "dragged-circle",
      layer: "corte",
      type: "circle",
      cx: 100,
      cy: 100,
      r: 25,
    };

    const backgroundLine: Entity = {
      id: "bg-line",
      layer: "corte",
      type: "line",
      x1: 200,
      y1: 100,
      x2: 300,
      y2: 100,
    };

    const allEntities = [draggedCircle, backgroundLine];
    const draggedIds = ["dragged-circle"];

    // Lista de entidades excluindo o alvo de arraste
    const otherEntities = allEntities.filter((e) => !draggedIds.includes(e.id));

    // Cursor perto do centro do círculo arrastado (x=101, y=99)
    // Se o círculo estiver incluído, ele daria snap em seu próprio centro
    const snapSelf = findSmartSnap({ x: 101, y: 99 }, otherEntities, 10, null, "select", []);
    // Com otherEntities excluindo o círculo, NÃO deve haver snap no círculo arrastado
    expect(snapSelf).toBeNull();

    // Cursor perto do início da linha de fundo (x=202, y=101)
    // Deve dar snap limpo na linha externa de fundo
    const snapBg = findSmartSnap({ x: 202, y: 101 }, otherEntities, 10, null, "select", []);
    expect(snapBg).not.toBeNull();
    expect(snapBg?.p.x).toBe(200);
    expect(snapBg?.p.y).toBe(100);
  });
});
