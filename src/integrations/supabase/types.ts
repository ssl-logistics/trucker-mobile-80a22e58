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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      driver_documents: {
        Row: {
          created_at: string
          document_type: string
          document_url: string
          driver_id: string
          id: string
          insurance_value: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          document_url: string
          driver_id: string
          id?: string
          insurance_value?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          document_url?: string
          driver_id?: string
          id?: string
          insurance_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_work_preferences: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          price_range_max: number | null
          price_range_min: number | null
          updated_at: string
          work_areas: string[]
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          price_range_max?: number | null
          price_range_min?: number | null
          updated_at?: string
          work_areas?: string[]
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          price_range_max?: number | null
          price_range_min?: number | null
          updated_at?: string
          work_areas?: string[]
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applied_at: string
          checked_in_at: string | null
          container_checked_in_at: string | null
          container_sop_completed_at: string | null
          delivery_checked_in_at: string | null
          delivery_sop_completed_at: string | null
          driver_id: string
          id: string
          job_id: string
          job_started_at: string | null
          payment_completed_at: string | null
          payment_method: string | null
          pod_photo_url: string | null
          sop_completed_at: string | null
          status: string
        }
        Insert: {
          applied_at?: string
          checked_in_at?: string | null
          container_checked_in_at?: string | null
          container_sop_completed_at?: string | null
          delivery_checked_in_at?: string | null
          delivery_sop_completed_at?: string | null
          driver_id: string
          id?: string
          job_id: string
          job_started_at?: string | null
          payment_completed_at?: string | null
          payment_method?: string | null
          pod_photo_url?: string | null
          sop_completed_at?: string | null
          status?: string
        }
        Update: {
          applied_at?: string
          checked_in_at?: string | null
          container_checked_in_at?: string | null
          container_sop_completed_at?: string | null
          delivery_checked_in_at?: string | null
          delivery_sop_completed_at?: string | null
          driver_id?: string
          id?: string
          job_id?: string
          job_started_at?: string | null
          payment_completed_at?: string | null
          payment_method?: string | null
          pod_photo_url?: string | null
          sop_completed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_bids: {
        Row: {
          bid_amount: number
          created_at: string
          driver_id: string
          id: string
          job_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bid_amount: number
          created_at?: string
          driver_id: string
          id?: string
          job_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bid_amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          job_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_bids_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          container_checkpoint: string | null
          container_checkpoint_code: string | null
          container_number: string | null
          created_at: string
          destination_bill_of_lading: string | null
          destination_contact_person: string | null
          destination_goods_quantity: string | null
          destination_goods_type: string | null
          destination_location: string
          destination_remarks: string | null
          destination_time: string | null
          district: string | null
          employer_name: string
          empty_container_date: string | null
          equipment_list: string | null
          id: string
          job_type: string
          order_code: string
          origin_bill_of_lading: string | null
          origin_contact_person: string | null
          origin_contact_role: string | null
          origin_goods_quantity: string | null
          origin_goods_type: string | null
          origin_location: string
          origin_remarks: string | null
          price: number
          province: string | null
          safety_equipment: string | null
          seal_number: string | null
          start_date: string
          start_time: string
          status: string
          transport_type: string
          updated_at: string
        }
        Insert: {
          container_checkpoint?: string | null
          container_checkpoint_code?: string | null
          container_number?: string | null
          created_at?: string
          destination_bill_of_lading?: string | null
          destination_contact_person?: string | null
          destination_goods_quantity?: string | null
          destination_goods_type?: string | null
          destination_location: string
          destination_remarks?: string | null
          destination_time?: string | null
          district?: string | null
          employer_name: string
          empty_container_date?: string | null
          equipment_list?: string | null
          id?: string
          job_type: string
          order_code: string
          origin_bill_of_lading?: string | null
          origin_contact_person?: string | null
          origin_contact_role?: string | null
          origin_goods_quantity?: string | null
          origin_goods_type?: string | null
          origin_location: string
          origin_remarks?: string | null
          price: number
          province?: string | null
          safety_equipment?: string | null
          seal_number?: string | null
          start_date: string
          start_time: string
          status?: string
          transport_type: string
          updated_at?: string
        }
        Update: {
          container_checkpoint?: string | null
          container_checkpoint_code?: string | null
          container_number?: string | null
          created_at?: string
          destination_bill_of_lading?: string | null
          destination_contact_person?: string | null
          destination_goods_quantity?: string | null
          destination_goods_type?: string | null
          destination_location?: string
          destination_remarks?: string | null
          destination_time?: string | null
          district?: string | null
          employer_name?: string
          empty_container_date?: string | null
          equipment_list?: string | null
          id?: string
          job_type?: string
          order_code?: string
          origin_bill_of_lading?: string | null
          origin_contact_person?: string | null
          origin_contact_role?: string | null
          origin_goods_quantity?: string | null
          origin_goods_type?: string | null
          origin_location?: string
          origin_remarks?: string | null
          price?: number
          province?: string | null
          safety_equipment?: string | null
          seal_number?: string | null
          start_date?: string
          start_time?: string
          status?: string
          transport_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pickup_sop_photos: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          job_id: string
          photo_type: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          job_id: string
          photo_type?: string
          photo_url: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          job_id?: string
          photo_type?: string
          photo_url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone_number: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone_number: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_photos: {
        Row: {
          created_at: string
          id: string
          photo_type: string
          photo_url: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_type: string
          photo_url: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_type?: string
          photo_url?: string
          vehicle_id?: string
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
          container_types: string[] | null
          created_at: string
          driver_id: string
          fuel_type: string
          has_trailer: boolean | null
          height: number | null
          id: string
          length: number | null
          load_capacity: number
          plate_number: string
          plate_province: string
          trailer_plate_number: string | null
          trailer_plate_province: string | null
          updated_at: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_type: string
          vin: string
          width: number | null
        }
        Insert: {
          container_types?: string[] | null
          created_at?: string
          driver_id: string
          fuel_type: string
          has_trailer?: boolean | null
          height?: number | null
          id?: string
          length?: number | null
          load_capacity: number
          plate_number: string
          plate_province: string
          trailer_plate_number?: string | null
          trailer_plate_province?: string | null
          updated_at?: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_type: string
          vin: string
          width?: number | null
        }
        Update: {
          container_types?: string[] | null
          created_at?: string
          driver_id?: string
          fuel_type?: string
          has_trailer?: boolean | null
          height?: number | null
          id?: string
          length?: number | null
          load_capacity?: number
          plate_number?: string
          plate_province?: string
          trailer_plate_number?: string | null
          trailer_plate_province?: string | null
          updated_at?: string
          vehicle_brand?: string
          vehicle_color?: string
          vehicle_type?: string
          vin?: string
          width?: number | null
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
