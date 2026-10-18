/**
 * MOTOR 3D CALDRA — Three.js / WebGL.
 *
 * Sólidos reais (faces, volume, espessura, sombra) construídos a partir das
 * INSTÂNCIAS derivadas do resultado canônico. Nenhum parâmetro é recalculado
 * aqui: o motor só apresenta. Renderização sob demanda (sem loop contínuo),
 * geometria e materiais reaproveitados.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SolidInstance } from "@/lib/project-catalog/instances";
import { explodeDirection } from "@/lib/project-catalog/instances";
import { cn } from "@/lib/utils";

export type ViewKey =
  "iso" | "frontal" | "traseira" | "superior" | "inferior" | "esquerda" | "direita";

const S = 0.001; // mm → m

const DIRS: Record<ViewKey, [number, number, number]> = {
  iso: [1, 0.8, 1],
  frontal: [0, 0, 1],
  traseira: [0, 0, -1],
  superior: [0, 1, 0.001],
  inferior: [0, -1, 0.001],
  esquerda: [-1, 0, 0],
  direita: [1, 0, 0],
};

/** Modo de exibição industrial: sombreado, sombreado com arestas, ou arame. */
export type DisplayMode = "shaded" | "edges" | "wireframe";

type Props = {
  instances: SolidInstance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  explode: number;
  hidden: Set<string>;
  isolate: boolean;
  ghost: boolean;
  ortho: boolean;
  view: ViewKey;
  viewNonce: number;
  fitNonce: number;
  /** padrão: arestas visíveis (leitura industrial) */
  display?: DisplayMode;
  /** incrementar para enquadrar apenas a peça selecionada */
  zoomSelNonce?: number;
  /** incrementar para voltar à vista isométrica padrão */
  resetNonce?: number;
  className?: string;
};

