/**
 * CALDRA CAD — ASSEMBLY MATE SOLVER (FASE 06)
 *
 * Solucionador cinemático de restrições de montagem mecânica 3D (Mates).
 * Posiciona componentes instanciados no espaço tridimensional com base em relações:
 * COINCIDENT, PARALLEL, PERPENDICULAR, CONCENTRIC, DISTANCE e ANGLE.
 */

import type { Vector3D } from "../canonical";
import type { AssemblyMate, ComponentInstance, MateStatus } from "./types";

export class MateSolver {
  /**
   * Resolve todas as relações de montagem e atualiza as transformações 3D dos componentes.
   */
  static solve(
    components: ComponentInstance[],
    mates: AssemblyMate[],
  ): {
    updatedComponents: ComponentInstance[];
    updatedMates: AssemblyMate[];
    totalDOFRemaining: number;
  } {
    const compMap = new Map<string, ComponentInstance>();
    components.forEach((c) =>
      compMap.set(c.id, { ...c, position: { ...c.position }, rotation: { ...c.rotation } }),
    );

    // Rastreia graus de liberdade (DOF) para cada componente
    // Cada corpo livre em 3D inicia com 6 DOF (3 de translação + 3 de rotação)
    const dofMap = new Map<string, number>();
    for (const c of components) {
      dofMap.set(c.id, c.isGrounded ? 0 : 6);
    }

    const updatedMates: AssemblyMate[] = [];

    for (const mate of mates) {
      if (mate.isSuppressed) {
        updatedMates.push({ ...mate, status: "UNRESOLVED" });
        continue;
      }

      const target = compMap.get(mate.targetComponentId);
      const ref = compMap.get(mate.referenceComponentId);

      if (!target || !ref) {
        updatedMates.push({ ...mate, status: "UNRESOLVED" });
        continue;
      }

      let status: MateStatus = "SATISFIED";
      let dofRemoved = 0;

      // Se o alvo não estiver fixo (grounded), aplica a transformação cinemática
      if (!target.isGrounded) {
        switch (mate.type) {
          case "COINCIDENT": {
            // Posiciona o alvo em contato coplanar com a referência
            target.position.x = ref.position.x;
            target.position.y = ref.position.y;
            target.position.z = ref.position.z + (mate.offsetMm ?? 0);
            target.rotation.x = ref.rotation.x;
            target.rotation.y = ref.rotation.y;
            target.rotation.z = ref.rotation.z;
            dofRemoved = 3;
            break;
          }

          case "CONCENTRIC": {
            // Alinha o eixo X e Y (centraliza furo com pino/tubo)
            target.position.x = ref.position.x;
            target.position.y = ref.position.y;
            target.rotation.x = ref.rotation.x;
            target.rotation.y = ref.rotation.y;
            dofRemoved = 4;
            break;
          }

          case "DISTANCE": {
            const offset = mate.offsetMm ?? 0;
            target.position.z = ref.position.z + offset;
            dofRemoved = 1;
            break;
          }

          case "PARALLEL": {
            target.rotation.x = ref.rotation.x;
            target.rotation.y = ref.rotation.y;
            dofRemoved = 2;
            break;
          }

          case "PERPENDICULAR": {
            target.rotation.x = ref.rotation.x + 90;
            dofRemoved = 2;
            break;
          }

          case "ANGLE": {
            const angle = mate.angleDeg ?? 0;
            target.rotation.z = ref.rotation.z + angle;
            dofRemoved = 1;
            break;
          }
        }
      }

      const currentDOF = dofMap.get(target.id) ?? 0;
      if (currentDOF - dofRemoved < 0) {
        status = "OVER_CONSTRAINED";
      }
      dofMap.set(target.id, Math.max(0, currentDOF - dofRemoved));

      updatedMates.push({ ...mate, status });
    }

    let totalDOFRemaining = 0;
    dofMap.forEach((dof) => {
      totalDOFRemaining += dof;
    });

    return {
      updatedComponents: Array.from(compMap.values()),
      updatedMates,
      totalDOFRemaining,
    };
  }
}
