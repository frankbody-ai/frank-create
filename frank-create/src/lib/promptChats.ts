import { supabase } from "./supabaseClient";

export interface PromptChatMessageRow {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  hidden?: boolean;
}

export interface PromptChatSummary {
  id: string;
  title: string;
  skill: string;
  updated_at: string;
}

function titleFrom(messages: PromptChatMessageRow[]) {
  const first = messages.find((m) => m.role === "user" && !m.hidden && m.content.trim());
  const raw = (first?.content ?? "New chat").replace(/\s+/g, " ").trim();
  return raw.length > 70 ? `${raw.slice(0, 67)}…` : raw || "New chat";
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Most recent conversations for the signed-in user. */
export async function listPromptChats(): Promise<PromptChatSummary[]> {
  const { data, error } = await supabase
    .from("prompt_chats")
    .select("id,title,skill,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PromptChatSummary[];
}

export async function loadPromptChat(chatId: string): Promise<PromptChatMessageRow[]> {
  const { data, error } = await supabase
    .from("prompt_chat_messages")
    .select("role,content,images_json,hidden,seq")
    .eq("chat_id", chatId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content ?? "",
    images: Array.isArray(row.images_json) && row.images_json.length ? (row.images_json as string[]) : undefined,
    hidden: Boolean(row.hidden),
  }));
}

export async function deletePromptChat(chatId: string) {
  const { error } = await supabase.from("prompt_chats").delete().eq("id", chatId);
  if (error) throw error;
}

/**
 * Persist a conversation. Creates the chat row on first save, then rewrites the
 * message list so the stored thread always mirrors what's on screen.
 */
export async function savePromptChat(
  chatId: string | null,
  skill: string,
  messages: PromptChatMessageRow[]
): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId || !messages.length) return chatId;

  let id = chatId;
  if (!id) {
    const { data, error } = await supabase
      .from("prompt_chats")
      .insert({ user_id: userId, title: titleFrom(messages), skill })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id as string;
  } else {
    await supabase.from("prompt_chats").update({ title: titleFrom(messages), skill }).eq("id", id);
    await supabase.from("prompt_chat_messages").delete().eq("chat_id", id);
  }

  const rows = messages.map((message, index) => ({
    chat_id: id,
    user_id: userId,
    seq: index,
    role: message.role,
    content: message.content ?? "",
    images_json: message.images ?? [],
    hidden: Boolean(message.hidden),
  }));
  const { error: insertError } = await supabase.from("prompt_chat_messages").insert(rows);
  if (insertError) throw insertError;
  return id;
}
