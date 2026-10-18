/**
 * CALDRA CAD — THREE.JS B-REP SOLID RENDERER (FASE 03 & FASE 04)
 *
 * Renderizador WebGL profissional especializado em geometria B-Rep (Boundary Representation).
 * Converte a tesselação e arestas analíticas do CALDRA CAD CORE em visualização Three.js.
 *
 * Recursos:
 * - Separação estrita de triângulos de face e arestas de fronteira CAD (sem diagonais internas)
 * - Modos técnicos industriais CALDRA: SOMB, SOMB+AR, ARAME
 * - Iluminação técnica de 4 pontos (Key, Fill, Rim, Ambient)
 * - Seleção topológica via Raycasting (Face, Edge, Vertex)
 * - Multi-seleção (Shift+Click) e Medição Tridimensional Analítica de Distância
 * - Linha de cota e medição tridimensional interativa entre 2 entidades
 * - Animação de transição suave de vistas canônicas (ISO, FR, LAT, SUP)
 * - Câmera com OrbitControls e suporte a projeção Perspectiva e Ortográfica
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { CadTessellatedShape } from "../core/CadMesh";
import type { CadSelectedEntity, CadSelectionType, CadMeasurementResult } from "../core/CadSelection";
import type { EdgeMode, ViewPresetId } from "@/lib/viz3d/cameraPresets";

export type CadGizmoMode = "translate" | "rotate" | "scale" | "off";

export interface ThreeBRepRendererOptions {
  container: HTMLElement;
  edgeMode?: EdgeMode;
  view?: ViewPresetId;
  selectionType?: CadSelectionType;
  gizmoMode?: CadGizmoMode;
  onSelect?: (entity: CadSelectedEntity | null, multiSelection: CadSelectedEntity[]) => void;
  onHover?: (entity: CadSelectedEntity | null) => void;
  onMeasure?: (measurement: CadMeasurementResult | null) => void;
  onGizmoChange?: (delta: { x: number; y: number; z: number }) => void;
  onGizmoCommit?: (delta: { x: number; y: number; z: number }, entity: CadSelectedEntity | null) => void;
  onCameraRotate?: (rot: { x: number; y: number; z: number }) => void;
}

export class ThreeBRepRenderer {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private activeCamera: THREE.Camera;
  private controls: OrbitControls;

  // Grupos e Objetos na Cena
  private rootGroup: THREE.Group;
  private meshGroup: THREE.Group;
  private edgesGroup: THREE.Group;
  private verticesGroup: THREE.Group;
  private selectionOverlayGroup: THREE.Group;
  private measurementGroup: THREE.Group;
  private gridHelper: THREE.GridHelper | null = null;
  private currentTheme: "light" | "dark" = "light";

  // Dados do Sólido Carregado
  private currentShape: CadTessellatedShape | null = null;
  private multiSelection: CadSelectedEntity[] = [];
  private hoveredEntity: CadSelectedEntity | null = null;

  // Materiais Técnicos Industriais
  private baseSolidMaterial: THREE.MeshStandardMaterial;
  private primaryFaceMaterial: THREE.MeshStandardMaterial;
  private secondaryFaceMaterial: THREE.MeshStandardMaterial;
  private hoveredFaceMaterial: THREE.MeshStandardMaterial;
  private edgeMaterial: THREE.LineBasicMaterial;
  private primaryEdgeMaterial: THREE.LineBasicMaterial;
  private secondaryEdgeMaterial: THREE.LineBasicMaterial;
  private vertexMaterial: THREE.PointsMaterial;
  private selectedVertexMaterial: THREE.PointsMaterial;
  private dimensionLineMaterial: THREE.LineDashedMaterial;

  // Estado e Controle
  private edgeMode: EdgeMode = "shaded-edges";
  private selectionType: CadSelectionType = "face";
  private isOrtho = false;
  private onSelectCallback?: (entity: CadSelectedEntity | null, multiSelection: CadSelectedEntity[]) => void;
  private onHoverCallback?: (entity: CadSelectedEntity | null) => void;
  private onMeasureCallback?: (measurement: CadMeasurementResult | null) => void;
  private onGizmoChangeCallback?: (delta: { x: number; y: number; z: number }) => void;
  private onGizmoCommitCallback?: (delta: { x: number; y: number; z: number }, entity: CadSelectedEntity | null) => void;
  private onCameraRotateCallback?: (rot: { x: number; y: number; z: number }) => void;

  // Gizmo CAD Interativo (FASE 06)
  private transformControls: TransformControls | null = null;
  private gizmoTargetMesh: THREE.Mesh | null = null;
  private gizmoMode: CadGizmoMode = "off";
  private gizmoInitialPos: THREE.Vector3 = new THREE.Vector3();

  // Animação e Renderização
  private isDestroyed = false;
  private animFrameId = 0;
  private cameraAnimation: {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null = null;

  // Raycasting
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private pointerDownTime = 0;
  private pointerDownPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor(options: ThreeBRepRendererOptions) {
    this.container = options.container;
    this.edgeMode = options.edgeMode ?? "shaded-edges";
    this.selectionType = options.selectionType ?? "face";
    this.onSelectCallback = options.onSelect;
    this.onHoverCallback = options.onHover;
    this.onMeasureCallback = options.onMeasure;
    this.onCameraRotateCallback = options.onCameraRotate;

    // 1. Cena Three.js
    this.scene = new THREE.Scene();
    this.scene.background = null;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 2. Câmeras
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    this.camera.position.set(150, 120, 150);

    const aspect = width / height;
    const d = 120;
    this.orthoCamera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      0.1,
      5000,
    );
    this.orthoCamera.position.copy(this.camera.position);

    this.activeCamera = this.isOrtho ? this.orthoCamera : this.camera;

    // 3. Renderer WebGL
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    // 5. Grupos de Geometria
    this.rootGroup = new THREE.Group();
    this.meshGroup = new THREE.Group();
    this.edgesGroup = new THREE.Group();
    this.verticesGroup = new THREE.Group();
    this.selectionOverlayGroup = new THREE.Group();
    this.measurementGroup = new THREE.Group();

    this.rootGroup.add(this.meshGroup);
    this.rootGroup.add(this.edgesGroup);
    this.rootGroup.add(this.verticesGroup);
    this.rootGroup.add(this.selectionOverlayGroup);
    this.rootGroup.add(this.measurementGroup);
    this.scene.add(this.rootGroup);

    // 6. Configuração de Iluminação Técnica Industrial
    this.setupLighting();

    // 7. Gizmo CAD (FASE 06)
    this.gizmoMode = options.gizmoMode ?? "off";
    this.onGizmoChangeCallback = options.onGizmoChange;
    this.onGizmoCommitCallback = options.onGizmoCommit;
    this.setupGizmo();

    // 8. Inicialização de Materiais
    this.baseSolidMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.38,
      metalness: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
    });

    this.primaryFaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Azul primário de seleção
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });

    this.secondaryFaceMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Âmbar secundário para medição entre faces
      emissive: 0xb45309,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });

    this.hoveredFaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -0.5,
      polygonOffsetUnits: -0.5,
      side: THREE.DoubleSide,
    });

    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xf8fafc,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.88,
    });

    this.primaryEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      linewidth: 3.0,
    });

    this.secondaryEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 3.0,
    });

    this.vertexMaterial = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 6,
      sizeAttenuation: false,
    });

    this.selectedVertexMaterial = new THREE.PointsMaterial({
      color: 0x0284c7,
      size: 9,
      sizeAttenuation: false,
    });

    this.dimensionLineMaterial = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      linewidth: 2,
      scale: 1,
      dashSize: 3,
      gapSize: 2,
    });

    // 8. Raycasting e Eventos de Mouse/Touch
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 3.5 };
    this.raycaster.params.Points = { threshold: 6.0 };
    this.pointer = new THREE.Vector2();

    this.bindEvents();
    this.startRenderLoop();
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(120, 180, 140);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdbeafe, 0.75);
    fill.position.set(-140, 100, -100);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffedd5, 0.65);
    rim.position.set(0, -150, -120);
    this.scene.add(rim);

    const top = new THREE.DirectionalLight(0xffffff, 0.5);
    top.position.set(0, 200, 0);
    this.scene.add(top);
  }

  // ==========================================
  // CARREGAMENTO DA GEOMETRIA B-REP TESSELLADA
  // ==========================================

  public setShape(shape: CadTessellatedShape): void {
    this.currentShape = shape;
    this.clearGeometry();

    const { mesh, edges } = shape;

    if (mesh.vertexCount > 0 && mesh.triangleCount > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(mesh.positions, 3),
      );
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(mesh.normals, 3),
      );
      geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

      if (mesh.faceGroups && mesh.faceGroups.length > 0) {
        geometry.clearGroups();
        for (const fg of mesh.faceGroups) {
          geometry.addGroup(fg.startTriangle * 3, fg.triangleCount * 3, 0);
        }
      }

      const solidMesh = new THREE.Mesh(geometry, this.baseSolidMaterial);
      solidMesh.name = "solid_mesh";
      solidMesh.castShadow = true;
      solidMesh.receiveShadow = true;
      this.meshGroup.add(solidMesh);
    }

    if (edges && edges.edges.length > 0) {
      for (const edge of edges.edges) {
        if (edge.pointCount < 2) continue;
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(edge.points, 3),
        );
        const line = new THREE.Line(lineGeo, this.edgeMaterial);
        line.name = `edge_${edge.edgeIndex}`;
        line.userData = { edgeIndex: edge.edgeIndex, edgeId: edge.edgeId };
        this.edgesGroup.add(line);
      }
    }

    if (mesh.positions.length > 0) {
      const vGeo = new THREE.BufferGeometry();
      vGeo.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
      const vPoints = new THREE.Points(vGeo, this.vertexMaterial);
      vPoints.name = "cad_vertices";
      this.verticesGroup.add(vPoints);
    }

    this.updateVisibilityByEdgeMode();
    this.fitView(false);
    this.updateGridAndBackground();
  }

  private clearGeometry(): void {
    while (this.meshGroup.children.length > 0) {
      const obj = this.meshGroup.children[0] as THREE.Mesh;
      this.meshGroup.remove(obj);
      obj.geometry.dispose();
    }

    while (this.edgesGroup.children.length > 0) {
      const obj = this.edgesGroup.children[0] as THREE.Line;
      this.edgesGroup.remove(obj);
      obj.geometry.dispose();
    }

    while (this.verticesGroup.children.length > 0) {
      const obj = this.verticesGroup.children[0] as THREE.Points;
      this.verticesGroup.remove(obj);
      obj.geometry.dispose();
    }

    this.clearSelectionOverlay();
    this.clearMeasurementOverlay();
  }

  private clearSelectionOverlay(): void {
    while (this.selectionOverlayGroup.children.length > 0) {
      const obj = this.selectionOverlayGroup.children[0] as THREE.Mesh;
      this.selectionOverlayGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }
  }

  private clearMeasurementOverlay(): void {
    while (this.measurementGroup.children.length > 0) {
      const obj = this.measurementGroup.children[0] as THREE.Object3D;
      this.measurementGroup.remove(obj);
      if ("geometry" in obj && obj.geometry instanceof THREE.BufferGeometry) {
        obj.geometry.dispose();
      }
    }
  }

  // ==========================================
  // MODOS DE APARÊNCIA CALDRA (SOMB, SOMB+AR, ARAME)
  // ==========================================

  public setEdgeMode(mode: EdgeMode): void {
    this.edgeMode = mode;
    this.updateVisibilityByEdgeMode();
  }

  private updateVisibilityByEdgeMode(): void {
    switch (this.edgeMode) {
      case "shaded":
        this.meshGroup.visible = true;
        this.edgesGroup.visible = false;
        this.verticesGroup.visible = this.selectionType === "vertex";
        break;

      case "shaded-edges":
        this.meshGroup.visible = true;
        this.edgesGroup.visible = true;
        this.verticesGroup.visible = this.selectionType === "vertex";
        break;

      case "wireframe":
        this.meshGroup.visible = false;
        this.edgesGroup.visible = true;
        this.verticesGroup.visible = true;
        break;
    }
  }

  public setSelectionType(type: CadSelectionType): void {
    this.selectionType = type;
    this.updateVisibilityByEdgeMode();
  }

  // ==========================================
  // SELEÇÃO TOPOLÓGICA E MEDIÇÃO 3D (FASE 04)
  // ==========================================

  public selectEntity(entity: CadSelectedEntity | null, append = false): void {
    if (!entity) {
      this.multiSelection = [];
      this.clearSelectionOverlay();
      this.clearMeasurementOverlay();
      this.onSelectCallback?.(null, []);
      this.onMeasureCallback?.(null);
      return;
    }

    if (!append) {
      this.multiSelection = [entity];
    } else {
      const existingIdx = this.multiSelection.findIndex((e) => e.id === entity.id);
      if (existingIdx >= 0) {
        this.multiSelection.splice(existingIdx, 1);
      } else {
        if (this.multiSelection.length >= 2) {
          this.multiSelection = [this.multiSelection[1]!, entity];
        } else {
          this.multiSelection.push(entity);
        }
      }
    }

    this.renderSelectionAndMeasurements();
    const primary = this.multiSelection[0] ?? null;
    this.onSelectCallback?.(primary, this.multiSelection);
  }

  public clearSelection(): void {
    this.selectEntity(null);
  }

  private renderSelectionAndMeasurements(): void {
    this.clearSelectionOverlay();
    this.clearMeasurementOverlay();
    if (!this.currentShape || this.multiSelection.length === 0) return;

    for (let i = 0; i < this.multiSelection.length; i++) {
      const entity = this.multiSelection[i]!;
      const isPrimary = i === 0;
      const faceMat = isPrimary ? this.primaryFaceMaterial : this.secondaryFaceMaterial;
      const edgeMat = isPrimary ? this.primaryEdgeMaterial : this.secondaryEdgeMaterial;

      if (entity.type === "face") {
        const fg = this.currentShape.mesh.faceGroups[entity.index];
        if (fg) {
          const totalIndices = fg.triangleCount * 3;
          const subIndices = new Uint32Array(totalIndices);
          for (let j = 0; j < totalIndices; j++) {
            subIndices[j] = this.currentShape.mesh.indices[fg.startTriangle * 3 + j]!;
          }

          const faceGeo = new THREE.BufferGeometry();
          faceGeo.setAttribute(
            "position",
            new THREE.BufferAttribute(this.currentShape.mesh.positions, 3),
          );
          faceGeo.setAttribute(
            "normal",
            new THREE.BufferAttribute(this.currentShape.mesh.normals, 3),
          );
          faceGeo.setIndex(new THREE.BufferAttribute(subIndices, 1));

          const overlay = new THREE.Mesh(faceGeo, faceMat);
          this.selectionOverlayGroup.add(overlay);
        }
      } else if (entity.type === "edge") {
        const edge = this.currentShape.edges.edges[entity.index];
        if (edge) {
          const edgeGeo = new THREE.BufferGeometry();
          edgeGeo.setAttribute("position", new THREE.BufferAttribute(edge.points, 3));
          const line = new THREE.Line(edgeGeo, edgeMat);
          this.selectionOverlayGroup.add(line);
        }
      } else if (entity.type === "vertex") {
        if (entity.point) {
          const sphereGeo = new THREE.SphereGeometry(2, 16, 16);
          const sphere = new THREE.Mesh(
            sphereGeo,
            new THREE.MeshBasicMaterial({ color: isPrimary ? 0x0284c7 : 0xf59e0b }),
          );
          sphere.position.set(entity.point.x, entity.point.y, entity.point.z);
          this.selectionOverlayGroup.add(sphere);
        }
      }
    }

    if (this.multiSelection.length === 2) {
      const eA = this.multiSelection[0]!;
      const eB = this.multiSelection[1]!;

      const pA = this.getEntityRepresentativePoint(eA);
      const pB = this.getEntityRepresentativePoint(eB);

      if (pA && pB) {
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const dz = pB.z - pA.z;
        const dist = Math.hypot(dx, dy, dz);

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([pA.x, pA.y, pA.z, pB.x, pB.y, pB.z], 3),
        );
        const dimLine = new THREE.Line(lineGeo, this.dimensionLineMaterial);
        dimLine.computeLineDistances();
        this.measurementGroup.add(dimLine);

        const sphereGeo = new THREE.SphereGeometry(1.5, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

        const markerA = new THREE.Mesh(sphereGeo, sphereMat);
        markerA.position.set(pA.x, pA.y, pA.z);
        this.measurementGroup.add(markerA);

        const markerB = new THREE.Mesh(sphereGeo, sphereMat);
        markerB.position.set(pB.x, pB.y, pB.z);
        this.measurementGroup.add(markerB);

        const measurement: CadMeasurementResult = {
          distance: dist,
          deltaX: Math.abs(dx),
          deltaY: Math.abs(dy),
          deltaZ: Math.abs(dz),
          entityA: eA,
          entityB: eB,
          type: `${eA.type}-${eB.type}` as CadMeasurementResult["type"],
        };

        this.onMeasureCallback?.(measurement);
      }
    } else {
      this.onMeasureCallback?.(null);
    }

    // Atualiza posição do Gizmo CAD com base na entidade selecionada
    this.updateGizmoPosition();
  }

  // ==========================================
  // GIZMO CAD INTERATIVO (FASE 06)
  // ==========================================

  private setupGizmo(): void {
    try {
      this.transformControls = new TransformControls(this.activeCamera, this.renderer.domElement);
      this.transformControls.size = 0.75;
      this.transformControls.space = "world";

      const targetGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const targetMat = new THREE.MeshBasicMaterial({ visible: false });
      this.gizmoTargetMesh = new THREE.Mesh(targetGeo, targetMat);
      this.scene.add(this.gizmoTargetMesh);

      this.transformControls.attach(this.gizmoTargetMesh);
      this.transformControls.visible = false;
      this.transformControls.enabled = false;

      const helper =
        typeof this.transformControls.getHelper === "function"
          ? this.transformControls.getHelper()
          : (this.transformControls as unknown as THREE.Object3D);
      this.scene.add(helper);

      this.transformControls.addEventListener("dragging-changed", (event: { value: boolean }) => {
        this.controls.enabled = !event.value;
        if (event.value) {
          if (this.gizmoTargetMesh) {
            this.gizmoInitialPos.copy(this.gizmoTargetMesh.position);
          }
        } else {
          if (this.gizmoTargetMesh) {
            const delta = {
              x: this.gizmoTargetMesh.position.x - this.gizmoInitialPos.x,
              y: this.gizmoTargetMesh.position.y - this.gizmoInitialPos.y,
              z: this.gizmoTargetMesh.position.z - this.gizmoInitialPos.z,
            };
            if (Math.hypot(delta.x, delta.y, delta.z) > 0.05) {
              const primary = this.multiSelection[0] ?? null;
              this.onGizmoCommitCallback?.(delta, primary);
            }
            this.updateGizmoPosition();
          }
        }
      });

      this.transformControls.addEventListener("change", () => {
        if (this.gizmoTargetMesh && !this.controls.enabled) {
          const delta = {
            x: this.gizmoTargetMesh.position.x - this.gizmoInitialPos.x,
            y: this.gizmoTargetMesh.position.y - this.gizmoInitialPos.y,
            z: this.gizmoTargetMesh.position.z - this.gizmoInitialPos.z,
          };
          this.onGizmoChangeCallback?.(delta);
        }
      });
    } catch (err) {
      console.warn("[ThreeBRepRenderer] Inicialização do Gizmo diferida:", err);
    }
  }

  public updateGizmoPosition(): void {
    if (!this.transformControls || !this.gizmoTargetMesh) return;

    if (this.gizmoMode === "off" || this.multiSelection.length === 0) {
      this.transformControls.visible = false;
      this.transformControls.enabled = false;
      return;
    }

    const primary = this.multiSelection[0]!;
    const pt = this.getEntityRepresentativePoint(primary);
    if (pt) {
      this.gizmoTargetMesh.position.copy(pt);
      this.gizmoInitialPos.copy(pt);
      this.transformControls.visible = true;
      this.transformControls.enabled = true;
    } else {
      this.transformControls.visible = false;
      this.transformControls.enabled = false;
    }
  }

  public setGizmoMode(mode: CadGizmoMode): void {
    this.gizmoMode = mode;
    if (!this.transformControls) return;

    if (mode === "off") {
      this.transformControls.visible = false;
      this.transformControls.enabled = false;
    } else {
      this.transformControls.setMode(mode);
      this.updateGizmoPosition();
    }
  }

  public setGizmoSnap(translationSnap: number | null, rotationSnap: number | null): void {
    if (!this.transformControls) return;
    this.transformControls.setTranslationSnap(translationSnap);
    this.transformControls.setRotationSnap(rotationSnap);
  }

  private getEntityRepresentativePoint(entity: CadSelectedEntity): THREE.Vector3 | null {
    if (entity.point) {
      return new THREE.Vector3(entity.point.x, entity.point.y, entity.point.z);
    }

    if (entity.type === "face" && this.currentShape) {
      const fg = this.currentShape.mesh.faceGroups[entity.index];
      if (fg) {
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let count = 0;
        const start = fg.startTriangle * 3;
        const end = start + fg.triangleCount * 3;
        for (let i = start; i < end; i++) {
          const vIdx = this.currentShape.mesh.indices[i]!;
          sx += this.currentShape.mesh.positions[vIdx * 3]!;
          sy += this.currentShape.mesh.positions[vIdx * 3 + 1]!;
          sz += this.currentShape.mesh.positions[vIdx * 3 + 2]!;
          count++;
        }
        if (count > 0) {
          return new THREE.Vector3(sx / count, sy / count, sz / count);
        }
      }
    } else if (entity.type === "edge" && this.currentShape) {
      const edge = this.currentShape.edges.edges[entity.index];
      if (edge && edge.points.length >= 3) {
        const midIdx = Math.floor(edge.pointCount / 2) * 3;
        return new THREE.Vector3(
          edge.points[midIdx]!,
          edge.points[midIdx + 1]!,
          edge.points[midIdx + 2]!,
        );
      }
    }

    return null;
  }

  // ==========================================
  // NAVEGAÇÃO E VISTAS CANÔNICAS (ISO, FR, LAT, SUP)
  // ==========================================

  public setView(view: ViewPresetId, animate = true): void {
    let dir: [number, number, number] = [1, 0.8, 1];
    switch (view) {
      case "front":
        dir = [0, 0, 1];
        break;
      case "side":
      case "right":
        dir = [1, 0, 0];
        break;
      case "top":
        dir = [0, 1, 0.001];
        break;
      case "back":
        dir = [0, 0, -1];
        break;
      case "left":
        dir = [-1, 0, 0];
        break;
      case "bottom":
        dir = [0, -1, 0.001];
        break;
      case "iso":
      default:
        dir = [1, 0.8, 1];
        break;
    }

    this.fitView(animate, dir);
  }

  public setViewPreset(view: ViewPresetId, animate = true): void {
    this.setView(view, animate);
  }

  public fitToModel(animate = true): void {
    this.fitView(animate);
  }

  public setTheme(theme: "light" | "dark"): void {
    this.currentTheme = theme;
    this.updateGridAndBackground();
  }

  public updateGridAndBackground(): void {
    const isDark = this.currentTheme === "dark";
    // Viewport background: exactly #051833 for dark theme (Prompt Sec. 24)
    this.scene.background = new THREE.Color(isDark ? 0x051833 : 0xf8fafc);

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      if (Array.isArray(this.gridHelper.material)) {
        this.gridHelper.material.forEach((m) => m.dispose());
      } else {
        this.gridHelper.material.dispose();
      }
      this.gridHelper = null;
    }

    let maxDim = 300;
    let floorY = 0;
    if (this.currentShape?.bounds) {
      const b = this.currentShape.bounds;
      const dx = b.max.x - b.min.x;
      const dy = b.max.y - b.min.y;
      const dz = b.max.z - b.min.z;
      maxDim = Math.max(dx, dy, dz);
      floorY = b.min.y - 0.5;
    }

    // Escala adaptativa em mm coerente com o modelo (Prompt Sec. 29 & 30)
    const gridSize = Math.max(600, Math.ceil((maxDim * 3) / 100) * 100);
    const divisions = Math.min(100, Math.max(20, Math.round(gridSize / 20)));

    // Tema Escuro: Grid branco (0.18 principal, 0.08 secundária) (Sec. 24)
    // Tema Claro: Grid escuro (0.16 principal, 0.07 secundária) (Sec. 25)
    const mainColor = isDark ? 0xffffff : 0x0f172a;
    const subColor = isDark ? 0xffffff : 0x334155;

    const grid = new THREE.GridHelper(gridSize, divisions, mainColor, subColor);
    grid.position.set(0, floorY, 0);

    if (Array.isArray(grid.material)) {
      grid.material[0].transparent = true;
      grid.material[0].opacity = isDark ? 0.18 : 0.16;
      grid.material[1].transparent = true;
      grid.material[1].opacity = isDark ? 0.08 : 0.07;
    } else {
      grid.material.transparent = true;
      grid.material.opacity = isDark ? 0.12 : 0.10;
    }

    this.gridHelper = grid;
    this.scene.add(grid);
  }

  public fitView(animate = true, dir?: [number, number, number]): void {
    const box = new THREE.Box3();
    if (this.currentShape?.bounds) {
      const b = this.currentShape.bounds;
      box.min.set(b.min.x, b.min.y, b.min.z);
      box.max.set(b.max.x, b.max.y, b.max.z);
    } else {
      box.setFromObject(this.rootGroup);
    }

    if (box.isEmpty()) {
      box.set(new THREE.Vector3(-50, -50, -25), new THREE.Vector3(50, 50, 25));
    }

    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 15);

    const direction = dir
      ? new THREE.Vector3(...dir).normalize()
      : this.camera.position.clone().sub(this.controls.target).normalize();

    const fovRad = (this.camera.fov * Math.PI) / 360;
    const distance = (radius / Math.sin(fovRad)) * 1.05;
    const targetCameraPos = center.clone().add(direction.multiplyScalar(distance));

    if (animate) {
      this.cameraAnimation = {
        fromPos: this.camera.position.clone(),
        toPos: targetCameraPos,
        fromTarget: this.controls.target.clone(),
        toTarget: center,
        startTime: performance.now(),
        duration: 380,
      };
    } else {
      this.camera.position.copy(targetCameraPos);
      this.orthoCamera.position.copy(targetCameraPos);
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  public zoomIn(factor = 0.8): void {
    if (this.isOrtho) {
      this.orthoCamera.zoom = Math.min(this.orthoCamera.zoom / factor, 15);
      this.orthoCamera.updateProjectionMatrix();
    } else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      this.camera.position.copy(this.controls.target.clone().add(offset.multiplyScalar(factor)));
    }
    this.controls.update();
  }

  public zoomOut(factor = 1.25): void {
    if (this.isOrtho) {
      this.orthoCamera.zoom = Math.max(this.orthoCamera.zoom / factor, 0.1);
      this.orthoCamera.updateProjectionMatrix();
    } else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      this.camera.position.copy(this.controls.target.clone().add(offset.multiplyScalar(factor)));
    }
    this.controls.update();
  }

  public panCamera(deltaX: number, deltaY: number): void {
    const eye = this.activeCamera.position.clone().sub(this.controls.target);
    const right = new THREE.Vector3().crossVectors(this.activeCamera.up, eye).normalize();
    const up = new THREE.Vector3().crossVectors(eye, right).normalize();
    const panOffset = right.multiplyScalar(deltaX).add(up.multiplyScalar(deltaY));
    this.camera.position.add(panOffset);
    this.orthoCamera.position.add(panOffset);
    this.controls.target.add(panOffset);
    this.controls.update();
  }

  public orbitCamera(angleH: number, angleV: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const radius = offset.length();
    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));
    theta += angleH;
    phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi + angleV));
    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.position.copy(this.controls.target.clone().add(offset));
    this.orthoCamera.position.copy(this.camera.position);
    this.controls.update();
  }

  public setCameraProjection(isOrtho: boolean): void {
    this.isOrtho = isOrtho;
    this.activeCamera = isOrtho ? this.orthoCamera : this.camera;
    this.activeCamera.position.copy(isOrtho ? this.camera.position : this.orthoCamera.position);
    this.controls.object = this.activeCamera;
    this.controls.update();
    this.onWindowResize();
  }

  public isOrthographic(): boolean {
    return this.isOrtho;
  }

  // ==========================================
  // EVENTOS E INTERAÇÃO
  // ==========================================

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", this.onPointerDown);
    dom.addEventListener("pointermove", this.onPointerMove);
    dom.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("resize", this.onWindowResize);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownTime = performance.now();
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private updatePointerCoords(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.height) / rect.height) * 2 + 1;
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointerCoords(e);

    if (!this.cameraAnimation) {
      this.raycaster.setFromCamera(this.pointer, this.activeCamera);
      const hit = this.performHitTest();
      if (hit?.id !== this.hoveredEntity?.id) {
        this.hoveredEntity = hit;
        this.onHoverCallback?.(hit);
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const elapsed = performance.now() - this.pointerDownTime;
    const dist = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y,
    );

    if (elapsed < 350 && dist < 5) {
      this.updatePointerCoords(e);
      this.raycaster.setFromCamera(this.pointer, this.activeCamera);
      const hit = this.performHitTest();
      this.selectEntity(hit, e.shiftKey);
    }
  };

  private performHitTest(): CadSelectedEntity | null {
    if (!this.currentShape) return null;

    if (this.selectionType === "face" && this.meshGroup.children.length > 0) {
      const solidMesh = this.meshGroup.children[0] as THREE.Mesh;
      const intersects = this.raycaster.intersectObject(solidMesh, false);
      if (intersects.length > 0) {
        const hit = intersects[0]!;
        const faceIndex = hit.faceIndex;
        if (faceIndex !== undefined && this.currentShape.mesh.faceGroups) {
          const fg = this.currentShape.mesh.faceGroups.find(
            (g) =>
              faceIndex >= g.startTriangle &&
              faceIndex < g.startTriangle + g.triangleCount,
          );
          if (fg) {
            return {
              id: fg.faceId,
              type: "face",
              index: fg.faceIndex,
              point: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : undefined,
              normal: hit.face ? { x: hit.face.normal.x, y: hit.face.normal.y, z: hit.face.normal.z } : undefined,
            };
          }
        }
      }
    } else if (this.selectionType === "edge" && this.edgesGroup.children.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.edgesGroup.children, false);
      if (intersects.length > 0) {
        const hit = intersects[0]!;
        const edgeIndex = hit.object.userData.edgeIndex as number;
        const edgeId = (hit.object.userData.edgeId as string) || `edge_${edgeIndex}`;
        return {
          id: edgeId,
          type: "edge",
          index: edgeIndex,
          point: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : undefined,
        };
      }
    } else if (this.selectionType === "vertex" && this.verticesGroup.children.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.verticesGroup.children, false);
      if (intersects.length > 0) {
        const hit = intersects[0]!;
        const vIndex = hit.index ?? 0;
        return {
          id: `vertex_${vIndex}`,
          type: "vertex",
          index: vIndex,
          point: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : undefined,
        };
      }
    }

    return null;
  }

  private onWindowResize = (): void => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const aspect = width / height;
    const d = 120;
    this.orthoCamera.left = -d * aspect;
    this.orthoCamera.right = d * aspect;
    this.orthoCamera.top = d;
    this.orthoCamera.bottom = -d;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  // ==========================================
  // LOOP DE RENDERIZAÇÃO
  // ==========================================

  private startRenderLoop(): void {
    const loop = () => {
      if (this.isDestroyed) return;
      this.animFrameId = requestAnimationFrame(loop);

      if (this.cameraAnimation) {
        const now = performance.now();
        const elapsed = now - this.cameraAnimation.startTime;
        const progress = Math.min(elapsed / this.cameraAnimation.duration, 1);
        const t = 1 - Math.pow(1 - progress, 3);

        this.camera.position.lerpVectors(
          this.cameraAnimation.fromPos,
          this.cameraAnimation.toPos,
          t,
        );
        this.controls.target.lerpVectors(
          this.cameraAnimation.fromTarget,
          this.cameraAnimation.toTarget,
          t,
        );
        this.controls.update();

        if (progress >= 1) {
          this.cameraAnimation = null;
        }
      } else {
        this.controls.update();
      }

      if (this.onCameraRotateCallback) {
        const euler = new THREE.Euler().setFromQuaternion(this.activeCamera.quaternion, "YXZ");
        this.onCameraRotateCallback({ x: euler.x, y: euler.y, z: euler.z });
      }

      this.renderer.render(this.scene, this.activeCamera);
    };

    loop();
  }

  // ==========================================
  // LIMPEZA E DESCARTE DE RECURSOS
  // ==========================================

  public dispose(): void {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animFrameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener("pointerdown", this.onPointerDown);
    dom.removeEventListener("pointermove", this.onPointerMove);
    dom.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("resize", this.onWindowResize);

    this.clearGeometry();

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper = null;
    }

    this.baseSolidMaterial.dispose();
    this.primaryFaceMaterial.dispose();
    this.secondaryFaceMaterial.dispose();
    this.hoveredFaceMaterial.dispose();
    this.edgeMaterial.dispose();
    this.primaryEdgeMaterial.dispose();
    this.secondaryEdgeMaterial.dispose();
    this.vertexMaterial.dispose();
    this.selectedVertexMaterial.dispose();
    this.dimensionLineMaterial.dispose();

    if (this.transformControls) {
      this.transformControls.dispose();
      this.transformControls = null;
    }

    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
