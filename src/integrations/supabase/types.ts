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
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_result: string
          call_type: string
          conversation_id: string | null
          created_at: string
          driver_id: string
          duration_seconds: number
          id: string
          peer_avatar: string | null
          peer_id: string
          peer_name: string
        }
        Insert: {
          call_result: string
          call_type: string
          conversation_id?: string | null
          created_at?: string
          driver_id: string
          duration_seconds?: number
          id?: string
          peer_avatar?: string | null
          peer_id: string
          peer_name: string
        }
        Update: {
          call_result?: string
          call_type?: string
          conversation_id?: string | null
          created_at?: string
          driver_id?: string
          duration_seconds?: number
          id?: string
          peer_avatar?: string | null
          peer_id?: string
          peer_name?: string
        }
        Relationships: []
      }
      chatbot_faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          priority: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          priority?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          priority?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean | null
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      edge_function_audit_logs: {
        Row: {
          created_at: string
          driver_id: string | null
          duration_ms: number | null
          error_message: string | null
          external_request_payload: Json | null
          function_name: string
          id: string
          order_number: string | null
          request_payload: Json | null
          response_body: Json | null
          response_status: number | null
          room_code: string | null
          success: boolean | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          external_request_payload?: Json | null
          function_name: string
          id?: string
          order_number?: string | null
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number | null
          room_code?: string | null
          success?: boolean | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          external_request_payload?: Json | null
          function_name?: string
          id?: string
          order_number?: string | null
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number | null
          room_code?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          expense_type: string
          id: string
          job_id: string
          receipt_photo_url: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          expense_type: string
          id?: string
          job_id: string
          receipt_photo_url: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          expense_type?: string
          id?: string
          job_id?: string
          receipt_photo_url?: string
        }
        Relationships: []
      }
      external_chat_config: {
        Row: {
          api_key: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          project_id: string | null
          project_name: string
          target_url: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          project_id?: string | null
          project_name: string
          target_url: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          project_id?: string | null
          project_name?: string
          target_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      external_chat_messages: {
        Row: {
          conversation_id: string
          created_at: string | null
          external_message_id: string
          external_project_id: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          message_text: string | null
          message_type: string | null
          sender_avatar: string | null
          sender_mapping_id: string | null
          sender_name: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          external_message_id: string
          external_project_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_text?: string | null
          message_type?: string | null
          sender_avatar?: string | null
          sender_mapping_id?: string | null
          sender_name: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          external_message_id?: string
          external_project_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_text?: string | null
          message_type?: string | null
          sender_avatar?: string | null
          sender_mapping_id?: string | null
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_chat_messages_external_project_id_fkey"
            columns: ["external_project_id"]
            isOneToOne: false
            referencedRelation: "external_chat_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_chat_messages_sender_mapping_id_fkey"
            columns: ["sender_mapping_id"]
            isOneToOne: false
            referencedRelation: "external_user_mapping"
            referencedColumns: ["id"]
          },
        ]
      }
      external_user_mapping: {
        Row: {
          created_at: string | null
          external_project_id: string | null
          external_user_avatar: string | null
          external_user_id: string
          external_user_name: string | null
          id: string
          local_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          external_project_id?: string | null
          external_user_avatar?: string | null
          external_user_id: string
          external_user_name?: string | null
          id?: string
          local_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          external_project_id?: string | null
          external_user_avatar?: string | null
          external_user_id?: string
          external_user_name?: string | null
          id?: string
          local_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_user_mapping_external_project_id_fkey"
            columns: ["external_project_id"]
            isOneToOne: false
            referencedRelation: "external_chat_config"
            referencedColumns: ["id"]
          },
        ]
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
          assigned_role: Database["public"]["Enums"]["app_role"] | null
          container_checkpoint: string | null
          container_checkpoint_code: string | null
          container_checkpoint_latitude: number | null
          container_checkpoint_longitude: number | null
          container_number: string | null
          container_number_2: string | null
          created_at: string
          destination_address: string | null
          destination_bill_of_lading: string | null
          destination_company_name: string | null
          destination_contact_person: string | null
          destination_date: string | null
          destination_goods_quantity: string | null
          destination_goods_type: string | null
          destination_latitude: number | null
          destination_location: string
          destination_longitude: number | null
          destination_remarks: string | null
          destination_time: string | null
          district: string | null
          employer_name: string
          empty_container_date: string | null
          equipment_list: string | null
          id: string
          job_type: string
          order_code: string
          origin_address: string | null
          origin_bill_of_lading: string | null
          origin_company_name: string | null
          origin_contact_person: string | null
          origin_contact_role: string | null
          origin_goods_quantity: string | null
          origin_goods_type: string | null
          origin_latitude: number | null
          origin_location: string
          origin_longitude: number | null
          origin_remarks: string | null
          price: number
          province: string | null
          return_full_container_date: string | null
          return_full_container_location: string | null
          safety_equipment: string | null
          seal_number: string | null
          seal_number_2: string | null
          shipper_load: string | null
          start_date: string
          start_time: string
          status: string
          tax_id: string | null
          transport_type: string
          updated_at: string
        }
        Insert: {
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          container_checkpoint?: string | null
          container_checkpoint_code?: string | null
          container_checkpoint_latitude?: number | null
          container_checkpoint_longitude?: number | null
          container_number?: string | null
          container_number_2?: string | null
          created_at?: string
          destination_address?: string | null
          destination_bill_of_lading?: string | null
          destination_company_name?: string | null
          destination_contact_person?: string | null
          destination_date?: string | null
          destination_goods_quantity?: string | null
          destination_goods_type?: string | null
          destination_latitude?: number | null
          destination_location: string
          destination_longitude?: number | null
          destination_remarks?: string | null
          destination_time?: string | null
          district?: string | null
          employer_name: string
          empty_container_date?: string | null
          equipment_list?: string | null
          id?: string
          job_type: string
          order_code: string
          origin_address?: string | null
          origin_bill_of_lading?: string | null
          origin_company_name?: string | null
          origin_contact_person?: string | null
          origin_contact_role?: string | null
          origin_goods_quantity?: string | null
          origin_goods_type?: string | null
          origin_latitude?: number | null
          origin_location: string
          origin_longitude?: number | null
          origin_remarks?: string | null
          price: number
          province?: string | null
          return_full_container_date?: string | null
          return_full_container_location?: string | null
          safety_equipment?: string | null
          seal_number?: string | null
          seal_number_2?: string | null
          shipper_load?: string | null
          start_date: string
          start_time: string
          status?: string
          tax_id?: string | null
          transport_type: string
          updated_at?: string
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          container_checkpoint?: string | null
          container_checkpoint_code?: string | null
          container_checkpoint_latitude?: number | null
          container_checkpoint_longitude?: number | null
          container_number?: string | null
          container_number_2?: string | null
          created_at?: string
          destination_address?: string | null
          destination_bill_of_lading?: string | null
          destination_company_name?: string | null
          destination_contact_person?: string | null
          destination_date?: string | null
          destination_goods_quantity?: string | null
          destination_goods_type?: string | null
          destination_latitude?: number | null
          destination_location?: string
          destination_longitude?: number | null
          destination_remarks?: string | null
          destination_time?: string | null
          district?: string | null
          employer_name?: string
          empty_container_date?: string | null
          equipment_list?: string | null
          id?: string
          job_type?: string
          order_code?: string
          origin_address?: string | null
          origin_bill_of_lading?: string | null
          origin_company_name?: string | null
          origin_contact_person?: string | null
          origin_contact_role?: string | null
          origin_goods_quantity?: string | null
          origin_goods_type?: string | null
          origin_latitude?: number | null
          origin_location?: string
          origin_longitude?: number | null
          origin_remarks?: string | null
          price?: number
          province?: string | null
          return_full_container_date?: string | null
          return_full_container_location?: string | null
          safety_equipment?: string | null
          seal_number?: string | null
          seal_number_2?: string | null
          shipper_load?: string | null
          start_date?: string
          start_time?: string
          status?: string
          tax_id?: string | null
          transport_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      line_pending_auth: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          state: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          state: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          state?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          sender_avatar: string | null
          sender_id: string
          sender_name: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          sender_avatar?: string | null
          sender_id: string
          sender_name: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          sender_avatar?: string | null
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description_en: string | null
          description_ko: string | null
          description_th: string | null
          description_zh: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          notification_type: string | null
          reference_id: string | null
          reference_type: string | null
          title_en: string | null
          title_ko: string | null
          title_th: string
          title_zh: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          description_th?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          notification_type?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title_en?: string | null
          title_ko?: string | null
          title_th: string
          title_zh?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          description_th?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          notification_type?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title_en?: string | null
          title_ko?: string | null
          title_th?: string
          title_zh?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_tracking_rooms: {
        Row: {
          created_at: string
          destination_lat: number | null
          destination_lng: number | null
          driver_id: string | null
          order_number: string
          origin_lat: number | null
          origin_lng: number | null
          room_code: string
          source: string
          status: string
          truck_plate: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          order_number: string
          origin_lat?: number | null
          origin_lng?: number | null
          room_code: string
          source?: string
          status?: string
          truck_plate?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          order_number?: string
          origin_lat?: number | null
          origin_lng?: number | null
          room_code?: string
          source?: string
          status?: string
          truck_plate?: string | null
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
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone_number: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      check_username_exists: {
        Args: { check_username: string }
        Returns: boolean
      }
      get_email_by_username: {
        Args: { lookup_username: string }
        Returns: string
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "freelance" | "company" | "factory"
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
      app_role: ["freelance", "company", "factory"],
    },
  },
} as const
