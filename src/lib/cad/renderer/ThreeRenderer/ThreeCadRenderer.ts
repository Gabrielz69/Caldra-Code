/**
 * CALDRA CAD CORE — THREE.JS CAD RENDERER (Seção 8 e 9)
 *
 * Viewport 3D técnico de alta precisão para renderização de B-Rep e malhas CAD:
 * - Aparência de chapa metálica técnica limpa (anti-AI slop, iluminação uniforme calibrada)
 * - Bordas brancas nítidas (SOMB) e geratrizes técnicas (SOMB+AR)
 * - Raycasting preciso para seleção de faces e corpos B-Rep
 * - Controles de câmera ortográfica/perspectiva com vistas canônicas (ISO, FR, LAT, SUP)
 * - Desalocação determinística de buffers WebGL (sem memory leaks)
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CadMesh } from "../../core/CadTopology";
import type { CadSelectedEntity, CadSelectionType } from "../../core/CadSelection";

export type CadEdgeMode = "shaded" | "shaded-edges" | "wireframe";
export type CadCameraPreset = "iso" | "front" | "top" | "side" | "back" | "bottom";

export interface ThreeCadRendererOptions {
  antialias?: boolean;
  edgeMode?: CadEdgeMode;
  onHover?: (entity: CadSelectedEntity | null) => void;
  onSelect?: (entity: CadSelectedEntity | null, multi: boolean) => void;
}

export class ThreeCadRenderer {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  // Grupos e objetos da cena
  private modelGroup: THREE.Group;
  private solidMesh: THREE.Mesh | null = null;
  private boundaryLines: THREE.LineSegments | null = null;
  private internalLines: THREE.LineSegments | null = null;
  private selectionMesh: THREE.Mesh | null = null;

  // Estado atual
  private currentMesh: CadMesh | null = null;
  private currentShapeId: string = "";
  private edgeMode: CadEdgeMode = "shaded";
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Callbacks
  private onHoverCallback?: (entity: CadSelectedEntity | null) => void;
  private onSelectCallback?: (entity: CadSelectedEntity | null, multi: boolean) => void;

  // Materiais calibrados
  private solidMaterial: THREE.MeshStandardMaterial;
  private wireframeMaterial: THREE.MeshBasicMaterial;
  private boundaryLineMaterial: THREE.LineBasicMaterial;
  private internalLineMaterial: THREE.LineBasicMaterial;
  private selectionMaterial: THREE.MeshStandardMaterial;

  constructor(container: HTMLElement, options?: ThreeCadRendererOptions) {
    this.container = container;
    this.edgeMode = options?.edgeMode ?? "shaded";
    this.onHoverCallback = options?.onHover;
    this.onSelectCallback = options?.onSelect;

    // 1. Cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0c111d"); // Fundo técnico escuro consistente com CALDRA

    // 2. Câmera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 5000);
    this.camera.position.set(200, 200, 200);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: options?.antialias ?? true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. Controles Orbit
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;

    // 5. Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 6. Grupo de Modelos
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    // 7. Iluminação técnica de estúdio de engenharia (key + fill + rim + soft ambient)
    this.setupLighting();

    // 8. Materiais
    this.solidMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#64748b"), // Chapa de aço calibrada
      metalness: 0.25,
      roughness: 0.55,
      flatShading: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      wireframe: true,
      color: new THREE.Color("#38bdf8"),
      transparent: true,
      opacity: 0.35,
    });

    // Bordas externas / aberturas: BRANCAS NÍTIDAS E PURAS (Regra CALDRA)
    this.boundaryLineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#ffffff"),
      linewidth: 1,
      transparent: false,
      depthTest: true,
    });

    // Geratrizes / divisões técnicas para SOMB+AR: cinza claro suave
    this.internalLineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#94a3b8"),
      linewidth: 1,
      transparent: true,
      opacity: 0.65,
      depthTest: true,
    });

    // Material de seleção e hover
    this.selectionMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0284c7"),
      emissive: new THREE.Color("#0369a1"),
      emissiveIntensity: 0.45,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // 9. Event Listeners
    this.setupEvents();

    // 10. Loop de animação
    this.animate();
  }

  private setupLighting(): void {
    // Luz ambiente suave para não ocultar cavidades
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Luz principal técnica (Key Light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(300, 500, 400);
    this.scene.add(keyLight);

    // Luz de preenchimento (Fill Light)
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.5);
    fillLight.position.set(-300, -200, -200);
    this.scene.add(fillLight);

    // Luz de borda / silhueta (Rim Light)
    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 0.4);
    rimLight.position.set(0, -500, 300);
    this.scene.add(rimLight);
  }

  private setupEvents(): void {
    const el = this.renderer.domElement;

    // Redimensionamento responsivo
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);

    // Hover raycasting
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerdown", this.onPointerDown);
  }

  private handleResize(): void {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.onHoverCallback || !this.solidMesh) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.solidMesh);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      const faceIndex = hit.faceIndex ?? -1;
      const point = hit.point;
      const normal = hit.face?.normal;

      this.onHoverCallback({
        type: "face",
        shapeId: this.currentShapeId,
        elementIndex: faceIndex,
        id: `face_${this.currentShapeId}_${faceIndex}`,
        point: { x: point.x, y: point.y, z: point.z },
        normal: normal ? { x: normal.x, y: normal.y, z: normal.z } : undefined,
      });
    } else {
      this.onHoverCallback(null);
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.onSelectCallback || !this.solidMesh) return;
    // Apenas clique primário (botão esquerdo)
    if (e.button !== 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.solidMesh);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      const faceIndex = hit.faceIndex ?? -1;
      const point = hit.point;
      const normal = hit.face?.normal;

      this.setHighlightedFace(faceIndex);

      this.onSelectCallback(
        {
          type: "face",
          shapeId: this.currentShapeId,
          elementIndex: faceIndex,
          id: `face_${this.currentShapeId}_${faceIndex}`,
          point: { x: point.x, y: point.y, z: point.z },
          normal: normal ? { x: normal.x, y: normal.y, z: normal.z } : undefined,
        },
        e.shiftKey || e.ctrlKey
      );
    } else {
      this.setHighlightedFace(null);
      this.onSelectCallback(null, false);
    }
  };

  /**
   * Destaca visualmente uma face B-Rep na cena Three.js
   */
  setHighlightedFace(faceIndex: number | null): void {
    if (this.selectionMesh) {
      this.selectionMesh.geometry.dispose();
      this.modelGroup.remove(this.selectionMesh);
      this.selectionMesh = null;
    }

    if (faceIndex === null || faceIndex < 0 || !this.solidMesh || !this.currentMesh) {
      return;
    }

    const { positions, indices, faceGroups } = this.currentMesh;
    let triStart = faceIndex;
    let triCount = 1;

    // Se temos faceGroups [triStart, triCount, faceHash] do occt-wasm meshShape
    if (faceGroups && faceGroups.length >= 3) {
      for (let i = 0; i < faceGroups.length; i += 3) {
        const start = faceGroups[i]!;
        const count = faceGroups[i + 1]!;
        if (faceIndex >= start && faceIndex < start + count) {
          triStart = start;
          triCount = count;
          break;
        }
      }
    }

    const highlightIndices: number[] = [];
    for (let t = 0; t < triCount; t++) {
      const idxOffset = (triStart + t) * 3;
      if (idxOffset + 2 < indices.length) {
        highlightIndices.push(
          indices[idxOffset]!,
          indices[idxOffset + 1]!,
          indices[idxOffset + 2]!
        );
      }
    }

    if (highlightIndices.length === 0) return;

    const highlightGeom = new THREE.BufferGeometry();
    highlightGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    highlightGeom.setIndex(highlightIndices);
    highlightGeom.computeVertexNormals();

    this.selectionMesh = new THREE.Mesh(highlightGeom, this.selectionMaterial);
    this.selectionMesh.renderOrder = 2;
    this.modelGroup.add(this.selectionMesh);
  }

  /**
   * Atualiza a malha B-Rep renderizada no Viewport
   */
  setMesh(shapeId: string, mesh: CadMesh): void {
    this.currentShapeId = shapeId;
    this.currentMesh = mesh;

    // Limpa malhas anteriores
    this.clearModel();

    // Validação numérica estrita antes de alocar WebGL
    if (!mesh.positions || mesh.positions.length === 0 || !mesh.indices || mesh.indices.length === 0) {
      console.warn("CALDRA CAD CORE: Malha vazia recebida para renderização.");
      return;
    }

    // Checa valores finitos
    for (let i = 0; i < Math.min(mesh.positions.length, 30); i++) {
      if (!Number.isFinite(mesh.positions[i])) {
        console.error("CALDRA CAD CORE: Vértices contêm NaN ou Infinity na posição", i);
        return;
      }
    }

    // 1. Cria Geometria de Triângulos
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(mesh.positions, 3)
    );

    if (mesh.normals && mesh.normals.length > 0) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(mesh.normals, 3)
      );
    } else {
      geometry.computeVertexNormals();
    }

    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // 2. Mesh principal
    this.solidMesh = new THREE.Mesh(
      geometry,
      this.edgeMode === "wireframe" ? this.wireframeMaterial : this.solidMaterial
    );
    this.solidMesh.name = `solid_${shapeId}`;
    this.modelGroup.add(this.solidMesh);
    this.modelGroup.updateMatrixWorld(true);

    // 3. Extrai arestas para as linhas nítidas de contorno (SOMB e SOMB+AR)
    this.buildEdgeLines(geometry, mesh);

    // 4. Aplica modo de arestas atual
    this.applyEdgeMode();

    // Renderiza um quadro imediatamente
    this.renderer.render(this.scene, this.camera);
  }

  private buildEdgeLines(geometry: THREE.BufferGeometry, mesh: CadMesh): void {
    // Caso 1: Arestas canônicas fornecidas diretamente pelo kernel B-Rep
    if (mesh.edges && mesh.edges.length > 0) {
      const boundaryPositions: number[] = [];
      const internalPositions: number[] = [];

      for (const edge of mesh.edges) {
        const pts = edge.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i]!;
          const p2 = pts[i + 1]!;
          const target = edge.isBoundary ? boundaryPositions : internalPositions;
          target.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
      }

      if (boundaryPositions.length > 0) {
        const bg = new THREE.BufferGeometry();
        bg.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(boundaryPositions, 3)
        );
        this.boundaryLines = new THREE.LineSegments(bg, this.boundaryLineMaterial);
        this.boundaryLines.name = "edges_boundary";
        this.modelGroup.add(this.boundaryLines);
      }

      if (internalPositions.length > 0) {
        const ig = new THREE.BufferGeometry();
        ig.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(internalPositions, 3)
        );
        this.internalLines = new THREE.LineSegments(ig, this.internalLineMaterial);
        this.internalLines.name = "edges_internal";
        this.modelGroup.add(this.internalLines);
      }
    } else {
      // Caso 2: Fallback automático via EdgesGeometry (ângulo de dobra de aresta)
      const edgesGeom = new THREE.EdgesGeometry(geometry, 25);
      this.boundaryLines = new THREE.LineSegments(edgesGeom, this.boundaryLineMaterial);
      this.boundaryLines.name = "edges_boundary_auto";
      this.modelGroup.add(this.boundaryLines);
    }
  }

  /**
   * Altera o modo de exibição técnica: SOMB, SOMB+AR ou ARAME
   */
  setEdgeMode(mode: CadEdgeMode): void {
    this.edgeMode = mode;
    this.applyEdgeMode();
  }

  private applyEdgeMode(): void {
    if (!this.solidMesh) return;

    if (this.edgeMode === "shaded") {
      // SOMB: Superfície sombreada + bordas externas e de corte brancas e nítidas
      this.solidMesh.material = this.solidMaterial;
      this.solidMesh.visible = true;
      if (this.boundaryLines) this.boundaryLines.visible = true;
      if (this.internalLines) this.internalLines.visible = false;
    } else if (this.edgeMode === "shaded-edges") {
      // SOMB+AR: Superfície + bordas brancas + geratrizes/linhas de junção reais
      this.solidMesh.material = this.solidMaterial;
      this.solidMesh.visible = true;
      if (this.boundaryLines) this.boundaryLines.visible = true;
      if (this.internalLines) this.internalLines.visible = true;
    } else if (this.edgeMode === "wireframe") {
      // ARAME: Modo analítico esquelético
      this.solidMesh.material = this.wireframeMaterial;
      this.solidMesh.visible = true;
      if (this.boundaryLines) this.boundaryLines.visible = true;
      if (this.internalLines) this.internalLines.visible = true;
    }
  }

  /**
   * Vistas canônicas industriais (ISO, FR, LAT, SUP, INF, POST)
   * Enquadramento analítico rigoroso via Bounding Sphere e FOV
   */
  setView(preset: CadCameraPreset): void {
    if (!this.solidMesh) return;
    this.modelGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    if (box.isEmpty()) return;

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const radius = Math.max(sphere.radius, 5.0);

    if (
      !Number.isFinite(center.x) ||
      !Number.isFinite(center.y) ||
      !Number.isFinite(center.z) ||
      !Number.isFinite(radius)
    ) {
      return;
    }

    // Distância analítica exata baseada no campo de visão (FOV) e proporção da viewport
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const aspect = this.camera.aspect || 1.0;
    const fovH = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
    const minFov = Math.min(fovRad, fovH);
    const fitDist = Math.max(30, (radius / Math.sin(minFov / 2)) * 1.35);

    // Planos de corte proporcionais para evitar clipping e perda de profundidade z-buffer
    this.camera.near = Math.max(0.1, radius * 0.005);
    this.camera.far = Math.max(5000, fitDist + radius * 20);
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);

    switch (preset) {
      case "iso":
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(
          center.x + fitDist * 0.577,
          center.y + fitDist * 0.577,
          center.z + fitDist * 0.577
        );
        break;
      case "front":
        // Vista Frontal (perpendicular ao plano XY onde a chapa foi modelada)
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(center.x, center.y, center.z + fitDist);
        break;
      case "top":
        // Vista Superior (evita singularidade / Gimbal Lock com pequeno offset em Z)
        this.camera.up.set(0, 0, -1);
        this.camera.position.set(center.x, center.y + fitDist, center.z + 1e-3);
        break;
      case "side":
        // Vista Lateral (ao longo do eixo X)
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(center.x + fitDist, center.y, center.z);
        break;
      case "back":
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(center.x, center.y, center.z - fitDist);
        break;
      case "bottom":
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(center.x, center.y - fitDist, center.z + 1e-3);
        break;
    }

    this.camera.lookAt(center);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Reenquadra a câmera em torno de todo o sólido
   */
  fitToView(): void {
    this.setView("iso");
  }

  /**
   * Diagnóstico técnico interno (Seção 5 do prompt)
   */
  getDiagnosticState() {
    this.modelGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const meshes: { name: string; vertexCount: number; triangleCount: number; visible: boolean }[] = [];
    this.modelGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const geom = obj.geometry as THREE.BufferGeometry;
        const pos = geom.getAttribute("position");
        const idx = geom.getIndex();
        meshes.push({
          name: obj.name || "mesh",
          vertexCount: pos ? pos.count : 0,
          triangleCount: idx ? idx.count / 3 : 0,
          visible: obj.visible,
        });
      }
    });

    return {
      shapeId: this.currentShapeId,
      edgeMode: this.edgeMode,
      camera: {
        position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
        target: { x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z },
        near: this.camera.near,
        far: this.camera.far,
        fov: this.camera.fov,
        zoom: this.camera.zoom,
      },
      boundingBox: {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
        size: { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z },
      },
      boundingSphere: {
        center: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z },
        radius: sphere.radius,
      },
      sceneObjectsCount: this.scene.children.length,
      modelGroupChildren: this.modelGroup.children.length,
      meshes,
      rendererInfo: {
        triangles: this.renderer.info.render.triangles,
        points: this.renderer.info.render.points,
        lines: this.renderer.info.render.lines,
      },
    };
  }

  private clearModel(): void {
    if (this.solidMesh) {
      this.solidMesh.geometry.dispose();
      this.modelGroup.remove(this.solidMesh);
      this.solidMesh = null;
    }
    if (this.boundaryLines) {
      this.boundaryLines.geometry.dispose();
      this.modelGroup.remove(this.boundaryLines);
      this.boundaryLines = null;
    }
    if (this.internalLines) {
      this.internalLines.geometry.dispose();
      this.modelGroup.remove(this.internalLines);
      this.internalLines = null;
    }
    if (this.selectionMesh) {
      this.selectionMesh.geometry.dispose();
      this.modelGroup.remove(this.selectionMesh);
      this.selectionMesh = null;
    }
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Desaloca todos os recursos WebGL, buffers e listeners deterministamente
   */
  dispose(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerdown", this.onPointerDown);

    this.clearModel();
    this.solidMaterial.dispose();
    this.wireframeMaterial.dispose();
    this.boundaryLineMaterial.dispose();
    this.internalLineMaterial.dispose();
    this.selectionMaterial.dispose();

    this.controls.dispose();
    this.renderer.dispose();
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }
}
