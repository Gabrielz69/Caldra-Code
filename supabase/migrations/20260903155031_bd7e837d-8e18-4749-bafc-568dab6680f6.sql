CREATE TABLE IF NOT EXISTS public.usage_vectorizations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

GRANT SELECT ON public.usage_vectorizations TO authenticated;
GRANT ALL ON public.usage_vectorizations TO service_role;

ALTER TABLE public.usage_vectorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_vectorizations_select_own ON public.usage_vectorizations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sp_today()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;

CREATE OR REPLACE FUNCTION public.consume_vectorization(_local integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := public.sp_today();
  _count integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sem_sessao');
  END IF;

  INSERT INTO public.usage_vectorizations AS u (user_id, day, count)
  VALUES (_uid, _day, GREATEST(COALESCE(_local, 0), 0) + 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET count = GREATEST(u.count, GREATEST(COALESCE(_local, 0), 0)) + 1,
        updated_at = now()
  RETURNING u.count INTO _count;

  RETURN jsonb_build_object('ok', true, 'day', _day, 'count', _count);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_vectorizations(_local integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := public.sp_today();
  _count integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sem_sessao');
  END IF;

  INSERT INTO public.usage_vectorizations AS u (user_id, day, count)
  VALUES (_uid, _day, GREATEST(COALESCE(_local, 0), 0))
  ON CONFLICT (user_id, day) DO UPDATE
    SET count = GREATEST(u.count, GREATEST(COALESCE(_local, 0), 0)),
        updated_at = now()
  RETURNING u.count INTO _count;

  RETURN jsonb_build_object('ok', true, 'day', _day, 'count', _count);
END;
$$;