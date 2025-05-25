
import { supabase } from './supabaseClient';
import type { Patient, Appointment, PatientSelectItem } from './types';

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
    image_urls: patientData.imageUrls, // Ensure this matches Supabase column name
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
   if (patientData.imageUrls !== undefined) patientToUpdate.image_urls = patientData.imageUrls; // Ensure this matches Supabase column name

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
  // First, delete related appointments if necessary, or handle DB constraints
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error('Error deleting related appointments for patient:', id, appointmentError);
    // Depending on requirements, you might want to throw this error or just log it
  }
  
  // Then, delete the patient
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
    // Use provided ID for existing patient, or generate a UUID for new patient or if ID is not yet available
    const uniqueFilePrefix = identifier || crypto.randomUUID();
    const fileName = `${uniqueFilePrefix}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`; // Files are stored under a 'public' folder in the bucket

    const { data, error: uploadError } = await supabase.storage
      .from('patient-images') // Ensure this bucket exists in Supabase Storage.
      // RLS (Row Level Security) policies for this bucket are crucial:
      // 1. For UPLOADS: Authenticated users (or the appropriate role for your app) must have `insert` permission.
      //    Example policy for authenticated uploads:
      //    CREATE POLICY "Allow authenticated uploads" ON storage.objects
      //    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-images');
      // 2. For VIEWING: Files (especially in `public/` path or specific object paths) need to be publicly readable
      //    for `getPublicUrl` to work and images to display.
      //    Example policy for public read on 'public' folder:
      //    CREATE POLICY "Public read access for public folder" ON storage.objects
      //    FOR SELECT TO public USING (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
      //    Adjust paths and roles as per your security needs.
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('patient-images')
      .getPublicUrl(data.path); // data.path from upload result is the filePath
      
    if (!urlData || !urlData.publicUrl) {
        // Attempt to delete the uploaded file if URL retrieval fails, to avoid orphaned files
        console.warn("Uploaded image but could not get public URL. Attempting to remove orphaned file:", filePath);
        await supabase.storage.from('patient-images').remove([filePath]);
        throw new Error("Could not get public URL for uploaded image. The file was removed to prevent orphaned storage.");
    }

    return urlData.publicUrl;
}

