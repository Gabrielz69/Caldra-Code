import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/lib/geometry/types";
import { buildWire, type Camera, type Edge } from "./wire";
import {
  VISIBILITY_POLICY,
  compareSurfaceDepth,
  projectLine,
  toCameraPoint,
  visibleLineSegments,
  type ProjectedTriangle,
} from "./visibility";

const AZIMUTHS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];
const ELEVATIONS = [90, 75, 60, 45, 30, 0, -30, -45, -60, -75, -90];
const SPHERE: readonly (readonly [number, number])[] = [
  [0, 0],
  [45, 30],
  [90, 45],
  [135, 60],
  [180, 90],
  [225, 60],
  [270, 45],
  [315, 30],
];
const MODELS = [
  ["cone", { d1: 800, d2: 0, h: 500 }],
  ["reducao-circular", { d1: 600, d2: 300, h: 400 }],
  ["curva-de-gomos", { d1: 650, d2: 300, h: 400, ang: 90, n: 4 }],
  ["quadrado-redondo", { d1: 600, d2: 300, h: 450, baseA: 600, baseB: 450, divisions: 8 }],
  ["boca-de-lobo", { d1: 500, d2: 250, h: 500, ang: 45, mode: "branch" }],
] as const;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const camera = (yaw: number, pitch: number): Camera => ({
  yaw: rad(yaw),
  pitch: rad(pitch),
  zoom: 1,
});

describe("política explícita de linhas técnicas", () => {
  const origin: Vec3 = { x: 0, y: 0, z: 0 };
  const angles = [0, 30, 45, 60, 90];
  const straightLines: Edge[] = angles.map((angle) => [
    origin,
    { x: Math.cos(rad(angle)) * 100, y: Math.sin(rad(angle)) * 100, z: angle === 45 ? 40 : 0 },
  ]);
  const circle: Edge[] = Array.from({ length: 24 }, (_, index) => {
    const a = rad(index * 15);
    const b = rad((index + 1) * 15);
    return [
      { x: Math.cos(a) * 40, y: Math.sin(a) * 40, z: 15 },
      { x: Math.cos(b) * 40, y: Math.sin(b) * 40, z: 15 },
    ];
  });
  const arc = circle.slice(0, 9);
  const polyline: Edge[] = [
    [
      { x: -60, y: -25, z: -15 },
      { x: -10, y: 35, z: 5 },
    ],
    [
      { x: -10, y: 35, z: 5 },
      { x: 55, y: -10, z: 25 },
    ],
  ];
  const fixture: Edge[] = [...straightLines, ...circle, ...arc, ...polyline];

  it("mantém horizontal, vertical, inclinadas e diagonal como entidades em toda a esfera", () => {
    const views: (readonly [number, number])[] = [
      ...SPHERE,
      ...AZIMUTHS.map((a) => [a, 0] as const),
      ...ELEVATIONS.map((e) => [0, e] as const),
    ];
    for (const [yaw, pitch] of views) {
      const cam = camera(yaw, pitch);
      const rendered = fixture.flatMap((edge, index) => {
        const line = projectLine(`fixture:${index}`, edge, (p) => toCameraPoint(p, cam), 1);
        return visibleLineSegments(line, VISIBILITY_POLICY.technical, [], 1e-5);
      });
      expect(rendered.map((line) => line.id)).toEqual(
        fixture.map((_, index) => `fixture:${index}`),
      );
      expect(
        rendered.every((line) =>
          Object.values(line).every((value) => typeof value === "string" || Number.isFinite(value)),
        ),
      ).toBe(true);
    }
  });

  it("preserva todas as arestas e referências dos cinco modelos em 360° e ±90°", () => {
    for (const [slug, params] of MODELS) {
      const model = buildWire(slug, params);
      const views: (readonly [number, number])[] = [
        ...SPHERE,
        ...AZIMUTHS.map((a) => [a, 0] as const),
        ...ELEVATIONS.map((e) => [0, e] as const),
      ];
      for (const [yaw, pitch] of views) {
        const cam = camera(yaw, pitch);
        const edges = model.edges.map((edge, index) =>
          projectLine(`edge:${index}`, edge, (p) => toCameraPoint(p, cam), 1),
        );
        const refs = model.refLines.map((edge, index) =>
          projectLine(`ref:${index}`, edge, (p) => toCameraPoint(p, cam), 1),
        );
        expect(
          edges.flatMap((line) => visibleLineSegments(line, VISIBILITY_POLICY.edge, [], 1)),
        ).toHaveLength(model.edges.length);
        expect(
          refs.flatMap((line) => visibleLineSegments(line, VISIBILITY_POLICY.reference, [], 1)),
        ).toHaveLength(model.refLines.length);
      }
    }
  });
});

describe("oclusão espacial por subsegmento", () => {
  const front: ProjectedTriangle[] = [
    {
      id: "face:0:0",
      pts: [
        { x: -20, y: -20, z: 10 },
        { x: 20, y: -20, z: 10 },
        { x: 20, y: 20, z: 10 },
      ],
      minDepth: 10,
      maxDepth: 10,
      centerDepth: 10,
      priority: 0,
    },
    {
      id: "face:0:1",
      pts: [
        { x: -20, y: -20, z: 10 },
        { x: 20, y: 20, z: 10 },
        { x: -20, y: 20, z: 10 },
      ],
      minDepth: 10,
      maxDepth: 10,
      centerDepth: 10,
      priority: 0,
    },
  ];

  it("oculta somente o trecho realmente coberto e preserva a identidade-base", () => {
    const line = { id: "edge:7", x1: -50, y1: 0, x2: 50, y2: 0, z1: 0, z2: 0 };
    const segments = visibleLineSegments(line, "real-occlusion", front, 1e-4);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.id.startsWith("edge:7:")).toBe(true);
    expect(segments[0]?.x2).toBeLessThanOrEqual(-15);
    expect(segments[1]?.x1).toBeGreaterThanOrEqual(15);
  });

  it("ordena superfícies de modo determinístico por intervalo, prioridade e ID", () => {
    const faces = [
      { ...front[0]!, id: "face:b", minDepth: 5, maxDepth: 15, centerDepth: 10, priority: 1 },
      { ...front[0]!, id: "face:a", minDepth: 5, maxDepth: 15, centerDepth: 10, priority: 1 },
      { ...front[0]!, id: "face:far", minDepth: -10, maxDepth: -5, centerDepth: -7, priority: 0 },
    ].sort(compareSurfaceDepth);
    expect(faces.map((face) => face.id)).toEqual(["face:far", "face:a", "face:b"]);
  });
});
