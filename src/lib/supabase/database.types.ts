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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locale: string
          payload: Json
          provider_id: string | null
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locale?: string
          payload?: Json
          provider_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locale?: string
          payload?: Json
          provider_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template?: string
          to_email?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_notes: {
        Row: {
          note: string
          registration_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          note: string
          registration_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          note?: string
          registration_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_notes_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          cancelled_at: string | null
          consent_at: string
          contact_email: string
          contact_phone: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_message: string | null
          event_id: string
          id: string
          message: string | null
          private_vehicle_ack: boolean
          rejection_reason:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cancelled_at?: string | null
          consent_at?: string
          contact_email: string
          contact_phone: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_message?: string | null
          event_id: string
          id?: string
          message?: string | null
          private_vehicle_ack?: boolean
          rejection_reason?:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          cancelled_at?: string | null
          consent_at?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_message?: string | null
          event_id?: string
          id?: string
          message?: string | null
          private_vehicle_ack?: boolean
          rejection_reason?:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          access: Database["public"]["Enums"]["event_access"]
          capacity: number | null
          category: Database["public"]["Enums"]["event_category"]
          country: string | null
          cover_format: string | null
          cover_path: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          lat: number | null
          lng: number | null
          organizer_id: string
          program: string | null
          published_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          registration_verified_opens_at: string | null
          rules: string | null
          season_id: string | null
          selection_criteria: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          timezone: string
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          verified_head_start_hours: number
          verified_priority: boolean
        }
        Insert: {
          access?: Database["public"]["Enums"]["event_access"]
          capacity?: number | null
          category?: Database["public"]["Enums"]["event_category"]
          country?: string | null
          cover_format?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          lat?: number | null
          lng?: number | null
          organizer_id: string
          program?: string | null
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          registration_verified_opens_at?: string | null
          rules?: string | null
          season_id?: string | null
          selection_criteria?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          verified_head_start_hours?: number
          verified_priority?: boolean
        }
        Update: {
          access?: Database["public"]["Enums"]["event_access"]
          capacity?: number | null
          category?: Database["public"]["Enums"]["event_category"]
          country?: string | null
          cover_format?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          organizer_id?: string
          program?: string | null
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          registration_verified_opens_at?: string | null
          rules?: string | null
          season_id?: string | null
          selection_criteria?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          verified_head_start_hours?: number
          verified_priority?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          message: string
          page_path: string | null
          resolved_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          message: string
          page_path?: string | null
          resolved_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          message?: string
          page_path?: string | null
          resolved_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_broadcasts: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          recipient_count: number
          segment: Database["public"]["Enums"]["broadcast_segment"]
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          recipient_count?: number
          segment: Database["public"]["Enums"]["broadcast_segment"]
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          recipient_count?: number
          segment?: Database["public"]["Enums"]["broadcast_segment"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          payload: Json
          read_at: string | null
          registration_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          registration_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          registration_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          profile_id: string
          status: Database["public"]["Enums"]["organizer_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          profile_id: string
          status?: Database["public"]["Enums"]["organizer_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["organizer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          role: string
          updated_at: string
          username: string | null
          verified_at: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          role?: string
          updated_at?: string
          username?: string | null
          verified_at?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          role?: string
          updated_at?: string
          username?: string | null
          verified_at?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          name: string
          organizer_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organizer_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organizer_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_mods: {
        Row: {
          category: Database["public"]["Enums"]["mod_category"]
          created_at: string
          description: string
          id: string
          position: number
          vehicle_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["mod_category"]
          created_at?: string
          description: string
          id?: string
          position?: number
          vehicle_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["mod_category"]
          created_at?: string
          description?: string
          id?: string
          position?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_mods_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos: {
        Row: {
          created_at: string
          format: string
          height: number | null
          id: string
          position: number
          vehicle_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          format?: string
          height?: number | null
          id?: string
          position?: number
          vehicle_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          format?: string
          height?: number | null
          id?: string
          position?: number
          vehicle_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          acquired_on: string | null
          category: Database["public"]["Enums"]["vehicle_category"]
          country: string | null
          created_at: string
          description: string | null
          engine: string | null
          id: string
          make: string
          model: string
          owner_id: string
          power_hp: number | null
          sold_on: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          story: string | null
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          year: number | null
        }
        Insert: {
          acquired_on?: string | null
          category: Database["public"]["Enums"]["vehicle_category"]
          country?: string | null
          created_at?: string
          description?: string | null
          engine?: string | null
          id?: string
          make: string
          model: string
          owner_id?: string
          power_hp?: number | null
          sold_on?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          story?: string | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          year?: number | null
        }
        Update: {
          acquired_on?: string | null
          category?: Database["public"]["Enums"]["vehicle_category"]
          country?: string | null
          created_at?: string
          description?: string | null
          engine?: string | null
          id?: string
          make?: string
          model?: string
          owner_id?: string
          power_hp?: number | null
          sold_on?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          story?: string | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          email_confirmed: boolean
          id: string
          last_sign_in_at: string
          organizer_name: string
          organizer_status: Database["public"]["Enums"]["organizer_status"]
          role: string
          username: string
          vehicle_count: number
          verified_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }[]
      }
      admin_set_admin: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_organizer: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_organizer_status: {
        Args: {
          p_organizer_id: string
          p_status: Database["public"]["Enums"]["organizer_status"]
        }
        Returns: undefined
      }
      broadcast_recipient_count: {
        Args: {
          p_event_id: string
          p_segment: Database["public"]["Enums"]["broadcast_segment"]
        }
        Returns: number
      }
      broadcast_recipients: {
        Args: {
          p_event_id: string
          p_segment: Database["public"]["Enums"]["broadcast_segment"]
        }
        Returns: {
          user_id: string
        }[]
      }
      cancel_registration: {
        Args: { p_registration_id: string }
        Returns: {
          cancelled_at: string | null
          consent_at: string
          contact_email: string
          contact_phone: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_message: string | null
          event_id: string
          id: string
          message: string | null
          private_vehicle_ack: boolean
          rejection_reason:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_email_batch: {
        Args: { p_daily_limit: number; p_limit: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locale: string
          payload: Json
          provider_id: string | null
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_email: {
        Args: { p_id: string; p_provider_id: string }
        Returns: undefined
      }
      decide_registration: {
        Args: {
          p_decision: Database["public"]["Enums"]["registration_status"]
          p_message?: string
          p_reason?: Database["public"]["Enums"]["rejection_reason"]
          p_registration_id: string
        }
        Returns: {
          cancelled_at: string | null
          consent_at: string
          contact_email: string
          contact_phone: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_message: string | null
          event_id: string
          id: string
          message: string | null
          private_vehicle_ack: boolean
          rejection_reason:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_user_message: {
        Args: {
          p_event_id: string
          p_payload: Json
          p_registration_id: string
          p_send_email: boolean
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      event_email_queue_count: { Args: { p_event_id: string }; Returns: number }
      fail_email: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      fill_from_waitlist: { Args: { p_event_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_event_organizer: { Args: { p_event_id: string }; Returns: boolean }
      is_registration_organizer: {
        Args: { p_registration_id: string }
        Returns: boolean
      }
      my_organizer_ids: { Args: never; Returns: string[] }
      owns_vehicle: { Args: { p_vehicle_id: string }; Returns: boolean }
      public_members: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          avatar_path: string
          city: string
          country: string
          created_at: string
          display_name: string
          id: string
          username: string
          vehicle_count: number
          verified_at: string
        }[]
      }
      register_for_event: {
        Args: {
          p_consent: boolean
          p_email: string
          p_event_id: string
          p_message: string
          p_phone: string
          p_private_ack: boolean
          p_vehicle_id: string
        }
        Returns: {
          cancelled_at: string | null
          consent_at: string
          contact_email: string
          contact_phone: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_message: string | null
          event_id: string
          id: string
          message: string | null
          private_vehicle_ack: boolean
          rejection_reason:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_feedback: {
        Args: { p_id: string; p_resolved: boolean }
        Returns: undefined
      }
      season_belongs_to: {
        Args: { p_organizer_id: string; p_season_id: string }
        Returns: boolean
      }
      send_broadcast: {
        Args: {
          p_body: string
          p_event_id: string
          p_segment: Database["public"]["Enums"]["broadcast_segment"]
          p_subject: string
        }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          recipient_count: number
          segment: Database["public"]["Enums"]["broadcast_segment"]
          subject: string
        }
        SetofOptions: {
          from: "*"
          to: "message_broadcasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_feedback: {
        Args: {
          p_contact_email: string
          p_message: string
          p_page_path: string
          p_user_agent: string
        }
        Returns: string
      }
      vehicle_has_event_history: {
        Args: { p_vehicle_id: string }
        Returns: boolean
      }
    }
    Enums: {
      broadcast_segment:
        | "approved"
        | "pending"
        | "waitlist"
        | "approved_verified"
        | "all_active"
      email_status: "queued" | "sending" | "sent" | "failed"
      event_access: "public" | "verified_only" | "invite_only"
      event_category:
        | "tuning"
        | "youngtimer"
        | "american"
        | "veteran"
        | "classic"
        | "motorcycle"
        | "mix"
      event_status: "draft" | "published" | "closed" | "cancelled"
      mod_category:
        | "engine"
        | "drivetrain"
        | "suspension"
        | "wheels"
        | "brakes"
        | "exterior"
        | "interior"
        | "audio"
        | "other"
      notification_type:
        | "registration_received"
        | "registration_approved"
        | "registration_rejected"
        | "registration_waitlist"
        | "registration_promoted"
        | "registration_cancelled"
        | "broadcast"
      organizer_status: "pending" | "approved" | "suspended"
      registration_status:
        | "pending"
        | "approved"
        | "rejected"
        | "waitlist"
        | "cancelled"
      rejection_reason: "capacity" | "criteria" | "incomplete" | "other"
      vehicle_category:
        | "tuning"
        | "youngtimer"
        | "american"
        | "veteran"
        | "classic"
        | "motorcycle"
        | "other"
      vehicle_status: "current" | "former"
      vehicle_type: "car" | "motorcycle"
      visibility: "public" | "private"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      broadcast_segment: [
        "approved",
        "pending",
        "waitlist",
        "approved_verified",
        "all_active",
      ],
      email_status: ["queued", "sending", "sent", "failed"],
      event_access: ["public", "verified_only", "invite_only"],
      event_category: [
        "tuning",
        "youngtimer",
        "american",
        "veteran",
        "classic",
        "motorcycle",
        "mix",
      ],
      event_status: ["draft", "published", "closed", "cancelled"],
      mod_category: [
        "engine",
        "drivetrain",
        "suspension",
        "wheels",
        "brakes",
        "exterior",
        "interior",
        "audio",
        "other",
      ],
      notification_type: [
        "registration_received",
        "registration_approved",
        "registration_rejected",
        "registration_waitlist",
        "registration_promoted",
        "registration_cancelled",
        "broadcast",
      ],
      organizer_status: ["pending", "approved", "suspended"],
      registration_status: [
        "pending",
        "approved",
        "rejected",
        "waitlist",
        "cancelled",
      ],
      rejection_reason: ["capacity", "criteria", "incomplete", "other"],
      vehicle_category: [
        "tuning",
        "youngtimer",
        "american",
        "veteran",
        "classic",
        "motorcycle",
        "other",
      ],
      vehicle_status: ["current", "former"],
      vehicle_type: ["car", "motorcycle"],
      visibility: ["public", "private"],
    },
  },
} as const
