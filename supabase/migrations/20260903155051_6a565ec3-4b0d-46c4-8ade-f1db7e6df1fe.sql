REVOKE ALL ON FUNCTION public.consume_vectorization(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_vectorizations(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sp_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_vectorization(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_vectorizations(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sp_today() TO authenticated, service_role;