
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Database } from './database.types';
import type { Patient, Appointment } from './types';

// --- In-Memory / LocalStorage Mock Store (used when Supabase is not configured) ---
const MOCK_PATIENTS_KEY = 'clinic_mock_patients_v1';
const MOCK_APPOINTMENTS_KEY = 'clinic_mock_appointments_v1';

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getInitialMockPatients(): Patient[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'mock-patient-1',
      name: 'سارة أحمد محمد',
      age: 29,
      phone: '0771234567',
      imageUrls: [],
      createdAt: nowIso,
    },
    {
      id: 'mock-patient-2',
      name: 'علي حسن كريم',
      age: 35,
      phone: '0789876543',
      imageUrls: [],
      createdAt: nowIso,
    },
    {
      id: 'mock-patient-3',
      name: 'نور الهدى خالد',
      age: 26,
      phone: '0795551234',
      imageUrls: [],
      createdAt: nowIso,
    },
  ];
}

function getInitialMockAppointments(): Appointment[] {
  const today = getTodayString();
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'mock-appt-1',
      patientId: 'mock-patient-1',
      patientName: 'سارة أحمد محمد',
      date: today,
      time: '10:00',
      type: 'بشرة',
      notes: 'جلسة تنظيف ونضارة البشرة',
      createdAt: nowIso,
    },
    {
      id: 'mock-appt-2',
      patientId: 'mock-patient-2',
      patientName: 'علي حسن كريم',
      date: today,
      time: '12:30',
      type: 'استشارة',
      notes: 'متابعة دورية',
      createdAt: nowIso,
    },
  ];
}

let memoryPatients: Patient[] | null = null;
let memoryAppointments: Appointment[] | null = null;

function loadMockPatients(): Patient[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(MOCK_PATIENTS_KEY);
      if (raw) {
        memoryPatients = JSON.parse(raw);
        return memoryPatients!;
      }
    } catch {
      // ignore storage errors
    }
  }
  if (!memoryPatients) {
    memoryPatients = getInitialMockPatients();
    saveMockPatients(memoryPatients);
  }
  return memoryPatients;
}

function saveMockPatients(patients: Patient[]): void {
  memoryPatients = patients;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MOCK_PATIENTS_KEY, JSON.stringify(patients));
    } catch {
      // ignore storage quota errors
    }
  }
}

function loadMockAppointments(): Appointment[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(MOCK_APPOINTMENTS_KEY);
      if (raw) {
        memoryAppointments = JSON.parse(raw);
        return memoryAppointments!;
      }
    } catch {
      // ignore storage errors
    }
  }
  if (!memoryAppointments) {
    memoryAppointments = getInitialMockAppointments();
    saveMockAppointments(memoryAppointments);
  }
  return memoryAppointments;
}

function saveMockAppointments(appointments: Appointment[]): void {
  memoryAppointments = appointments;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MOCK_APPOINTMENTS_KEY, JSON.stringify(appointments));
    } catch {
      // ignore storage quota errors
    }
  }
}

// Helper to map Supabase patient row to our Patient type
function mapPatientRowToPatient(row: any): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    phone: row.phone,
    imageUrls: row.image_urls || [],
    createdAt: row.created_at,
  };
}

// Helper to map Supabase appointment row to our Appointment type
function mapAppointmentRowToAppointment(row: any): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patients?.name || 'اسم غير معروف', // Assuming 'patients' is the related table
    date: row.date,
    time: row.time,
    type: row.type || 'غير محدد',
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}


