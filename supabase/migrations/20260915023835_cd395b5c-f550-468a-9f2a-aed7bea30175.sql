CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google_play',
  product_id TEXT NOT NULL,
  purchase_token TEXT,
  linked_purchase_token TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  entitlement TEXT NOT NULL DEFAULT 'FREE',
  start_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  environment TEXT NOT NULL DEFAULT 'test',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_provider_token_key
  ON public.subscriptions (provider, purchase_token)
  WHERE purchase_token IS NOT NULL;

CREATE INDEX subscriptions_user_idx ON public.subscriptions (user_id);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY subscriptions_insert_own ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY subscriptions_update_own ON public.subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.resolve_entitlement(_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.subscriptions%ROWTYPE;
  _plan TEXT := 'free';
  _source TEXT := 'none';
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sem_sessao');
  END IF;

  SELECT * INTO _row
  FROM public.subscriptions
  WHERE user_id = _user_id
    AND entitlement = 'PRO'
    AND status IN ('ACTIVE', 'IN_GRACE_PERIOD', 'CANCELED', 'ON_HOLD', 'PAUSED')
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY expires_at DESC NULLS FIRST, updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    _plan := 'pro';
    _source := 'play';
  ELSE
    SELECT CASE WHEN p.plan IN ('pro', 'mestre', 'oficina')
                 AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now())
                THEN 'pro' ELSE 'free' END,
           p.plan_source
      INTO _plan, _source
      FROM public.profiles p
     WHERE p.id = _user_id;
    _plan := COALESCE(_plan, 'free');
    _source := COALESCE(_source, 'none');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan', _plan,
    'source', _source,
    'status', COALESCE(_row.status, 'NONE'),
    'product_id', _row.product_id,
    'expires_at', _row.expires_at,
    'auto_renew', COALESCE(_row.auto_renew, false),
    'last_verified_at', _row.last_verified_at,
    'environment', COALESCE(_row.environment, 'test')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_entitlement(UUID) TO authenticated;