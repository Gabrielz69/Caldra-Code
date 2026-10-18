REVOKE ALL ON FUNCTION public.resolve_entitlement(UUID) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.resolve_entitlement(UUID);

CREATE OR REPLACE FUNCTION public.resolve_entitlement()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
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

REVOKE ALL ON FUNCTION public.resolve_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_entitlement() TO authenticated;