// Patient Functions
export async function getPatients(): Promise<Patient[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [...loadMockPatients()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching patients:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? data.map(mapPatientRowToPatient) : [];
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return loadMockPatients().find(p => p.id === id);
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return undefined; // Not found
    console.error(`Error fetching patient by ID (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? mapPatientRowToPatient(data) : undefined;
}

export async function addPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
  if (!isSupabaseConfigured || !supabase) {
    const patients = loadMockPatients();
    const newPatient: Patient = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `patient-${Date.now()}`,
      name: patientData.name,
      age: patientData.age,
      phone: patientData.phone,
      imageUrls: patientData.imageUrls || [],
      createdAt: new Date().toISOString(),
    };
    saveMockPatients([newPatient, ...patients]);
    return newPatient;
  }

  const patientToInsert = {
    name: patientData.name,
    age: patientData.age,
    phone: patientData.phone,
    image_urls: patientData.imageUrls, // Ensure this is null or an array of strings
  };
  const { data, error } = await supabase
    .from('patients')
    .insert(patientToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error adding patient:', { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Input data:', patientToInsert);
    throw error;
  }
  return mapPatientRowToPatient(data);
}

export async function updatePatient(id: string, patientData: Partial<Omit<Patient, 'id' | 'createdAt'>>): Promise<Patient | null> {
  if (!isSupabaseConfigured || !supabase) {
    const patients = loadMockPatients();
    const idx = patients.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const updated: Patient = {
      ...patients[idx],
      ...patientData,
      imageUrls: patientData.imageUrls !== undefined ? (patientData.imageUrls || []) : patients[idx].imageUrls,
    };
    const nextPatients = [...patients];
    nextPatients[idx] = updated;
    saveMockPatients(nextPatients);

    if (patientData.name !== undefined) {
      const appointments = loadMockAppointments();
      saveMockAppointments(
        appointments.map(a => (a.patientId === id ? { ...a, patientName: patientData.name! } : a))
      );
    }
    return updated;
  }

   const patientToUpdate: Database['public']['Tables']['patients']['Update'] = {};
   if (patientData.name !== undefined) patientToUpdate.name = patientData.name;
   if (patientData.age !== undefined) patientToUpdate.age = patientData.age;
   if (patientData.phone !== undefined) patientToUpdate.phone = patientData.phone;
   if (patientData.imageUrls !== undefined) patientToUpdate.image_urls = patientData.imageUrls;

  const { data, error } = await supabase
    .from('patients')
    .update(patientToUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating patient (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Update data:', patientToUpdate);
    throw error;
  }
  return data ? mapPatientRowToPatient(data) : null;
}

export async function deletePatient(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    saveMockAppointments(loadMockAppointments().filter(a => a.patientId !== id));
    saveMockPatients(loadMockPatients().filter(p => p.id !== id));
    return;
  }

  // First, delete related appointments
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error(`Error deleting related appointments for patient ID ${id}:`, { message: appointmentError.message, details: appointmentError.details, hint: appointmentError.hint, code: appointmentError.code });
    throw appointmentError;
  }
  
  // Then, delete the patient
  const { error: patientError } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);

  if (patientError) {
    console.error(`Error deleting patient (${id}):`, { message: patientError.message, details: patientError.details, hint: patientError.hint, code: patientError.code });
    throw patientError; // Throw error to indicate failure
  }
}

// Appointment Functions
export async function getAppointments(): Promise<Appointment[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [...loadMockAppointments()].sort(
      (a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
    );
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(name)') 
    .order('date', { ascending: false })
    .order('time', { ascending: false });


  if (error) {
    console.error('Error fetching appointments:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? data.map(mapAppointmentRowToAppointment) : [];
}

export async function getAppointmentsByDate(date: string): Promise<Appointment[]> {
  if (!isSupabaseConfigured || !supabase) {
    return loadMockAppointments()
      .filter(a => a.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(name)')
    .eq('date', date)
    .order('time', { ascending: true });

  if (error) {
    console.error(`Error fetching appointments by date (${date}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? data.map(mapAppointmentRowToAppointment) : [];
}

export async function addAppointment(appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'patientName'>): Promise<Appointment> {
  if (!isSupabaseConfigured || !supabase) {
    const patients = loadMockPatients();
    const patient = patients.find(p => p.id === appointmentData.patientId);
    const newAppointment: Appointment = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `appt-${Date.now()}`,
      patientId: appointmentData.patientId,
      patientName: patient?.name || 'اسم غير معروف',
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type || 'غير محدد',
      notes: appointmentData.notes || undefined,
      createdAt: new Date().toISOString(),
    };
    saveMockAppointments([newAppointment, ...loadMockAppointments()]);
    return newAppointment;
  }

  const appointmentToInsert = {
    patient_id: appointmentData.patientId,
    date: appointmentData.date,
    time: appointmentData.time,
    type: appointmentData.type,
    notes: appointmentData.notes,
  };
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointmentToInsert)
    .select('*, patients(name)') 
    .single();

  if (error) {
    console.error('Error adding appointment:', { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Input data:', appointmentToInsert);
    throw error;
  }
  return mapAppointmentRowToAppointment(data);
}

export async function updateAppointment(id: string, appointmentData: Partial<Omit<Appointment, 'id' | 'createdAt' | 'patientName'>>): Promise<Appointment | null> {
  if (!isSupabaseConfigured || !supabase) {
    const appointments = loadMockAppointments();
    const idx = appointments.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const patients = loadMockPatients();
    const targetPatientId = appointmentData.patientId ?? appointments[idx].patientId;
    const patient = patients.find(p => p.id === targetPatientId);
    const updated: Appointment = {
      ...appointments[idx],
      ...appointmentData,
      patientName: patient?.name || appointments[idx].patientName,
    };
    const next = [...appointments];
    next[idx] = updated;
    saveMockAppointments(next);
    return updated;
  }

  const appointmentToUpdate: Database['public']['Tables']['appointments']['Update'] = {};
  if (appointmentData.patientId !== undefined) appointmentToUpdate.patient_id = appointmentData.patientId;
  if (appointmentData.date !== undefined) appointmentToUpdate.date = appointmentData.date;
  if (appointmentData.time !== undefined) appointmentToUpdate.time = appointmentData.time;
  if (appointmentData.type !== undefined) appointmentToUpdate.type = appointmentData.type;
  if (appointmentData.notes !== undefined) appointmentToUpdate.notes = appointmentData.notes;

  const { data, error } = await supabase
    .from('appointments')
    .update(appointmentToUpdate)
    .eq('id', id)
    .select('*, patients(name)') 
    .single();

  if (error) {
    console.error(`Error updating appointment (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Update data:', appointmentToUpdate);
    throw error;
  }
  return data ? mapAppointmentRowToAppointment(data) : null;
}

export async function deleteAppointment(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    saveMockAppointments(loadMockAppointments().filter(a => a.id !== id));
    return;
  }

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting appointment (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error; // Throw error to indicate failure
  }
}

// Supabase storage for image upload
export async function uploadPatientImage(file: File, identifier?: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    if (typeof FileReader !== 'undefined') {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
    }
    return `https://placehold.co/400x400?text=${encodeURIComponent(file.name)}`;
  }

    const fileExt = file.name.split('.').pop();
    const uniqueFilePrefix = identifier || crypto.randomUUID(); // Use provided identifier or generate a new UUID
    const fileName = `${uniqueFilePrefix}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from('patient-images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image to Supabase Storage:', { message: uploadError.message, name: (uploadError as any).name, status: (uploadError as any).status }, 'File path:', filePath);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('patient-images')
      .getPublicUrl(data.path);
      
    if (!urlData || !urlData.publicUrl) {
        console.warn("Uploaded image but could not get public URL. Attempting to remove orphaned file:", filePath);
        await supabase.storage.from('patient-images').remove([filePath]).catch(removeError => {
            console.error("Failed to remove orphaned file after public URL failure:", removeError, filePath);
        });
        throw new Error("Could not get public URL for uploaded image. The file was removed to prevent orphaned storage.");
    }

    return urlData.publicUrl;
}
