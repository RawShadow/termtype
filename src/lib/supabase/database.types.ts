// Generated from the Supabase project schema (supabase/migrations). Do not edit by hand.
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
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          accuracy: number
          client_run_id: string
          consistency: number
          created_at: string
          duration_sec: number
          id: string
          mode: string
          modifiers: Json
          raw_wpm: number
          sub_mode: string
          user_id: string
          wpm: number
        }
        Insert: {
          accuracy: number
          client_run_id: string
          consistency: number
          created_at?: string
          duration_sec: number
          id?: string
          mode: string
          modifiers?: Json
          raw_wpm: number
          sub_mode: string
          user_id: string
          wpm: number
        }
        Update: {
          accuracy?: number
          client_run_id?: string
          consistency?: number
          created_at?: string
          duration_sec?: number
          id?: string
          mode?: string
          modifiers?: Json
          raw_wpm?: number
          sub_mode?: string
          user_id?: string
          wpm?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_results_user_id_fkey"
            columns: ["user_id"]
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
      get_leaderboard: {
        Args: {
          p_limit?: number
          p_mode: string
          p_sub_mode: string
          p_user_id?: string
          p_window?: string
        }
        Returns: {
          accuracy: number
          created_at: string
          rank: number
          raw_wpm: number
          user_id: string
          username: string
          wpm: number
        }[]
      }
      record_test_result: {
        Args: {
          p_accuracy: number
          p_client_run_id: string
          p_consistency: number
          p_duration_sec: number
          p_mode: string
          p_modifiers: Json
          p_played_at?: string
          p_raw_wpm: number
          p_sub_mode: string
          p_user_id: string
          p_wpm: number
        }
        Returns: {
          accuracy: number
          client_run_id: string
          consistency: number
          created_at: string
          duration_sec: number
          id: string
          mode: string
          modifiers: Json
          raw_wpm: number
          sub_mode: string
          user_id: string
          wpm: number
        }
        SetofOptions: {
          from: "*"
          to: "test_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type TestResultRow = Database["public"]["Tables"]["test_results"]["Row"]
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type RecordTestResultArgs = Database["public"]["Functions"]["record_test_result"]["Args"]
export type LeaderboardRow = Database["public"]["Functions"]["get_leaderboard"]["Returns"][number]
