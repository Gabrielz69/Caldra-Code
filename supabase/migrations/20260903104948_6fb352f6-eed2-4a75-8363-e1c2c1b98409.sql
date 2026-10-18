CREATE TABLE public.cloud_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_projects TO authenticated;
GRANT ALL ON public.cloud_projects TO service_role;
ALTER TABLE public.cloud_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY cloud_projects_select_own ON public.cloud_projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cloud_projects_insert_own ON public.cloud_projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY cloud_projects_update_own ON public.cloud_projects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cloud_projects_delete_own ON public.cloud_projects FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER cloud_projects_touch_updated_at
BEFORE UPDATE ON public.cloud_projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.cloud_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_versions TO authenticated;
GRANT ALL ON public.project_versions TO service_role;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_versions_select_own ON public.project_versions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY project_versions_insert_own ON public.project_versions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY project_versions_delete_own ON public.project_versions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX project_versions_project_idx ON public.project_versions (project_id, created_at DESC);