
// هذا ملف نائب لأنواع قاعدة بيانات Supabase.
// قم بإنشاء هذا الملف باستخدام Supabase CLI:
// supabase gen types typescript --project-id your-project-id > src/lib/database.types.ts
// أو إذا كنت تستخدم الاستدلال المحلي للمخطط:
// supabase gen types typescript --local > src/lib/database.types.ts

// تعريفات مؤقتة إذا لم يتم إنشاء الملف أعلاه بعد.
// تأكد من أن هذه التعريفات تتطابق مع مخطط قاعدة بياناتك.
//  **مهم:** لتغيير هذا لدعم صور متعددة، يجب عليك تعديل
//  جدول 'patients' في Supabase. يُقترح تغيير العمود 'image_url'
//  إلى 'image_urls' من نوع 'TEXT[]' (مصفوفة نصوص).
//  التعريف أدناه يعكس هذا التغيير المقترح.

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
      patients: {
        Row: {
          id: string
          name: string
          age: number
          phone: string
          email: string
          image_urls: string[] | null // Changed from image_url: string | null
          created_at: string 
        }
        Insert: {
          id?: string
          name: string
          age: number
          phone: string
          email: string
          image_urls?: string[] | null // Changed
          created_at?: string 
        }
        Update: {
          id?: string
          name?: string
          age?: number
          phone?: string
          email?: string
          image_urls?: string[] | null // Changed
          created_at?: string 
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          patient_id: string
          date: string // YYYY-MM-DD
          time: string // HH:MM
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          date: string
          time: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          date?: string
          time?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}
