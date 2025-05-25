
export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  imageUrls?: string[]; // Changed from imageUrl to imageUrls array
  createdAt: string; // ISO date string
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string; // Denormalized for easier display
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string;
  createdAt: string; // ISO date string
}

// For forms, especially patient selection
export interface PatientSelectItem {
  value: string; // patient.id
  label: string; // patient.name
}
