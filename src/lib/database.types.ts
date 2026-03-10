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
      bids: {
        Row: {
          id: string
          job_id: string
          courier_id: string
          amount_ttd: number
          eta_minutes: number | null
          message: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          courier_id: string
          amount_ttd: number
          eta_minutes?: number | null
          message?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          courier_id?: string
          amount_ttd?: number
          eta_minutes?: number | null
          message?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      cargo_items: {
        Row: {
          id: string
          job_id: string
          cargo_size_category: string
          cargo_category: string
          cargo_category_custom: string | null
          cargo_weight_kg: number | null
          cargo_photo_url: string | null
          cargo_notes: string | null
          created_at: string | null
          delivery_proof_photo_url: string | null
          delivery_signature_url: string | null
          delivered_to_name: string | null
          delivered_at: string | null
          delivery_notes_from_courier: string | null
          dropoff_location_text: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_contact_name: string | null
          dropoff_contact_phone: string | null
          assigned_stop_index: number | null
          assigned_stop_id: string | null
          status: string
        }
        Insert: {
          id?: string
          job_id: string
          cargo_size_category: string
          cargo_category: string
          cargo_category_custom?: string | null
          cargo_weight_kg?: number | null
          cargo_photo_url?: string | null
          cargo_notes?: string | null
          created_at?: string | null
          delivery_proof_photo_url?: string | null
          delivery_signature_url?: string | null
          delivered_to_name?: string | null
          delivered_at?: string | null
          delivery_notes_from_courier?: string | null
          dropoff_location_text?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_contact_name?: string | null
          dropoff_contact_phone?: string | null
          assigned_stop_index?: number | null
          assigned_stop_id?: string | null
          status?: string
        }
        Update: {
          id?: string
          job_id?: string
          cargo_size_category?: string
          cargo_category?: string
          cargo_category_custom?: string | null
          cargo_weight_kg?: number | null
          cargo_photo_url?: string | null
          cargo_notes?: string | null
          created_at?: string | null
          delivery_proof_photo_url?: string | null
          delivery_signature_url?: string | null
          delivered_to_name?: string | null
          delivered_at?: string | null
          delivery_notes_from_courier?: string | null
          dropoff_location_text?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_contact_name?: string | null
          dropoff_contact_phone?: string | null
          assigned_stop_index?: number | null
          assigned_stop_id?: string | null
          status?: string
        }
      }
      customer_delivery_preferences: {
        Row: {
          id: string
          user_id: string
          default_delivery_instructions: string
          preferred_vehicle_type: string
          default_tip_percentage: number
          sms_notifications: boolean
          email_notifications: boolean
          push_notifications: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          default_delivery_instructions?: string
          preferred_vehicle_type?: string
          default_tip_percentage?: number
          sms_notifications?: boolean
          email_notifications?: boolean
          push_notifications?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          default_delivery_instructions?: string
          preferred_vehicle_type?: string
          default_tip_percentage?: number
          sms_notifications?: boolean
          email_notifications?: boolean
          push_notifications?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      customer_referrals: {
        Row: {
          id: string
          referrer_user_id: string
          referral_code: string
          referred_user_id: string | null
          status: string
          reward_amount_ttd: number
          created_at: string | null
        }
        Insert: {
          id?: string
          referrer_user_id: string
          referral_code: string
          referred_user_id?: string | null
          status?: string
          reward_amount_ttd?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          referrer_user_id?: string
          referral_code?: string
          referred_user_id?: string | null
          status?: string
          reward_amount_ttd?: number
          created_at?: string | null
        }
      }
      company_settings: {
        Row: {
          id: string
          company_name: string
          company_address: string
          company_email: string
          company_phone: string
          tax_registration_number: string
          logo_url: string
          invoice_prefix: string
          invoice_footer_text: string
          currency_code: string
          updated_at: string
          updated_by: string | null
          singleton_key: boolean
        }
        Insert: {
          id?: string
          company_name?: string
          company_address?: string
          company_email?: string
          company_phone?: string
          tax_registration_number?: string
          logo_url?: string
          invoice_prefix?: string
          invoice_footer_text?: string
          currency_code?: string
          updated_at?: string
          updated_by?: string | null
          singleton_key?: boolean
        }
        Update: {
          id?: string
          company_name?: string
          company_address?: string
          company_email?: string
          company_phone?: string
          tax_registration_number?: string
          logo_url?: string
          invoice_prefix?: string
          invoice_footer_text?: string
          currency_code?: string
          updated_at?: string
          updated_by?: string | null
          singleton_key?: boolean
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          job_id: string
          customer_user_id: string
          courier_user_id: string | null
          customer_name: string
          customer_email: string
          courier_name: string
          job_reference_id: string
          pickup_location: string
          dropoff_location: string
          delivery_type: string
          base_price: number
          platform_fee: number
          vat_amount: number
          total_price: number
          courier_earnings: number
          return_fee: number
          status: string
          sent_at: string | null
          paid_at: string | null
          pdf_url: string | null
          email_sent: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string
          job_id: string
          customer_user_id: string
          courier_user_id?: string | null
          customer_name?: string
          customer_email?: string
          courier_name?: string
          job_reference_id?: string
          pickup_location?: string
          dropoff_location?: string
          delivery_type?: string
          base_price?: number
          platform_fee?: number
          vat_amount?: number
          total_price?: number
          courier_earnings?: number
          return_fee?: number
          status?: string
          sent_at?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          email_sent?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          job_id?: string
          customer_user_id?: string
          courier_user_id?: string | null
          customer_name?: string
          customer_email?: string
          courier_name?: string
          job_reference_id?: string
          pickup_location?: string
          dropoff_location?: string
          delivery_type?: string
          base_price?: number
          platform_fee?: number
          vat_amount?: number
          total_price?: number
          courier_earnings?: number
          return_fee?: number
          status?: string
          sent_at?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          email_sent?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
          joined_at: string | null
          last_read_at: string | null
        }
        Insert: {
          conversation_id: string
          user_id: string
          joined_at?: string | null
          last_read_at?: string | null
        }
        Update: {
          conversation_id?: string
          user_id?: string
          joined_at?: string | null
          last_read_at?: string | null
        }
      }
      conversations: {
        Row: {
          id: string
          type: string
          job_id: string | null
          status: string
          assigned_admin_id: string | null
          last_message_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          type: string
          job_id?: string | null
          status?: string
          assigned_admin_id?: string | null
          last_message_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          type?: string
          job_id?: string | null
          status?: string
          assigned_admin_id?: string | null
          last_message_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      counter_offers: {
        Row: {
          id: string
          job_id: string
          courier_id: string
          user_id: string
          amount_ttd: number
          message: string | null
          status: string
          created_at: string | null
          updated_at: string | null
          offered_by_role: string
        }
        Insert: {
          id?: string
          job_id: string
          courier_id: string
          user_id: string
          amount_ttd: number
          message?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
          offered_by_role?: string
        }
        Update: {
          id?: string
          job_id?: string
          courier_id?: string
          user_id?: string
          amount_ttd?: number
          message?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
          offered_by_role?: string
        }
      }
      couriers: {
        Row: {
          id: string
          user_id: string
          verified: boolean | null
          verification_status: string | null
          vehicle_type: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: number | null
          vehicle_plate: string | null
          created_at: string | null
          updated_at: string | null
          total_earnings_ttd: number | null
          rating_average: number | null
          rating_count: number | null
          completed_deliveries_count: number | null
          is_online: boolean | null
          last_online_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          verified?: boolean | null
          verification_status?: string | null
          vehicle_type?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
          vehicle_plate?: string | null
          created_at?: string | null
          updated_at?: string | null
          total_earnings_ttd?: number | null
          rating_average?: number | null
          rating_count?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          verified?: boolean | null
          verification_status?: string | null
          vehicle_type?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
          vehicle_plate?: string | null
          created_at?: string | null
          updated_at?: string | null
          total_earnings_ttd?: number | null
          rating_average?: number | null
          rating_count?: number | null
        }
      }
      haulage_drivers: {
        Row: {
          id: string
          company_id: string
          full_name: string
          phone: string | null
          license_type: string | null
          is_active: boolean
          created_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          company_id: string
          full_name: string
          phone?: string | null
          license_type?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          full_name?: string
          phone?: string | null
          license_type?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
      }
      haulage_vehicles: {
        Row: {
          id: string
          company_id: string
          vehicle_name: string
          plate_number: string | null
          vehicle_type: string
          capacity_kg: number | null
          special_equipment: string | null
          is_active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          vehicle_name: string
          plate_number?: string | null
          vehicle_type: string
          capacity_kg?: number | null
          special_equipment?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          vehicle_name?: string
          plate_number?: string | null
          vehicle_type?: string
          capacity_kg?: number | null
          special_equipment?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      job_assignments: {
        Row: {
          job_id: string
          company_id: string
          driver_id: string
          vehicle_id: string
          assigned_by_user_id: string
          assigned_at: string | null
          reassigned_at: string | null
          reassignment_notes: string | null
        }
        Insert: {
          job_id: string
          company_id: string
          driver_id: string
          vehicle_id: string
          assigned_by_user_id: string
          assigned_at?: string | null
          reassigned_at?: string | null
          reassignment_notes?: string | null
        }
        Update: {
          job_id?: string
          company_id?: string
          driver_id?: string
          vehicle_id?: string
          assigned_by_user_id?: string
          assigned_at?: string | null
          reassigned_at?: string | null
          reassignment_notes?: string | null
        }
      }
      jobs: {
        Row: {
          id: string
          customer_user_id: string
          assigned_courier_id: string | null
          status: string | null
          pickup_location_text: string
          dropoff_location_text: string
          pickup_lat: number
          pickup_lng: number
          dropoff_lat: number
          dropoff_lng: number
          distance_km: number
          cargo_weight_kg: number | null
          cargo_size_category: string | null
          cargo_notes: string | null
          urgency_hours: number | null
          customer_offer_ttd: number | null
          recommended_low_ttd: number | null
          recommended_mid_ttd: number | null
          recommended_high_ttd: number | null
          likelihood_label: string | null
          likelihood_score: number | null
          created_at: string | null
          updated_at: string | null
          cargo_category: string | null
          cargo_category_custom: string | null
          cargo_photo_url: string | null
          delivery_type: string | null
          scheduled_pickup_time: string | null
          scheduled_dropoff_time: string | null
          pricing_type: string | null
          is_open_to_bids: boolean | null
          base_price: number | null
          platform_fee: number | null
          vat_amount: number | null
          total_price: number | null
          courier_earnings: number | null
          courier_location_lat: number | null
          courier_location_lng: number | null
          location_updated_at: string | null
          tracking_enabled: boolean | null
          is_fragile: boolean | null
          needs_cover: boolean | null
          requires_heavy_lift: boolean | null
          has_security_gate: boolean | null
          special_requirements_notes: string | null
          delivery_order_type: string | null
          is_multi_stop: boolean | null
          has_multiple_pickups: boolean | null
          pickups: Json | null
          dropoffs: Json | null
          total_distance_km: number | null
          eta_minutes: number | null
          proof_of_delivery: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          cancellation_fee_eligible: boolean | null
          cancellation_fee_percent: number | null
          cancellation_fee_amount_ttd: number | null
          cancellation_fee_applied: boolean | null
          proof_of_delivery_required: string
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          assignment_type: string | null
          assigned_driver_name: string | null
          assigned_vehicle_label: string | null
          assigned_company_name: string | null
          assigned_company_logo_url: string | null
          job_reference_id: string | null
          job_type: string
          marketplace_seller_contact: string | null
          marketplace_listing_url: string | null
          marketplace_max_budget: number | null
          errand_store_name: string | null
          errand_item_list: string | null
          errand_estimated_item_cost: number | null
          junk_disposal_type: string | null
          junk_tipping_fee_included: boolean
          return_platform_fee: number | null
          return_driver_payout: number | null
          return_base_transport_cost: number | null
          customer_total: number | null
          customer_service_fee: number | null
          driver_net_earnings: number | null
          courier_cargo_size: string | null
          courier_urgency: string | null
          courier_recipient_name: string | null
          courier_recipient_phone: string | null
          courier_building_details: string | null
          courier_require_signature: boolean | null
          courier_safety_acknowledged: boolean | null
          courier_express_multiplier: number | null
        }
        Insert: {
          id?: string
          customer_user_id: string
          assigned_courier_id?: string | null
          status?: string | null
          pickup_location_text: string
          dropoff_location_text: string
          pickup_lat: number
          pickup_lng: number
          dropoff_lat: number
          dropoff_lng: number
          distance_km: number
          cargo_weight_kg?: number | null
          cargo_size_category?: string | null
          cargo_notes?: string | null
          urgency_hours?: number | null
          customer_offer_ttd?: number | null
          recommended_low_ttd?: number | null
          recommended_mid_ttd?: number | null
          recommended_high_ttd?: number | null
          likelihood_label?: string | null
          likelihood_score?: number | null
          created_at?: string | null
          updated_at?: string | null
          cargo_category?: string | null
          cargo_category_custom?: string | null
          cargo_photo_url?: string | null
          delivery_type?: string | null
          scheduled_pickup_time?: string | null
          scheduled_dropoff_time?: string | null
          pricing_type?: string | null
          is_open_to_bids?: boolean | null
          base_price?: number | null
          platform_fee?: number | null
          vat_amount?: number | null
          total_price?: number | null
          courier_earnings?: number | null
          courier_location_lat?: number | null
          courier_location_lng?: number | null
          location_updated_at?: string | null
          tracking_enabled?: boolean | null
          is_fragile?: boolean | null
          needs_cover?: boolean | null
          requires_heavy_lift?: boolean | null
          has_security_gate?: boolean | null
          special_requirements_notes?: string | null
          delivery_order_type?: string | null
          is_multi_stop?: boolean | null
          has_multiple_pickups?: boolean | null
          pickups?: Json | null
          dropoffs?: Json | null
          total_distance_km?: number | null
          eta_minutes?: number | null
          proof_of_delivery?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          cancellation_fee_eligible?: boolean | null
          cancellation_fee_percent?: number | null
          cancellation_fee_amount_ttd?: number | null
          cancellation_fee_applied?: boolean | null
          proof_of_delivery_required?: string
          assigned_company_id?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          assignment_type?: string | null
          assigned_driver_name?: string | null
          assigned_vehicle_label?: string | null
          assigned_company_name?: string | null
          assigned_company_logo_url?: string | null
          job_reference_id?: string | null
          job_type?: string
          marketplace_seller_contact?: string | null
          marketplace_listing_url?: string | null
          marketplace_max_budget?: number | null
          errand_store_name?: string | null
          errand_item_list?: string | null
          errand_estimated_item_cost?: number | null
          junk_disposal_type?: string | null
          junk_tipping_fee_included?: boolean
          return_platform_fee?: number | null
          return_driver_payout?: number | null
          return_base_transport_cost?: number | null
          customer_total?: number | null
          customer_service_fee?: number | null
          driver_net_earnings?: number | null
          courier_cargo_size?: string | null
          courier_urgency?: string | null
          courier_recipient_name?: string | null
          courier_recipient_phone?: string | null
          courier_building_details?: string | null
          courier_require_signature?: boolean | null
          courier_safety_acknowledged?: boolean | null
          courier_express_multiplier?: number | null
        }
        Update: {
          id?: string
          customer_user_id?: string
          assigned_courier_id?: string | null
          status?: string | null
          pickup_location_text?: string
          dropoff_location_text?: string
          pickup_lat?: number
          pickup_lng?: number
          dropoff_lat?: number
          dropoff_lng?: number
          distance_km?: number
          cargo_weight_kg?: number | null
          cargo_size_category?: string | null
          cargo_notes?: string | null
          urgency_hours?: number | null
          customer_offer_ttd?: number | null
          recommended_low_ttd?: number | null
          recommended_mid_ttd?: number | null
          recommended_high_ttd?: number | null
          likelihood_label?: string | null
          likelihood_score?: number | null
          created_at?: string | null
          updated_at?: string | null
          cargo_category?: string | null
          cargo_category_custom?: string | null
          cargo_photo_url?: string | null
          delivery_type?: string | null
          scheduled_pickup_time?: string | null
          scheduled_dropoff_time?: string | null
          pricing_type?: string | null
          is_open_to_bids?: boolean | null
          base_price?: number | null
          platform_fee?: number | null
          vat_amount?: number | null
          total_price?: number | null
          courier_earnings?: number | null
          courier_location_lat?: number | null
          courier_location_lng?: number | null
          location_updated_at?: string | null
          tracking_enabled?: boolean | null
          is_fragile?: boolean | null
          needs_cover?: boolean | null
          requires_heavy_lift?: boolean | null
          has_security_gate?: boolean | null
          special_requirements_notes?: string | null
          delivery_order_type?: string | null
          is_multi_stop?: boolean | null
          has_multiple_pickups?: boolean | null
          pickups?: Json | null
          dropoffs?: Json | null
          total_distance_km?: number | null
          eta_minutes?: number | null
          proof_of_delivery?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          cancellation_fee_eligible?: boolean | null
          cancellation_fee_percent?: number | null
          cancellation_fee_amount_ttd?: number | null
          cancellation_fee_applied?: boolean | null
          proof_of_delivery_required?: string
          assigned_company_id?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          assignment_type?: string | null
          assigned_driver_name?: string | null
          assigned_vehicle_label?: string | null
          assigned_company_name?: string | null
          assigned_company_logo_url?: string | null
          job_reference_id?: string | null
          job_type?: string
          marketplace_seller_contact?: string | null
          marketplace_listing_url?: string | null
          marketplace_max_budget?: number | null
          errand_store_name?: string | null
          errand_item_list?: string | null
          errand_estimated_item_cost?: number | null
          junk_disposal_type?: string | null
          junk_tipping_fee_included?: boolean
          return_platform_fee?: number | null
          return_driver_payout?: number | null
          return_base_transport_cost?: number | null
          customer_total?: number | null
          customer_service_fee?: number | null
          driver_net_earnings?: number | null
          courier_cargo_size?: string | null
          courier_urgency?: string | null
          courier_recipient_name?: string | null
          courier_recipient_phone?: string | null
          courier_building_details?: string | null
          courier_require_signature?: boolean | null
          courier_safety_acknowledged?: boolean | null
          courier_express_multiplier?: number | null
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string | null
          sender_type: string
          content: string
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id?: string | null
          sender_type: string
          content: string
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string | null
          sender_type?: string
          content?: string
          metadata?: Json | null
          created_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          data: Json | null
          read: boolean | null
          read_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          push_sent: boolean | null
          push_sent_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          data?: Json | null
          read?: boolean | null
          read_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          push_sent?: boolean | null
          push_sent_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          data?: Json | null
          read?: boolean | null
          read_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          push_sent?: boolean | null
          push_sent_at?: string | null
          created_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          role: string
          first_name: string | null
          last_name: string | null
          full_name: string | null
          email: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
          customer_payment_method: string | null
          customer_payment_last4: string | null
          customer_payment_verified: boolean | null
          customer_payment_added_at: string | null
          courier_bank_name: string | null
          courier_bank_account_name: string | null
          courier_bank_account_number: string | null
          courier_bank_routing_number: string | null
          courier_bank_verified: boolean | null
          courier_bank_verified_at: string | null
          courier_bank_verified_by: string | null
          courier_bank_added_at: string | null
          company_name: string | null
          company_email: string | null
          company_address: string | null
          business_verification_status: string | null
          business_verified: boolean | null
          business_verified_at: string | null
          business_verified_by: string | null
          business_type: string | null
          haulage_company_logo_url: string | null
          haulage_business_registration: string | null
          haulage_years_in_operation: number | null
          haulage_insurance_status: string | null
          haulage_insurance_expiry: string | null
          haulage_operating_regions: string[] | null
          haulage_cargo_specialties: string[] | null
          haulage_insurance_certificate_url: string | null
          haulage_cargo_insurance_amount: number | null
          haulage_operating_license_number: string | null
          haulage_operating_license_expiry: string | null
          haulage_dot_number: string | null
          haulage_safety_rating: string | null
          haulage_service_hours: string | null
          haulage_max_fleet_capacity_kg: number | null
          haulage_equipment_types: string[] | null
          haulage_payment_terms: string | null
          haulage_tax_id: string | null
          haulage_billing_email: string | null
          haulage_billing_phone: string | null
          haulage_emergency_contact: string | null
          haulage_dispatch_phone: string | null
          haulage_preferred_contact_method: string | null
          haulage_service_highlights: string | null
          haulage_on_time_delivery_rate: number | null
          haulage_incident_rate: number | null
          haulage_onboarding_completed: boolean | null
          haulage_company_code: string | null
          rating_average: number | null
          rating_count: number | null
          completed_deliveries_count: number | null
          home_base_location_text: string | null
          home_base_lat: number | null
          home_base_lng: number | null
          is_company_driver: boolean
          linked_company_id: string | null
          has_seen_tutorial: boolean
          customer_billing_address: string | null
        }
        Insert: {
          id: string
          role: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          customer_payment_method?: string | null
          customer_payment_last4?: string | null
          customer_payment_verified?: boolean | null
          customer_payment_added_at?: string | null
          courier_bank_name?: string | null
          courier_bank_account_name?: string | null
          courier_bank_account_number?: string | null
          courier_bank_routing_number?: string | null
          courier_bank_verified?: boolean | null
          courier_bank_verified_at?: string | null
          courier_bank_verified_by?: string | null
          courier_bank_added_at?: string | null
          company_name?: string | null
          company_email?: string | null
          company_address?: string | null
          business_verification_status?: string | null
          business_verified?: boolean | null
          business_verified_at?: string | null
          business_verified_by?: string | null
          business_type?: string | null
          haulage_company_logo_url?: string | null
          haulage_business_registration?: string | null
          haulage_years_in_operation?: number | null
          haulage_insurance_status?: string | null
          haulage_insurance_expiry?: string | null
          haulage_operating_regions?: string[] | null
          haulage_cargo_specialties?: string[] | null
          haulage_insurance_certificate_url?: string | null
          haulage_cargo_insurance_amount?: number | null
          haulage_operating_license_number?: string | null
          haulage_operating_license_expiry?: string | null
          haulage_dot_number?: string | null
          haulage_safety_rating?: string | null
          haulage_service_hours?: string | null
          haulage_max_fleet_capacity_kg?: number | null
          haulage_equipment_types?: string[] | null
          haulage_payment_terms?: string | null
          haulage_tax_id?: string | null
          haulage_billing_email?: string | null
          haulage_billing_phone?: string | null
          haulage_emergency_contact?: string | null
          haulage_dispatch_phone?: string | null
          haulage_preferred_contact_method?: string | null
          haulage_service_highlights?: string | null
          haulage_on_time_delivery_rate?: number | null
          haulage_incident_rate?: number | null
          haulage_onboarding_completed?: boolean | null
          haulage_company_code?: string | null
          is_company_driver?: boolean
          linked_company_id?: string | null
          has_seen_tutorial?: boolean
          customer_billing_address?: string | null
        }
        Update: {
          id?: string
          role?: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          customer_payment_method?: string | null
          customer_payment_last4?: string | null
          customer_payment_verified?: boolean | null
          customer_payment_added_at?: string | null
          courier_bank_name?: string | null
          courier_bank_account_name?: string | null
          courier_bank_account_number?: string | null
          courier_bank_routing_number?: string | null
          courier_bank_verified?: boolean | null
          courier_bank_verified_at?: string | null
          courier_bank_verified_by?: string | null
          courier_bank_added_at?: string | null
          company_name?: string | null
          company_email?: string | null
          company_address?: string | null
          business_verification_status?: string | null
          business_verified?: boolean | null
          business_verified_at?: string | null
          business_verified_by?: string | null
          business_type?: string | null
          haulage_company_logo_url?: string | null
          haulage_business_registration?: string | null
          haulage_years_in_operation?: number | null
          haulage_insurance_status?: string | null
          haulage_insurance_expiry?: string | null
          haulage_operating_regions?: string[] | null
          haulage_cargo_specialties?: string[] | null
          haulage_insurance_certificate_url?: string | null
          haulage_cargo_insurance_amount?: number | null
          haulage_operating_license_number?: string | null
          haulage_operating_license_expiry?: string | null
          haulage_dot_number?: string | null
          haulage_safety_rating?: string | null
          haulage_service_hours?: string | null
          haulage_max_fleet_capacity_kg?: number | null
          haulage_equipment_types?: string[] | null
          haulage_payment_terms?: string | null
          haulage_tax_id?: string | null
          haulage_billing_email?: string | null
          haulage_billing_phone?: string | null
          haulage_emergency_contact?: string | null
          haulage_dispatch_phone?: string | null
          haulage_preferred_contact_method?: string | null
          haulage_service_highlights?: string | null
          haulage_on_time_delivery_rate?: number | null
          haulage_incident_rate?: number | null
          haulage_onboarding_completed?: boolean | null
          haulage_company_code?: string | null
          is_company_driver?: boolean
          linked_company_id?: string | null
          has_seen_tutorial?: boolean
          customer_billing_address?: string | null
        }
      }
      business_subscriptions: {
        Row: {
          id: string
          business_user_id: string
          plan_type: string
          status: string
          trial_start_date: string | null
          trial_end_date: string | null
          current_period_start: string | null
          current_period_end: string | null
          monthly_amount_ttd: number
          billing_bank_name: string | null
          billing_bank_account_name: string | null
          billing_bank_account_number: string | null
          billing_bank_routing_number: string | null
          payment_info_added_at: string | null
          last_payment_date: string | null
          last_payment_amount_ttd: number | null
          next_billing_date: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          business_user_id: string
          plan_type?: string
          status?: string
          trial_start_date?: string | null
          trial_end_date?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          monthly_amount_ttd?: number
          billing_bank_name?: string | null
          billing_bank_account_name?: string | null
          billing_bank_account_number?: string | null
          billing_bank_routing_number?: string | null
          payment_info_added_at?: string | null
          last_payment_date?: string | null
          last_payment_amount_ttd?: number | null
          next_billing_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          business_user_id?: string
          plan_type?: string
          status?: string
          trial_start_date?: string | null
          trial_end_date?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          monthly_amount_ttd?: number
          billing_bank_name?: string | null
          billing_bank_account_name?: string | null
          billing_bank_account_number?: string | null
          billing_bank_routing_number?: string | null
          payment_info_added_at?: string | null
          last_payment_date?: string | null
          last_payment_amount_ttd?: number | null
          next_billing_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      subscription_payments: {
        Row: {
          id: string
          subscription_id: string
          business_user_id: string
          amount_ttd: number
          payment_method: string
          payment_reference: string | null
          status: string
          period_start: string | null
          period_end: string | null
          confirmed_by_admin_id: string | null
          confirmed_at: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          subscription_id: string
          business_user_id: string
          amount_ttd: number
          payment_method?: string
          payment_reference?: string | null
          status?: string
          period_start?: string | null
          period_end?: string | null
          confirmed_by_admin_id?: string | null
          confirmed_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          subscription_id?: string
          business_user_id?: string
          amount_ttd?: number
          payment_method?: string
          payment_reference?: string | null
          status?: string
          period_start?: string | null
          period_end?: string | null
          confirmed_by_admin_id?: string | null
          confirmed_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
      }
      proof_of_delivery: {
        Row: {
          id: string
          job_id: string
          required_type: string
          status: string
          photo_urls: string[] | null
          signature_image_url: string | null
          signed_by_name: string | null
          completed_at: string | null
          completed_by_user_id: string | null
          completed_by_profile_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          required_type?: string
          status?: string
          photo_urls?: string[] | null
          signature_image_url?: string | null
          signed_by_name?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          completed_by_profile_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          required_type?: string
          status?: string
          photo_urls?: string[] | null
          signature_image_url?: string | null
          signed_by_name?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          completed_by_profile_type?: string | null
          created_at?: string
          updated_at?: string
        }
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
