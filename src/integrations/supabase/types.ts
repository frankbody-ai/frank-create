export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          require_access_approval: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          require_access_approval?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          require_access_approval?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      asset_approval_events: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          new_status: string
          note: string | null
          prev_status: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          prev_status?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          prev_status?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_approval_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          message_id: string | null
          metadata_json: Json
          model_key: string | null
          parent_asset_id: string | null
          prompt_snapshot: string | null
          session_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          message_id?: string | null
          metadata_json?: Json
          model_key?: string | null
          parent_asset_id?: string | null
          prompt_snapshot?: string | null
          session_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          message_id?: string | null
          metadata_json?: Json
          model_key?: string | null
          parent_asset_id?: string | null
          prompt_snapshot?: string | null
          session_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          created_at: string
          id: string
          negative_prompt: string
          reference_notes: string
          style_guidance: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          negative_prompt?: string
          reference_notes?: string
          style_guidance?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          negative_prompt?: string
          reference_notes?: string
          style_guidance?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback_items: {
        Row: {
          created_at: string
          id: string
          message: string
          page_path: string | null
          route_name: string | null
          screenshot_path: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          task_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          viewport: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_path?: string | null
          route_name?: string | null
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          task_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          viewport?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_path?: string | null
          route_name?: string | null
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          task_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      generation_errors: {
        Row: {
          code: string
          created_at: string
          http_status: number | null
          id: string
          inputs: Json
          message: string
          model_id: string | null
          provider: string
          raw: string | null
          retryable: boolean
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          http_status?: number | null
          id?: string
          inputs?: Json
          message: string
          model_id?: string | null
          provider: string
          raw?: string | null
          retryable?: boolean
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          http_status?: number | null
          id?: string
          inputs?: Json
          message?: string
          model_id?: string | null
          provider?: string
          raw?: string | null
          retryable?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          message_type: string
          prompt_text: string | null
          role: string
          seq: number
          session_id: string
          settings_snapshot_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_type: string
          prompt_text?: string | null
          role: string
          seq?: never
          session_id: string
          settings_snapshot_json?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_type?: string
          prompt_text?: string | null
          role?: string
          seq?: never
          session_id?: string
          settings_snapshot_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_capabilities: {
        Row: {
          blurb: string | null
          created_at: string
          default_settings_json: Json
          label: string | null
          max_reference_images: number
          model_key: string
          provider: string
          provider_model_id: string
          supported_aspect_ratios: string[]
          supported_resolutions: string[]
          supports_editing: boolean
          supports_multi_reference: boolean
          supports_multi_turn: boolean
          supports_thinking: boolean
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          default_settings_json?: Json
          label?: string | null
          max_reference_images?: number
          model_key: string
          provider: string
          provider_model_id: string
          supported_aspect_ratios?: string[]
          supported_resolutions?: string[]
          supports_editing?: boolean
          supports_multi_reference?: boolean
          supports_multi_turn?: boolean
          supports_thinking?: boolean
        }
        Update: {
          blurb?: string | null
          created_at?: string
          default_settings_json?: Json
          label?: string | null
          max_reference_images?: number
          model_key?: string
          provider?: string
          provider_model_id?: string
          supported_aspect_ratios?: string[]
          supported_resolutions?: string[]
          supports_editing?: boolean
          supports_multi_reference?: boolean
          supports_multi_turn?: boolean
          supports_thinking?: boolean
        }
        Relationships: []
      }
      presets: {
        Row: {
          category: string | null
          created_at: string
          default_settings_json: Json
          id: string
          is_active: boolean
          name: string
          negative_rules: string[]
          positive_rules: string[]
          system_prompt: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_settings_json?: Json
          id: string
          is_active?: boolean
          name: string
          negative_rules?: string[]
          positive_rules?: string[]
          system_prompt: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_settings_json?: Json
          id?: string
          is_active?: boolean
          name?: string
          negative_rules?: string[]
          positive_rules?: string[]
          system_prompt?: string
        }
        Relationships: []
      }
      prompt_agent_config: {
        Row: {
          blueprint: string
          conversation_protocol: string
          craft_method: string
          created_at: string
          id: number
          persona: string
          rules: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blueprint?: string
          conversation_protocol?: string
          craft_method?: string
          created_at?: string
          id?: number
          persona?: string
          rules?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blueprint?: string
          conversation_protocol?: string
          craft_method?: string
          created_at?: string
          id?: number
          persona?: string
          rules?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      prompt_agent_skills: {
        Row: {
          created_at: string
          hint: string
          instruction: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hint?: string
          instruction?: string
          is_active?: boolean
          key: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hint?: string
          instruction?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      prompt_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          hidden: boolean
          id: string
          images_json: Json
          role: string
          seq: number
          user_id: string
        }
        Insert: {
          chat_id: string
          content?: string
          created_at?: string
          hidden?: boolean
          id?: string
          images_json?: Json
          role: string
          seq?: number
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          hidden?: boolean
          id?: string
          images_json?: Json
          role?: string
          seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "prompt_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_chats: {
        Row: {
          created_at: string
          id: string
          skill: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          skill?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          skill?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      release_seen: {
        Row: {
          last_seen_release_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_release_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_release_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          active_model_key: string
          active_preset_id: string | null
          created_at: string
          id: string
          settings_json: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_model_key?: string
          active_preset_id?: string | null
          created_at?: string
          id?: string
          settings_json?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_model_key?: string
          active_preset_id?: string | null
          created_at?: string
          id?: string
          settings_json?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_features: {
        Row: {
          access_approved: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
          video_enabled: boolean
        }
        Insert: {
          access_approved?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
          video_enabled?: boolean
        }
        Update: {
          access_approved?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          video_enabled?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          access_approved: boolean
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          role: Database["public"]["Enums"]["app_role"]
          video_enabled: boolean
        }[]
      }
      admin_set_access_approved: {
        Args: { _approved: boolean; _target: string }
        Returns: undefined
      }
      admin_set_require_access_approval: {
        Args: { _enabled: boolean }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_set_video_access: {
        Args: { _enabled: boolean; _target: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_access_state: {
        Args: never
        Returns: {
          approved: boolean
          is_admin: boolean
          require_approval: boolean
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
      feedback_status: "open" | "in_progress" | "done" | "dismissed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "user"],
      feedback_status: ["open", "in_progress", "done", "dismissed"],
    },
  },
} as const
