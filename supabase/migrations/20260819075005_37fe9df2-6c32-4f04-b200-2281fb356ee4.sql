INSERT INTO public.user_features (user_id, access_approved)
SELECT u.id, true FROM auth.users u
ON CONFLICT (user_id) DO UPDATE SET access_approved = true;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_access_approved(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_require_access_approval(boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_access_state() FROM anon;