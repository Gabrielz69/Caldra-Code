/**
 * CALDRA ORGANIC LIGHT FIELD — Motor Autônomo de Massas de Luz Vivas
 *
 * Características:
 *  - Massas 100% autônomas flutuando e navegando livremente em espaço 2D.
 *  - ZERO rotação angular em torno do centro (sem efeito catavento, hélice ou vórtice).
 *  - Cada massa possui seu próprio vetor de deslocamento de longo alcance (Ponto A → Ponto B → Ponto C).
 *  - Curvatura suave e orgânica via splines Bézier com aceleração e desaceleração naturais.
 *  - Cobertura completa de 100% da viewport (cantos, bordas, centro, diagonais e travessias completas).
 *  - Entrada e saída suave pelas bordas (-12% a 115%).
 *  - Fusão e separação naturais: ao cruzarem trajetórias próximas, os halos se fundem e expandem
 *    suavemente em escala, sem sofrer giro angular ou empurrão artificial.
 *  - 100% desacoplado do ciclo de render do React: 0 re-renders, mutações diretas
 *    no compositor GPU dos 5 nós DOM persistentes.
 */

export interface AutonomousFieldRefs {
  container: HTMLElement | null;
  delta: HTMLElement | null;
  beta: HTMLElement | null;
  alpha: HTMLElement | null;
  gama: HTMLElement | null;
  epsilon: HTMLElement | null;
}

interface MassVoyage {
  id: string;
  widthVmax: number;
  heightVmax: number;
  // Coordenadas da perna atual em espaço normalizado da tela [-0.12, 1.15]
  p0x: number;
  p0y: number;
  p1x: number; // ponto de controle da curva Bézier
  p1y: number;
  p2x: number; // destino final da perna
  p2y: number;
  // Temporização e progresso
  legElapsed: number;
  legDuration: number;
  lingerElapsed: number;
  lingerDuration: number;
  isLingering: boolean;
  // Posição atual calculada
  currentX: number;
  currentY: number;
  // Parâmetros de micro-ondulação orgânica independente
  noisePhaseX: number;
  noisePhaseY: number;
  noiseSpeed: number;
  noiseAmp: number;
  // Expansão elástica suave durante fusão com outra massa
  proximityScale: number;
  // Escala gradual do estado de processamento de IA (sem saltos de layout)
  aiScale: number;
  // Elemento DOM
  element: HTMLElement;
}

function pickNextWaypoint(
  currentX: number,
  currentY: number,
  isProcessing: boolean,
  entityId: string
): { p2x: number; p2y: number; p1x: number; p1y: number; duration: number; linger: number } {
  let targetX = 0;
  let targetY = 0;

  if (isProcessing && (entityId === "alpha" || entityId === "beta" || entityId === "epsilon")) {
    // Modo de processamento: massas superiores viajam suavemente pela metade superior
    targetX = -0.04 + Math.random() * 1.08;
    targetY = -0.06 + Math.random() * 0.40;
  } else {
    // Deslocamento de longo alcance livre por toda a tela [-0.12 a 1.14]
    // Garante que o destino P2 fique a uma distância real e substancial de P0
    let attempts = 0;
    do {
      targetX = -0.12 + Math.random() * 1.24;
      targetY = -0.12 + Math.random() * 1.24;
      attempts++;
    } while (attempts < 12 && Math.hypot(targetX - currentX, targetY - currentY) < 0.38);
  }

  // Ponto de controle P1 intermediário para gerar arco curvo suave e orgânico
  const midX = (currentX + targetX) * 0.5;
  const midY = (currentY + targetY) * 0.5;

  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const dist = Math.hypot(dx, dy);

  // Vetor perpendicular normalizado
  const len = dist > 0.001 ? dist : 1;
  const nx = -dy / len;
  const ny = dx / len;

  // Curvatura com sinal aleatório e amplitude suave (14% a 28% da distância)
  const sign = Math.random() < 0.5 ? -1 : 1;
  const curveMagnitude = dist * (0.14 + Math.random() * 0.18) * sign;

  const p1x = midX + nx * curveMagnitude;
  const p1y = midY + ny * curveMagnitude;

  // Duração calculada a partir da distância percorrida para manter velocidade nobre e cinematográfica
  const speedFactors: Record<string, number> = {
    delta: 0.022,    // majestosa, serena (32–48s)
    beta: 0.032,     // fluida e constante (22–34s)
    alpha: 0.036,    // ampla e envolvente (20–30s)
    gama: 0.030,     // transversal elegante (24–36s)
    epsilon: 0.054,  // ágil, livre e rápida (14–22s)
  };

  const speed = speedFactors[entityId] || 0.032;
  const duration = Math.max(14, dist / speed);
  const linger = 1.0 + Math.random() * 3.5;

  return { p2x: targetX, p2y: targetY, p1x, p1y, duration, linger };
}

