/**
 * GRUPOS — conjunto de entidades que se comporta como uma unidade só na
 * seleção e nas transformações. Não funde geometria, não vira BLOCK no DXF
 * e não altera camada, cor nem classificação dos membros.
 *
 * A pertinência mora na própria entidade (`group`), portanto undo/redo e
 * autosave já cobrem criar, dissolver e mover membros. O registro guarda
 * apenas o nome legível de cada grupo.
 */

import { uid, type Entity } from "./core";

export type GroupDef = { id: string; name: string };

export const membersOf = (entities: Entity[], groupId: string) =>
  entities.filter((e) => e.group === groupId);

export const groupOf = (entities: Entity[], entityId: string) =>
  entities.find((e) => e.id === entityId)?.group;

export function nextGroupName(groups: GroupDef[]): string {
  let n = groups.length + 1;
  const taken = new Set(groups.map((g) => g.name));
  while (taken.has(`Grupo ${n}`)) n++;
  return `Grupo ${n}`;
}

/** Cria um grupo com as entidades indicadas (mín. 2). Sem aninhamento. */
export function createGroup(
  entities: Entity[],
  ids: string[],
  groups: GroupDef[],
): { entities: Entity[]; groups: GroupDef[]; id: string } | null {
  const unique = Array.from(new Set(ids));
  if (unique.length < 2) return null;
  const id = uid();
  const def: GroupDef = { id, name: nextGroupName(groups) };
  return {
    id,
    groups: [...groups, def],
    entities: entities.map((e) => (unique.includes(e.id) ? { ...e, group: id } : e)),
  };
}

export function dissolveGroup(entities: Entity[], groups: GroupDef[], groupId: string) {
  return {
    entities: entities.map((e) => {
      if (e.group !== groupId) return e;
      const { group: _drop, ...rest } = e;
      return rest as Entity;
    }),
    groups: groups.filter((g) => g.id !== groupId),
  };
}

export const addToGroup = (entities: Entity[], ids: string[], groupId: string): Entity[] =>
  entities.map((e) => (ids.includes(e.id) ? { ...e, group: groupId } : e));

export const removeFromGroup = (entities: Entity[], ids: string[]): Entity[] =>
  entities.map((e) => {
    if (!ids.includes(e.id)) return e;
    const { group: _drop, ...rest } = e;
    return rest as Entity;
  });

export const renameGroup = (groups: GroupDef[], groupId: string, name: string): GroupDef[] =>
  groups.map((g) => (g.id === groupId ? { ...g, name: name.trim() || g.name } : g));

/** Expande a seleção para todos os membros dos grupos envolvidos. */
export function expandSelection(entities: Entity[], ids: string[]): string[] {
  const gids = new Set(
    ids.map((id) => entities.find((e) => e.id === id)?.group).filter(Boolean) as string[],
  );
  if (!gids.size) return ids;
  const out = new Set(ids);
  for (const e of entities) if (e.group && gids.has(e.group)) out.add(e.id);
  return [...out];
}

/** Remove do registro grupos que ficaram sem membros (após excluir peças). */
export function pruneGroups(entities: Entity[], groups: GroupDef[]): GroupDef[] {
  const live = new Set(entities.map((e) => e.group).filter(Boolean) as string[]);
  return groups.filter((g) => live.has(g.id));
}
