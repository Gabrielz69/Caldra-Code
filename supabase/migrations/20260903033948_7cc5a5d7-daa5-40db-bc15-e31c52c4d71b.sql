-- ============ PERFIS ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  plan_source TEXT NOT NULL DEFAULT 'none' CHECK (plan_source IN ('none','code','play','manual')),
  plan_expires_at TIMESTAMPTZ,
  analytics_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- perfil criado automaticamente no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CÓDIGOS DE ATIVAÇÃO ============
CREATE TABLE public.activation_codes (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','usado','revogado')),
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro')),
  note TEXT,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sem GRANT para anon/authenticated: só o resgate via função protegida enxerga
GRANT ALL ON public.activation_codes TO service_role;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.redeem_activation_code(_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _norm TEXT := upper(btrim(_code));
  _row public.activation_codes%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sem_sessao');
  END IF;

  -- resgate atômico: só troca de 'ativo' para 'usado' uma única vez
  UPDATE public.activation_codes
     SET status = 'usado', used_by = _uid, used_at = now()
   WHERE code = _norm AND status = 'ativo'
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.activation_codes WHERE code = _norm) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'ja_usado');
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;

  INSERT INTO public.profiles (id, plan, plan_source)
  VALUES (_uid, _row.plan, 'code')
  ON CONFLICT (id) DO UPDATE
    SET plan = EXCLUDED.plan, plan_source = 'code', plan_expires_at = NULL;

  RETURN jsonb_build_object('ok', true, 'plan', _row.plan);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(TEXT) TO authenticated;

-- ============ COMPRAS ============
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store TEXT NOT NULL CHECK (store IN ('play','web')),
  product_id TEXT NOT NULL,
  purchase_token TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada','expirada')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX purchases_token_unique ON public.purchases (purchase_token) WHERE purchase_token IS NOT NULL;
CREATE INDEX purchases_user_idx ON public.purchases (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select_own" ON public.purchases
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "purchases_insert_own" ON public.purchases
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "purchases_update_own" ON public.purchases
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ EXCLUSÃO DE CONTA ============
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sem_sessao');
  END IF;

  DELETE FROM public.purchases WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- código de teste para validar o fluxo
INSERT INTO public.activation_codes (code, note) VALUES ('CALDRA-TESTE-TESTE-TESTE', 'Código de teste do fluxo de ativação');