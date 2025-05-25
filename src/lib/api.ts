
import { supabase } from './supabaseClient';
import type { Patient, Appointment, PatientSelectItem } from './types';

// Helper to map Supabase patient row to our Patient type
function mapPatientRowToPatient(row: any): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    phone: row.phone,
    email: row.email,
    imageUrls: row.image_urls || [], // Changed from image_url to image_urls
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
    image_urls: patientData.imageUrls, // Changed from image_url
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
   if (patientData.imageUrls !== undefined) patientToUpdate.image_urls = patientData.imageUrls; // Changed

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
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error('Error deleting related appointments for patient:', id, appointmentError);
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
    .select('*, patients(name)') 
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
    .select('*, patients(name)') 
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
    .select('*, patients(name)') 
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

// Supabase storage for image upload
export async function uploadPatientImage(file: File, identifier?: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const uniqueIdentifier = identifier || crypto.randomUUID(); // Use provided ID or generate a UUID
    const fileName = `${uniqueIdentifier}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from('patient-images') // Ensure this bucket exists and RLS policies are set
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('patient-images')
      .getPublicUrl(data.path);
      
    if (!urlData || !urlData.publicUrl) {
        // Attempt to delete the uploaded file if URL retrieval fails, to avoid orphaned files
        await supabase.storage.from('patient-images').remove([filePath]);
        throw new Error("Could not get public URL for uploaded image.");
    }

    return urlData.publicUrl;
}
