
import { supabase } from './supabaseClient';
import type { Patient, Appointment, PatientSelectItem } from './types';
import { format } from 'date-fns'; // format is not used here anymore but kept if needed later

// Helper to map Supabase patient row to our Patient type
function mapPatientRowToPatient(row: any): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    phone: row.phone,
    email: row.email,
    imageUrl: row.image_url || undefined,
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
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}


// Patient Functions
export async function getPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching patients:', error);
    throw error;
  }
  return data ? data.map(mapPatientRowToPatient) : [];
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return undefined; // Not found
    console.error('Error fetching patient by ID:', error);
    throw error;
  }
  return data ? mapPatientRowToPatient(data) : undefined;
}

export async function addPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
  const patientToInsert = {
    name: patientData.name,
    age: patientData.age,
    phone: patientData.phone,
    email: patientData.email,
    image_url: patientData.imageUrl,
    // created_at is set by default in Supabase or can be set here
  };
  const { data, error } = await supabase
    .from('patients')
    .insert(patientToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
  return mapPatientRowToPatient(data);
}

export async function updatePatient(id: string, patientData: Partial<Omit<Patient, 'id' | 'createdAt'>>): Promise<Patient | null> {
   const patientToUpdate: Record<string, any> = {};
   if (patientData.name !== undefined) patientToUpdate.name = patientData.name;
   if (patientData.age !== undefined) patientToUpdate.age = patientData.age;
   if (patientData.phone !== undefined) patientToUpdate.phone = patientData.phone;
   if (patientData.email !== undefined) patientToUpdate.email = patientData.email;
   if (patientData.imageUrl !== undefined) patientToUpdate.image_url = patientData.imageUrl;

  const { data, error } = await supabase
    .from('patients')
    .update(patientToUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
  return data ? mapPatientRowToPatient(data) : null;
}

export async function deletePatient(id: string): Promise<boolean> {
  // Optional: Consider deleting related appointments or setting up cascade delete in Supabase
  // For now, just delete the patient.
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error('Error deleting related appointments for patient:', id, appointmentError);
    // Decide if you want to throw or continue to delete the patient
  }
  
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting patient:', error);
    return false;
  }
  return true;
}

export async function getPatientSelectItems(): Promise<PatientSelectItem[]> {
  const patients = await getPatients();
  return patients.map(p => ({ value: p.id, label: p.name }));
}

// Appointment Functions
export async function getAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(name)') // Fetch related patient's name
    .order('date', { ascending: false })
    .order('time', { ascending: false });


  if (error) {
    console.error('Error fetching appointments:', error);
    throw error;
  }
  return data ? data.map(mapAppointmentRowToAppointment) : [];
}

export async function getAppointmentsByDate(date: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(name)')
    .eq('date', date)
    .order('time', { ascending: true });

  if (error) {
    console.error('Error fetching appointments by date:', error);
    throw error;
  }
  return data ? data.map(mapAppointmentRowToAppointment) : [];
}

export async function addAppointment(appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'patientName'>): Promise<Appointment> {
  const appointmentToInsert = {
    patient_id: appointmentData.patientId,
    date: appointmentData.date,
    time: appointmentData.time,
    notes: appointmentData.notes,
  };
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointmentToInsert)
    .select('*, patients(name)') // Fetch related patient's name after insert
    .single();

  if (error) {
    console.error('Error adding appointment:', error);
    throw error;
  }
  return mapAppointmentRowToAppointment(data);
}

export async function updateAppointment(id: string, appointmentData: Partial<Omit<Appointment, 'id' | 'createdAt' | 'patientName'>>): Promise<Appointment | null> {
  const appointmentToUpdate: Record<string, any> = {};
  if (appointmentData.patientId !== undefined) appointmentToUpdate.patient_id = appointmentData.patientId;
  if (appointmentData.date !== undefined) appointmentToUpdate.date = appointmentData.date;
  if (appointmentData.time !== undefined) appointmentToUpdate.time = appointmentData.time;
  if (appointmentData.notes !== undefined) appointmentToUpdate.notes = appointmentData.notes;

  const { data, error } = await supabase
    .from('appointments')
    .update(appointmentToUpdate)
    .eq('id', id)
    .select('*, patients(name)') // Fetch related patient's name after update
    .single();

  if (error) {
    console.error('Error updating appointment:', error);
    throw error;
  }
  return data ? mapAppointmentRowToAppointment(data) : null;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
  return true;
}

// Supabase storage for image upload (Example)
// Make sure you have a bucket named 'patient-images' or similar in your Supabase storage.
// And that RLS policies allow uploads.
export async function uploadPatientImage(file: File, patientId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`; // 'public' is often the folder name in the bucket

    const { data, error } = await supabase.storage
      .from('patient-images') // Replace with your bucket name
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('patient-images') // Replace with your bucket name
      .getPublicUrl(data.path);
      
    if (!urlData) {
        throw new Error("Could not get public URL for uploaded image.");
    }

    return urlData.publicUrl;
}
