import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Wire3D } from "./Wire3D";
import { buildWire } from "@/lib/viz3d/wire";
import { View3DPanel, VisualizationViewport } from "./View3DPanel";
import { EXTENDED_VIEW_PRESETS } from "@/lib/viz3d/cameraPresets";

const SLUGS = [
  "quadrado-redondo",
  "curva-de-gomos",
  "cone",
  "tronco-de-cone",
  "cone-excentrico",
  "boca-de-lobo",
  "y",
  "reducao-circular",
  "cilindro",
  "flanges",
  "tampas",
  "calotas",
] as const;

describe("Wire3D render test", () => {
  for (const slug of SLUGS) {
    it(`renders Wire3D for ${slug} without crashing`, () => {
      const model = buildWire(slug, { d1: 400, d2: 200, h: 300, baseA: 400, baseB: 300, seg: 24 });
      const html = renderToString(
        React.createElement(Wire3D, {
          model,
          interactive: true,
          edgeMode: "shaded-edges",
        }),
      );
      expect(html).toContain("<svg");
    });
  }

  it("renders Wire3D with mode='pan' and mode='orbit'", () => {
    const model = buildWire("quadrado-redondo", { d1: 400, d2: 200, h: 300, baseA: 400, baseB: 300, seg: 24 });
    const htmlPan = renderToString(
      React.createElement(Wire3D, {
        model,
        interactive: true,
        mode: "pan",
      }),
    );
    expect(htmlPan).toContain("cursor-move");

    const htmlOrbit = renderToString(
      React.createElement(Wire3D, {
        model,
        interactive: true,
        mode: "orbit",
      }),
    );
    expect(htmlOrbit).toContain("cursor-grab");
  });

  it("renders all extended views in Wire3D", () => {
    const model = buildWire("cone", { d1: 500, d2: 100, h: 400 });
    for (const preset of EXTENDED_VIEW_PRESETS) {
      const html = renderToString(
        React.createElement(Wire3D, {
          model,
          view: preset.id,
        }),
      );
      expect(html).toContain("<svg");
    }
  });

  it("renders View3DPanel for quadrado-redondo without crashing", () => {
    const model = buildWire("quadrado-redondo", { d1: 400, d2: 200, h: 300, baseA: 400, baseB: 300, seg: 24 });
    const html = renderToString(
      React.createElement(View3DPanel, {
        model,
        unfold: 0,
        onUnfold: () => {},
        onPlanificar: () => {},
      }),
    );
    expect(html).toContain("grid-bg-fine");
  });

  it("renders VisualizationViewport in 3D mode without crashing", () => {
    const model = buildWire("quadrado-redondo", { d1: 400, d2: 200, h: 300, baseA: 400, baseB: 300, seg: 24 });
    const html = renderToString(
      React.createElement(
        VisualizationViewport,
        {
          mode: "3d",
          onModeChange: () => {},
          model,
          unfold: 0,
          onUnfold: () => {},
          onPlanificar: () => {},
        },
        React.createElement("div", null, "2D View"),
      ),
    );
    expect(html).toContain("grid-bg");
  });
});