export interface AutonomousFieldController {
  stop: () => void;
  update: (opts: { isAnimated?: boolean; isProcessing?: boolean }) => void;
}

export function startAutonomousField(
  refs: AutonomousFieldRefs,
  options: { isAnimated: boolean; isProcessing: boolean }
): AutonomousFieldController {
  const container = refs.container;
  if (!container) {
    return {
      stop: () => {},
      update: () => {},
    };
  }

  const elementsMap: Record<string, HTMLElement | null> = {
    delta: refs.delta,
    beta: refs.beta,
    alpha: refs.alpha,
    gama: refs.gama,
    epsilon: refs.epsilon,
  };

  let currentIsAnimated = options.isAnimated;
  let currentIsProcessing = options.isProcessing;

  const voyages: MassVoyage[] = [];

  // Posições iniciais intencionalmente assimétricas e espalhadas por diferentes quadrantes
  const specs = [
    { id: "delta", widthVmax: 76, heightVmax: 64, startX: 0.14, startY: 0.16, noiseSpeed: 0.18, noiseAmp: 0.022 },
    { id: "beta", widthVmax: 60, heightVmax: 52, startX: 0.82, startY: 0.74, noiseSpeed: 0.24, noiseAmp: 0.028 },
    { id: "alpha", widthVmax: 56, heightVmax: 48, startX: 0.20, startY: 0.72, noiseSpeed: 0.28, noiseAmp: 0.030 },
    { id: "gama", widthVmax: 50, heightVmax: 42, startX: 0.76, startY: 0.24, noiseSpeed: 0.22, noiseAmp: 0.026 },
    { id: "epsilon", widthVmax: 36, heightVmax: 30, startX: 0.52, startY: 0.10, noiseSpeed: 0.42, noiseAmp: 0.038 },
  ];

  for (const s of specs) {
    const el = elementsMap[s.id];
    if (!el) continue;

    const wp = pickNextWaypoint(s.startX, s.startY, currentIsProcessing, s.id);

    voyages.push({
      id: s.id,
      widthVmax: s.widthVmax,
      heightVmax: s.heightVmax,
      p0x: s.startX,
      p0y: s.startY,
      p1x: wp.p1x,
      p1y: wp.p1y,
      p2x: wp.p2x,
      p2y: wp.p2y,
      legElapsed: 0,
      legDuration: wp.duration,
      lingerElapsed: 0,
      lingerDuration: wp.linger,
      isLingering: false,
      currentX: s.startX,
      currentY: s.startY,
      noisePhaseX: Math.random() * Math.PI * 2,
      noisePhaseY: Math.random() * Math.PI * 2,
      noiseSpeed: s.noiseSpeed,
      noiseAmp: s.noiseAmp,
      proximityScale: 1.0,
      aiScale: 1.0,
      element: el,
    });
  }

  if (voyages.length === 0) {
    return {
      stop: () => {},
      update: () => {},
    };
  }

  let animId = 0;
  let lastTime = performance.now();
  let totalTime = 0;
  let isRunning = true;

  const frame = (now: number) => {
    if (!isRunning) return;

    let dt = (now - lastTime) / 1000;
    lastTime = now;

    if (dt > 0.1) dt = 0.1;
    if (dt < 0.001) dt = 0.001;

    totalTime += dt;

    const width = container.clientWidth || window.innerWidth || 1000;
    const height = container.clientHeight || window.innerHeight || 800;
    const vmax = Math.max(width, height);

    if (currentIsAnimated) {
      // 1. Atualizar trajetórias Bézier de cada massa
      for (const v of voyages) {
        if (v.isLingering) {
          v.lingerElapsed += dt;

          // Micro-respiração no local durante a pausa suave
          const nx = Math.sin(totalTime * v.noiseSpeed + v.noisePhaseX) * v.noiseAmp;
          const ny = Math.cos(totalTime * v.noiseSpeed * 0.8 + v.noisePhaseY) * v.noiseAmp;
          v.currentX = v.p2x + nx;
          v.currentY = v.p2y + ny;

          // Ao término do repouso, inicia nova jornada de longo alcance
          if (v.lingerElapsed >= v.lingerDuration) {
            v.isLingering = false;
            v.p0x = v.p2x;
            v.p0y = v.p2y;
            const nextWp = pickNextWaypoint(v.p0x, v.p0y, currentIsProcessing, v.id);
            v.p1x = nextWp.p1x;
            v.p1y = nextWp.p1y;
            v.p2x = nextWp.p2x;
            v.p2y = nextWp.p2y;
            v.legElapsed = 0;
            v.legDuration = nextWp.duration;
            v.lingerDuration = nextWp.linger;
          }
        } else {
          v.legElapsed += dt;
          const t = Math.min(1.0, v.legElapsed / v.legDuration);

          // Easing cúbico natural (aceleração suave, cruzeiro constante, desaceleração suave)
          const s = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          // Curva Bézier quadrática contínua
          const bx = (1 - s) * (1 - s) * v.p0x + 2 * (1 - s) * s * v.p1x + s * s * v.p2x;
          const by = (1 - s) * (1 - s) * v.p0y + 2 * (1 - s) * s * v.p1y + s * s * v.p2y;

          // Micro-ondulação orgânica sobreposta
          const nx = Math.sin(totalTime * v.noiseSpeed + v.noisePhaseX) * v.noiseAmp;
          const ny = Math.cos(totalTime * v.noiseSpeed * 0.8 + v.noisePhaseY) * v.noiseAmp;

          v.currentX = bx + nx;
          v.currentY = by + ny;

          if (t >= 1.0) {
            v.isLingering = true;
            v.lingerElapsed = 0;
          }
        }
      }

      // 2. Fusão e deformação luminosa quando massas se aproximam livremente
      for (let i = 0; i < voyages.length; i++) {
        for (let j = i + 1; j < voyages.length; j++) {
          const a = voyages[i];
          const b = voyages[j];
          const dx = b.currentX - a.currentX;
          const dy = b.currentY - a.currentY;
          const dist = Math.hypot(dx, dy);
          const fusionRadius = 0.32; // raio de fusão em espaço normalizado

          if (dist < fusionRadius && dist > 0.001) {
            const proximity = 1.0 - dist / fusionRadius;
            // Expansão suave de halo conjunto (sensação de poça de luz maior ao se fundirem)
            const targetScale = 1.0 + proximity * 0.16;
            if (targetScale > a.proximityScale) a.proximityScale = targetScale;
            if (targetScale > b.proximityScale) b.proximityScale = targetScale;
          }
        }
      }

      // 3. Relaxamento elástico da escala após separação e escala gradual de IA (sem layout jump)
      for (const v of voyages) {
        v.proximityScale += (1.0 - v.proximityScale) * Math.min(1.0, dt * 1.8);
        const targetAi = (currentIsProcessing && (v.id === "alpha" || v.id === "beta" || v.id === "epsilon")) ? 1.08 : 1.0;
        v.aiScale += (targetAi - v.aiScale) * Math.min(1.0, dt * 1.4);
      }
    }

    // 4. Aplicação direta no compositor GPU (ZERO ROTAÇÃO, ZERO CATAVENTO)
    for (const v of voyages) {
      const massW = (v.widthVmax * vmax) / 100;
      const massH = (v.heightVmax * vmax) / 100;

      const px = v.currentX * width - massW * 0.5;
      const py = v.currentY * height - massH * 0.5;

      const scale = (v.proximityScale * v.aiScale).toFixed(3);

      // Translação pura e escala orgânica: NENHUM rotate(...) aplicado
      v.element.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) scale(${scale})`;
    }

    animId = requestAnimationFrame(frame);
  };

  animId = requestAnimationFrame(frame);

  return {
    stop: () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    },
    update: (opts: { isAnimated?: boolean; isProcessing?: boolean }) => {
      if (opts.isAnimated !== undefined) {
        currentIsAnimated = opts.isAnimated;
      }
      if (opts.isProcessing !== undefined && opts.isProcessing !== currentIsProcessing) {
        currentIsProcessing = opts.isProcessing;

        // Redirecionamento suave e contínuo sem nenhum salto ou teleportação
        for (const v of voyages) {
          v.p0x = v.currentX;
          v.p0y = v.currentY;
          const nextWp = pickNextWaypoint(v.p0x, v.p0y, currentIsProcessing, v.id);
          v.p1x = nextWp.p1x;
          v.p1y = nextWp.p1y;
          v.p2x = nextWp.p2x;
          v.p2y = nextWp.p2y;
          v.legElapsed = 0;
          v.legDuration = currentIsProcessing ? nextWp.duration * 0.75 : nextWp.duration;
          v.lingerDuration = nextWp.linger;
          v.isLingering = false;
        }
      }
    },
  };
}
