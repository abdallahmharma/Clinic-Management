
export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  imageUrls?: string[]; // Changed from imageUrl to imageUrls array
  createdAt: string; // ISO date string
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string; // Denormalized for easier display
  patientPhone?: string; // Joined from patients.phone
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: string; // e.g., 'Check-up', 'Consultation'
  notes?: string;
  createdAt: string; // ISO date string
}

export type PatientSelectItem = {
  label: string;
  value: string;
};
