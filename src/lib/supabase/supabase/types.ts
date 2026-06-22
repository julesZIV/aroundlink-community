export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: { [key: string]: { Row: any; Insert: any; Update: any } } & {
      profiles: {
        Row: {
          id: string
          name: string
          first_name: string | null
          last_name: string | null
          email: string | null
          personal_email: string | null
          institution: string | null
          institution_verified: boolean | null
          institution_domain: string | null
          university_id: number | null
          role: string | null
          app_role: 'admin' | 'moderator' | 'member' | 'super_admin'
          linkedin: string | null
          avatar_url: string | null
          country_code: string | null
          links: number
          chips: number
          referral_code: string | null
          is_anonymized: boolean
          onboarding_completed: boolean
          terms_version: string
          terms_accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          personal_email?: string | null
          institution?: string | null
          institution_verified?: boolean | null
          institution_domain?: string | null
          university_id?: number | null
          role?: string | null
          app_role?: 'admin' | 'moderator' | 'member' | 'super_admin'
          linkedin?: string | null
          avatar_url?: string | null
          country_code?: string | null
          links?: number
          chips?: number
          referral_code?: string | null
          is_anonymized?: boolean
          onboarding_completed?: boolean
          terms_version?: string
          terms_accepted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      universities: {
        Row: {
          id: number
          ror_id: string | null
          erasmus_code: string | null
          schac_domain: string | null
          display_name: string
          country_code: string | null
          country_name: string | null
          city: string | null
          lat: number | null
          lng: number | null
          website: string | null
          wikipedia_url: string | null
          established: number | null
          status: string | null
          types: string[] | null
          domains: string[] | null
          aliases: string[] | null
          acronyms: string[] | null
          wikidata_id: string | null
          isni: string | null
          grid: string | null
          pic: string | null
          oid: string | null
          flag: string | null
          is_erasmus: boolean | null
          ewp_provider: string | null
          ewp_solution: string | null
          ewp_status: string | null
          completion_score: number | null
          is_claimed: boolean | null
          claimed_by: string | null
          contributions: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['universities']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['universities']['Insert']>
      }
      channels: {
        Row: {
          id: string
          emoji: string | null
          name: string
          description: string | null
          member_count: number
          is_official: boolean | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['channels']['Row'], 'created_at' | 'member_count'>
        Update: Partial<Database['public']['Tables']['channels']['Insert']>
      }
      channel_members: {
        Row: { channel_id: string; user_id: string; role: string | null; joined_at: string }
        Insert: { channel_id: string; user_id: string; role?: string }
        Update: Partial<Database['public']['Tables']['channel_members']['Insert']>
      }
      channel_posts: {
        Row: {
          id: string
          channel_id: string
          user_id: string
          text: string | null
          media_type: 'image' | 'pdf' | null
          media_url: string | null
          media_name: string | null
          media_urls: string[] | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['channel_posts']['Row'], 'id' | 'created_at' | 'media_urls'> & { media_urls?: string[] | null }
        Update: Partial<Database['public']['Tables']['channel_posts']['Insert']>
      }
      channel_post_likes: {
        Row: { post_id: string; user_id: string; created_at: string }
        Insert: { post_id: string; user_id: string }
        Update: never
      }
      channel_post_comments: {
        Row: { id: string; post_id: string; user_id: string; text: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['channel_post_comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['channel_post_comments']['Insert']>
      }
      channel_last_seen: {
        Row: { user_id: string; channel_id: string; last_seen_at: string }
        Insert: { user_id: string; channel_id: string; last_seen_at?: string }
        Update: Partial<Database['public']['Tables']['channel_last_seen']['Insert']>
      }
      channel_requests: {
        Row: {
          id: string
          user_id: string
          emoji: string | null
          name: string
          description: string | null
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['channel_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['channel_requests']['Insert']>
      }
      uploads: {
        Row: {
          id: string
          channel_id: string | null
          user_id: string
          name: string
          file_url: string | null
          file_type: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['uploads']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['uploads']['Insert']>
      }
      feed_posts: {
        Row: {
          id: string
          user_id: string
          text: string | null
          media_type: 'image' | 'pdf' | null
          media_url: string | null
          media_name: string | null
          media_urls: string[] | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['feed_posts']['Row'], 'id' | 'created_at' | 'media_urls'> & { media_urls?: string[] | null }
        Update: Partial<Database['public']['Tables']['feed_posts']['Insert']>
      }
      feed_likes: {
        Row: { post_id: string; user_id: string; created_at: string }
        Insert: { post_id: string; user_id: string }
        Update: never
      }
      feed_comments: {
        Row: { id: string; post_id: string; user_id: string; text: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['feed_comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['feed_comments']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          last_message_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'last_message_at'>
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
      direct_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          text: string
          read: boolean
          media_url: string | null
          media_type: 'image' | 'pdf' | null
          media_name: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['direct_messages']['Row'], 'id' | 'created_at' | 'read'>
        Update: Partial<Database['public']['Tables']['direct_messages']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          from_name: string | null
          type: 'mention' | 'invite' | 'comment' | 'like' | 'system' | null
          source: 'channel' | 'feed' | 'invite' | null
          channel_id: string | null
          channel_name: string | null
          post_id: string | null
          read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at' | 'read'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['push_subscriptions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>
      }
      university_claims: {
        Row: {
          id: string
          university_id: number | null
          user_id: string | null
          form_data: Json | null
          status: 'pending' | 'approved' | 'rejected' | null
          reviewed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['university_claims']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['university_claims']['Insert']>
      }
      org_requests: {
        Row: {
          id: string
          user_id: string
          university_id: number | null
          university_name: string | null
          status: 'pending' | 'approved' | 'rejected' | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['org_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['org_requests']['Insert']>
      }
      university_members: {
        Row: {
          university_id: number
          user_id: string
          role: 'admin' | 'member' | null
          status: 'verified' | 'pending' | null
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['university_members']['Row'], 'joined_at'>
        Update: Partial<Database['public']['Tables']['university_members']['Insert']>
      }
      chips_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          reason: string | null
          ref_type: 'upload' | 'channel_post' | 'feed_post' | 'claim' | 'contribution' | 'org_request' | null
          ref_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['chips_transactions']['Row'], 'id' | 'created_at'>
        Update: never
      }
      referrals: {
        Row: {
          id: string
          referrer_id: string
          referee_id: string
          confirmed: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['referrals']['Row'], 'id' | 'created_at'>
        Update: never
      }
      scoring_config: {
        Row: {
          id: string
          label: string
          description: string | null
          points: number
          category: 'onboarding' | 'content' | 'engagement'
          updated_at: string
          updated_by: string
        }
        Insert: Omit<Database['public']['Tables']['scoring_config']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['scoring_config']['Insert']>
      }
      app_settings: {
        Row: { key: string; value: string | null; updated_at: string }
        Insert: { key: string; value?: string | null }
        Update: Partial<Database['public']['Tables']['app_settings']['Insert']>
      }
      user_stats: {
        Row: {
          user_id: string
          feed_posts: number
          channel_messages: number
          files_shared: number
          likes_given: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_stats']['Row'], 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_stats']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      get_or_create_conversation: {
        Args: { other_user_id: string }
        Returns: string
      }
      get_channel_unread: {
        Args: { p_user_id: string }
        Returns: { channel_id: string; unread: number }[]
      }
      anonymize_user: {
        Args: { target_user_id: string }
        Returns: void
      }
      confirm_referral: {
        Args: { p_user_id: string }
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}

// ── Convenience row types ────────────────────────────────────────────────────
export type Profile           = Database['public']['Tables']['profiles']['Row']
export type University        = Database['public']['Tables']['universities']['Row']
export type Channel           = Database['public']['Tables']['channels']['Row']
export type ChannelPost       = Database['public']['Tables']['channel_posts']['Row']
export type ChannelPostLike   = Database['public']['Tables']['channel_post_likes']['Row']
export type ChannelPostComment= Database['public']['Tables']['channel_post_comments']['Row']
export type ChannelLastSeen   = Database['public']['Tables']['channel_last_seen']['Row']
export type ChannelRequest    = Database['public']['Tables']['channel_requests']['Row']
export type Upload            = Database['public']['Tables']['uploads']['Row']
export type FeedPost          = Database['public']['Tables']['feed_posts']['Row']
export type FeedLike          = Database['public']['Tables']['feed_likes']['Row']
export type FeedComment       = Database['public']['Tables']['feed_comments']['Row']
export type Conversation      = Database['public']['Tables']['conversations']['Row']
export type DirectMessage     = Database['public']['Tables']['direct_messages']['Row']
export type Notification      = Database['public']['Tables']['notifications']['Row']
export type PushSubscription  = Database['public']['Tables']['push_subscriptions']['Row']
export type UniversityClaim   = Database['public']['Tables']['university_claims']['Row']
export type OrgRequest        = Database['public']['Tables']['org_requests']['Row']
export type UniversityMember  = Database['public']['Tables']['university_members']['Row']
export type ChipsTransaction  = Database['public']['Tables']['chips_transactions']['Row']
export type Referral          = Database['public']['Tables']['referrals']['Row']
export type ScoringConfig     = Database['public']['Tables']['scoring_config']['Row']
export type AppSetting        = Database['public']['Tables']['app_settings']['Row']
export type UserStats         = Database['public']['Tables']['user_stats']['Row']
