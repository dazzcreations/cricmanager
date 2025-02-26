export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      players: {
        Row: {
          id: string
          team_id: string | null
          name: string
          role: string
          batting_style: string | null
          bowling_style: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          name: string
          role: string
          batting_style?: string | null
          bowling_style?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          name?: string
          role?: string
          batting_style?: string | null
          bowling_style?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}