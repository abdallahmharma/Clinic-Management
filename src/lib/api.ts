
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
    console.error('Error fetching patients:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
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
    console.error(`Error fetching patient by ID (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? mapPatientRowToPatient(data) : undefined;
}

export async function addPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
  const patientToInsert = {
    name: patientData.name,
    age: patientData.age,
    phone: patientData.phone,
    image_urls: patientData.imageUrls,
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
   const patientToUpdate: Record<string, any> = {};
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

export async function deletePatient(id: string): Promise<boolean> {
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error(`Error deleting related appointments for patient ID ${id}:`, { message: appointmentError.message, details: appointmentError.details, hint: appointmentError.hint, code: appointmentError.code });
    // Depending on requirements, you might want to throw this error or just log it and continue
  }
  
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting patient (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
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
    console.error('Error fetching appointments:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
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
    console.error(`Error fetching appointments by date (${date}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
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
    console.error('Error adding appointment:', { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Input data:', appointmentToInsert);
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
    console.error(`Error updating appointment (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Update data:', appointmentToUpdate);
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
    console.error(`Error deleting appointment (${id}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    return false;
  }
  return true;
}

// Supabase storage for image upload
export async function uploadPatientImage(file: File, identifier?: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const uniqueFilePrefix = identifier || crypto.randomUUID();
    const fileName = `${uniqueFilePrefix}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    // Ensure your Supabase bucket is named 'patient-images' or change the name here.
    // RLS Policies for 'patient-images' bucket:
    // 1. For UPLOADS: Authenticated users (or the appropriate role) need 'insert' permission.
    //    SQL Example:
    //    CREATE POLICY "Allow authenticated uploads to public folder"
    //    ON storage.objects FOR INSERT TO authenticated
    //    WITH CHECK (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
    //
    // 2. For VIEWING: Files in 'public/' path need to be publicly readable for getPublicUrl to work.
    //    SQL Example:
    //    CREATE POLICY "Public read access for public folder"
    //    ON storage.objects FOR SELECT TO public -- or 'anon' if you prefer more explicit anonymous access
    //    USING (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
    //
    //    Alternatively, for more restrictive read access (e.g., only authenticated users):
    //    CREATE POLICY "Authenticated read access for public folder"
    //    ON storage.objects FOR SELECT TO authenticated
    //    USING (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
    //    If using restrictive read, ensure your frontend has authenticated context when fetching images.
    //
    //    Consider your app's security needs when defining these policies.
    //    The `public/` prefix in `filePath` assumes images are intended to be publicly accessible via URL.

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
        await supabase.storage.from('patient-images').remove([filePath]);
        throw new Error("Could not get public URL for uploaded image. The file was removed to prevent orphaned storage.");
    }

    return urlData.publicUrl;
}
