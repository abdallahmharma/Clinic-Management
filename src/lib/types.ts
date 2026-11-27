
export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  imageUrls?: string[]; // Changed from imageUrl to imageUrls array
  createdAt: string; // ISO date string
}

export type AppointmentStatus =
  | 'confirmed'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string; // Denormalized for easier display
  patientPhone?: string; // Joined from patients.phone
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: string; // e.g., 'Check-up', 'Consultation'
  status: AppointmentStatus;
  notes?: string;
  createdAt: string; // ISO date string
}

export type PatientSelectItem = {
  label: string;
  value: string;
};

export type WhatsAppConnectionMode = 'new_cloud_number' | 'existing_business_app';

export type WhatsAppConnectionStatus =
  | 'pending_setup'
  | 'webhook_verified'
  | 'connected'
  | 'error';

export type WhatsAppMessageDirection = 'inbound' | 'outbound';

export type WhatsAppMessageRequestStatus =
  | 'new'
  | 'reviewed'
  | 'converted'
  | 'archived'
  | 'sent'
  | 'failed';

export interface WhatsAppChecklistState {
  meta_business: boolean;
  phone_prepared: boolean;
  webhook_verified: boolean;
  payment_later: boolean;
}

export interface WhatsAppConnectionConfig {
  id: string;
  connectionMode: WhatsAppConnectionMode;
  connectionStatus: WhatsAppConnectionStatus;
  displayPhoneNumber: string;
  businessName: string;
  checklistState: WhatsAppChecklistState;
  lastWebhookAt?: string;
  lastError?: string;
  updatedAt?: string;
}

export interface WhatsAppMessageRecord {
  id: string;
  waMessageId?: string;
  direction: WhatsAppMessageDirection;
  fromPhone: string;
  toPhone?: string;
  contactName?: string;
  patientId?: string;
  messageType: string;
  messageBody: string;
  requestStatus: WhatsAppMessageRequestStatus;
  receivedAt: string;
}

export interface WhatsAppEnvReadiness {
  hasAccessToken: boolean;
  hasPhoneNumberId: boolean;
  hasVerifyToken: boolean;
  hasAppSecret: boolean;
  hasWabaId: boolean;
  isReadyToSend: boolean;
  isWebhookConfigured: boolean;
}

