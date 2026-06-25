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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
      sessions: {
        Row: {
          active_model_key: string
          active_preset_id: string | null
          created_at: string
          id: string
          settings_json: Json
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
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
