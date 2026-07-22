import { supabase } from "./supabaseClient";

export type AppRole = "admin" | "manager" | "user";

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: AppRole;
};

export async function listUsersWithRoles(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

export async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc("admin_set_role", { _target: userId, _role: role });
  if (error) throw new Error(error.message);
}

export async function getCurrentRole(): Promise<AppRole | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  if (error || !data || data.length === 0) return null;
  const roles = data.map((r) => r.role as AppRole);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("manager")) return "manager";
  return "user";
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "admin";
}