export function Model3DViewer({
  instances,
  selectedId,
  onSelect,
  explode,
  hidden,
  isolate,
  ghost,
  ortho,
  view,
  viewNonce,
  fitNonce,
  display = "edges",
  zoomSelNonce = 0,
  resetNonce = 0,
  className,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    persp: THREE.PerspectiveCamera;
    ortho: THREE.OrthographicCamera;
    controls: OrbitControls;
    meshes: THREE.Mesh[];
    ground: THREE.Mesh;
    request: () => void;
    fit: (dir?: [number, number, number], animate?: boolean, only?: THREE.Object3D) => void;
    setCamera: (o: boolean) => void;
  } | null>(null);

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /* materiais e geometria únicos, reaproveitados por todas as peças */
  const shared = useMemo(() => {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const mk = (color: number, rough: number, metal: number) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    return {
      boxGeo,
      mats: {
        aco: mk(0x9aa4ad, 0.45, 0.75),
        "aco-pintado": mk(0x5d6874, 0.7, 0.25),
        aluminio: mk(0xc3c9cf, 0.35, 0.85),
      } as Record<string, THREE.MeshStandardMaterial>,
      selected: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.35,
        metalness: 0.5,
        emissive: 0x3a2400,
      }),
      ghost: new THREE.MeshStandardMaterial({
        color: 0x8a929b,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
      boxEdges: new THREE.EdgesGeometry(boxGeo, 25),
      edgeMat: new THREE.LineBasicMaterial({ color: 0x1b2026, transparent: true, opacity: 0.55 }),
      wire: new THREE.MeshBasicMaterial({ color: 0x8d979f, wireframe: true }),
    };
  }, []);

  /* montagem única do renderizador */
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x20242a, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 60;
    const cam = key.shadow.camera as THREE.OrthographicCamera;
    cam.left = -8;
    cam.right = 8;
    cam.top = 8;
    cam.bottom = -8;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(40, 40, 0x4c545c, 0x2c3238);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);
    const axes = new THREE.AxesHelper(0.6);
    scene.add(axes);

    const persp = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
    const orthoCam = new THREE.OrthographicCamera(-5, 5, 5, -5, -200, 400);
    persp.position.set(6, 5, 6);
    orthoCam.position.set(6, 5, 6);

    const controls = new OrbitControls(persp, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;

    let raf = 0;
    let anim: {
      from: THREE.Vector3;
      to: THREE.Vector3;
      t0: number;
      target: THREE.Vector3;
      fromT: THREE.Vector3;
    } | null = null;
    const state = { camera: persp as THREE.Camera };

    const draw = () => {
      renderer.render(scene, state.camera);
    };
    const request = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        controls.update();
        draw();
      });
    };
    controls.addEventListener("change", request);

    const tickAnim = () => {
      if (!anim) return;
      const k = Math.min(1, (performance.now() - anim.t0) / 420);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const pos = anim.from.clone().lerp(anim.to, e);
      const tgt = anim.fromT.clone().lerp(anim.target, e);
      persp.position.copy(pos);
      orthoCam.position.copy(pos);
      controls.target.copy(tgt);
      controls.update();
      draw();
      if (k < 1) requestAnimationFrame(tickAnim);
      else anim = null;
    };

    const bounds = (only?: THREE.Object3D) => {
      const bb = new THREE.Box3();
      if (only) return bb.expandByObject(only);
      let has = false;
      for (const m of apiObj.meshes) {
        if (!m.visible) continue;
        bb.expandByObject(m);
        has = true;
      }
      if (!has) bb.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(2, 2, 2));
      return bb;
    };

    const fit = (dir?: [number, number, number], animate = true, only?: THREE.Object3D) => {
      const bb = bounds(only);

      const center = bb.getCenter(new THREE.Vector3());
      const radius = Math.max(0.5, bb.getBoundingSphere(new THREE.Sphere()).radius);
      const d = new THREE.Vector3(
        ...(dir ?? [
          persp.position.x - controls.target.x,
          persp.position.y - controls.target.y,
          persp.position.z - controls.target.z,
        ]),
      ).normalize();
      const dist = (radius / Math.sin((persp.fov * Math.PI) / 360)) * 0.95;
      const to = center.clone().add(d.multiplyScalar(dist));
      const frustum = radius * 1.25;
      orthoCam.left = -frustum;
      orthoCam.right = frustum;
      orthoCam.top = frustum;
      orthoCam.bottom = -frustum;
      orthoCam.updateProjectionMatrix();
      if (animate) {
        anim = {
          from: persp.position.clone(),
          to,
          t0: performance.now(),
          target: center,
          fromT: controls.target.clone(),
        };
        requestAnimationFrame(tickAnim);
      } else {
        persp.position.copy(to);
        orthoCam.position.copy(to);
        controls.target.copy(center);
        controls.update();
        draw();
      }
    };

    const setCamera = (o: boolean) => {
      state.camera = o ? orthoCam : persp;
      orthoCam.position.copy(persp.position);
      orthoCam.up.copy(persp.up);
      controls.object = state.camera as THREE.PerspectiveCamera;
      controls.update();
      draw();
    };

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
      const a = w / h;
      const span = (orthoCam.top - orthoCam.bottom) / 2;
      orthoCam.left = -span * a;
      orthoCam.right = span * a;
      orthoCam.updateProjectionMatrix();
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    /* seleção por raycast (clique curto, sem arrastar) */
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (ev: PointerEvent) => {
      down = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = (ev: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      const pt = new THREE.Vector2(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pt, state.camera as THREE.PerspectiveCamera);
      const hits = ray.intersectObjects(
        apiObj.meshes.filter((m) => m.visible),
        false,
      );
      const hit = hits[0]?.object as THREE.Mesh | undefined;
      onSelectRef.current(hit ? (hit.userData["id"] as string) : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onLost = (ev: Event) => ev.preventDefault();
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    const apiObj = {
      renderer,
      scene,
      persp,
      ortho: orthoCam,
      controls,
      meshes: [] as THREE.Mesh[],
      ground,
      request,
      fit,
      setCamera,
    };
    api.current = apiObj;
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
  }, []);

  /* (re)construção dos sólidos quando a geometria paramétrica muda */
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    for (const m of a.meshes) {
      a.scene.remove(m);
      const edges = m.children[0] as THREE.LineSegments | undefined;
      if (edges && m.userData["own"]) edges.geometry.dispose();
      if (m.userData["own"]) m.geometry.dispose();
    }
    a.meshes = [];
    for (const inst of instances) {
      /* malha 3D canônica customizada, perfil real extrudado ou caixa canônica */
      let geo: THREE.BufferGeometry = shared.boxGeo;
      let own = false;
      if (inst.meshVertices && inst.meshVertices.length >= 9) {
        const customGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(inst.meshVertices.map((v) => v * S));
        customGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        if (inst.meshIndices && inst.meshIndices.length >= 3) {
          customGeo.setIndex(inst.meshIndices);
        }
        customGeo.computeVertexNormals();
        geo = customGeo;
        own = true;
      } else if (inst.shape && inst.shape.outline.length > 2) {
        const shape = new THREE.Shape(
          inst.shape.outline.map((p) => new THREE.Vector2(p.x * S, p.y * S)),
        );
        for (const hole of inst.shape.holes) {
          if (hole.length > 2)
            shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x * S, p.y * S))));
        }
        const depth = Math.max(inst.size.z, 0.2) * S;
        geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);

        own = true;
      }
      const mesh = new THREE.Mesh(geo, shared.mats[inst.material] ?? shared.mats["aco"]!);
      mesh.userData["own"] = own;
      if (!own)
        mesh.scale.set(
          Math.max(inst.size.x, 1) * S,
          Math.max(inst.size.y, 1) * S,
          Math.max(inst.size.z, 1) * S,
        );
      mesh.rotation.set(inst.rotX ?? 0, inst.rotY ?? 0, inst.rotZ ?? 0);
      mesh.userData["id"] = inst.id;
      mesh.userData["base"] = [inst.center.x * S, inst.center.y * S, inst.center.z * S];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      /* arestas reais: geometria compartilhada nas caixas, própria nos perfis */
      const line = new THREE.LineSegments(
        own ? new THREE.EdgesGeometry(geo, 25) : shared.boxEdges,
        shared.edgeMat,
      );
      line.userData["edges"] = true;
      mesh.add(line);
      a.scene.add(mesh);
      a.meshes.push(mesh);
    }
    a.fit(DIRS.iso, false);
  }, [instances, shared]);

  /* explosão, visibilidade, isolamento, destaque e modo de exibição */
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const byId = new Map(instances.map((i) => [i.id, i] as const));
    const selInst = selectedId ? byId.get(selectedId) : null;
    for (const mesh of a.meshes) {
      const id = mesh.userData["id"] as string;
      const inst = byId.get(id);
      if (!inst) continue;
      const base = mesh.userData["base"] as [number, number, number];
      const d = explodeDirection(inst.assemblyKey);
      const k = explode * 0.9;
      mesh.position.set(base[0] + d.x * k, base[1] + d.y * k, base[2] + d.z * k);
      const isSel = id === selectedId;
      const sameKey = selInst ? inst.partKey === selInst.partKey : false;
      const visible = !hidden.has(inst.partKey) && (!isolate || !selInst || sameKey);
      mesh.visible = visible;
      mesh.material =
        display === "wireframe"
          ? shared.wire
          : isSel
            ? shared.selected
            : ghost && selInst && !sameKey
              ? shared.ghost
              : (shared.mats[inst.material] ?? shared.mats["aco"]!);
      mesh.castShadow = display !== "wireframe";
      const line = mesh.children[0] as THREE.LineSegments | undefined;
      if (line) line.visible = display === "edges";
    }
    a.request();
  }, [instances, explode, hidden, isolate, ghost, selectedId, shared, display]);

  useEffect(() => {
    api.current?.setCamera(ortho);
  }, [ortho]);

  useEffect(() => {
    api.current?.fit(DIRS[view], true);
  }, [view, viewNonce]);

  useEffect(() => {
    if (fitNonce > 0) api.current?.fit(undefined, true);
  }, [fitNonce]);

  /* enquadrar somente a peça selecionada */
  useEffect(() => {
    if (zoomSelNonce <= 0) return;
    const a = api.current;
    const mesh = a?.meshes.find((m) => m.userData["id"] === selectedRef.current && m.visible);
    if (a && mesh) a.fit(undefined, true, mesh);
  }, [zoomSelNonce]);

  /* voltar à isométrica padrão */
  useEffect(() => {
    if (resetNonce > 0) api.current?.fit(DIRS.iso, true);
  }, [resetNonce]);

  return <div ref={host} className={cn("relative h-full w-full overflow-hidden", className)} />;
}
