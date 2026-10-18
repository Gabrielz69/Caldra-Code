/**
 * NUVEM E VERSÕES — sincronização dos projetos do CHAMFER.
 *
 * Offline-first continua valendo: o localStorage é a fonte de trabalho e a
 * nuvem é um espelho. A resolução de conflito é por `updatedAt` (o mais
 * recente vence) e cada envio pode gravar uma VERSÃO imutável do projeto.
 */

import { supabase } from "@/integrations/supabase/client";
import { listProjects, saveProject, type Project } from "@/lib/lab2d/projects";

export type SyncSummary = {
  uploaded: number;
  downloaded: number;
  skipped: number;
};

export type CloudVersion = {
  id: string;
  label: string;
  createdAt: string;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

type Row = { id: string; local_id: string; name: string; data: unknown; updated_at: string };

const asProject = (row: Row): Project => row.data as Project;

/** Envia e recebe: o lado com `updatedAt` mais novo vence. */
export async function syncProjects(): Promise<SyncSummary | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const local = listProjects();
  const { data, error } = await supabase
    .from("cloud_projects")
    .select("id, local_id, name, data, updated_at")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível falar com a nuvem agora.");

  const remote = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.local_id, r] as const));
  const summary: SyncSummary = { uploaded: 0, downloaded: 0, skipped: 0 };

  for (const p of local) {
    const r = remote.get(p.id);
    const remoteUpdated = r ? (asProject(r).updatedAt ?? 0) : -1;
    if (!r || p.updatedAt > remoteUpdated) {
      await pushProject(p, userId);
      summary.uploaded++;
    } else if (remoteUpdated > p.updatedAt) {
      saveProject(asProject(r));
      summary.downloaded++;
    } else {
      summary.skipped++;
    }
    remote.delete(p.id);
  }

  // projetos que só existem na nuvem (outro aparelho)
  for (const r of remote.values()) {
    saveProject(asProject(r));
    summary.downloaded++;
  }

  return summary;
}

/** Grava/atualiza um projeto na nuvem. */
export async function pushProject(project: Project, userId?: string): Promise<void> {
  const uid = userId ?? (await currentUserId());
  if (!uid) throw new Error("Entre na sua conta para usar a nuvem.");
  const { error } = await supabase
    .from("cloud_projects")
    .upsert(
      { user_id: uid, local_id: project.id, name: project.name, data: project as unknown as never },
      { onConflict: "user_id,local_id" },
    );
  if (error) throw new Error("Falha ao enviar o projeto.");
}

/** Congela o estado atual do projeto como uma versão nomeada. */
export async function saveVersion(project: Project, label: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Entre na sua conta para salvar versões.");
  await pushProject(project, uid);

  const { data, error } = await supabase
    .from("cloud_projects")
    .select("id")
    .eq("user_id", uid)
    .eq("local_id", project.id)
    .maybeSingle();
  if (error || !data) throw new Error("Projeto não encontrado na nuvem.");

  const { error: vErr } = await supabase.from("project_versions").insert({
    project_id: data.id,
    user_id: uid,
    label: label.trim() || new Date().toLocaleString("pt-BR"),
    data: project as unknown as never,
  });
  if (vErr) throw new Error("Falha ao salvar a versão.");
}

/** Lista as versões de um projeto, da mais recente para a mais antiga. */
export async function listVersions(localId: string): Promise<CloudVersion[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data: proj } = await supabase
    .from("cloud_projects")
    .select("id")
    .eq("user_id", uid)
    .eq("local_id", localId)
    .maybeSingle();
  if (!proj) return [];
  const { data } = await supabase
    .from("project_versions")
    .select("id, label, created_at")
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((v) => ({ id: v.id, label: v.label, createdAt: v.created_at }));
}

/** Restaura uma versão sobre o projeto local (mantendo o id local). */
export async function restoreVersion(versionId: string): Promise<Project | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data } = await supabase
    .from("project_versions")
    .select("data")
    .eq("id", versionId)
    .maybeSingle();
  if (!data) return null;
  const project = data.data as unknown as Project;
  saveProject({ ...project, updatedAt: Date.now() });
  return project;
}

/** Remove o projeto da nuvem (o local permanece). */
export async function removeFromCloud(localId: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await supabase.from("cloud_projects").delete().eq("user_id", uid).eq("local_id", localId);
}
