
import { supabase } from './supabaseClient';
import type { Patient, Appointment } from './types';

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

export async function deletePatient(id: string): Promise<void> {
  // First, delete related appointments
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error(`Error deleting related appointments for patient ID ${id}:`, { message: appointmentError.message, details: appointmentError.details, hint: appointmentError.hint, code: appointmentError.code });
    // Decide if this error should stop the patient deletion
    // For now, we'll throw it to make the whole operation atomic from the client's perspective
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
  // No return needed for void, or return true if you change the signature back to Promise<boolean>
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
  const appointmentToUpdate: Record<string, any> = {};
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
    const fileExt = file.name.split('.').pop();
    const uniqueFilePrefix = identifier || crypto.randomUUID(); // Use provided identifier or generate a new UUID
    const fileName = `${uniqueFilePrefix}-${Date.now()}.${fileExt}`;
    // It's common practice to use a 'public' folder inside your bucket for publicly accessible files.
    // Adjust the path if your bucket structure is different.
    const filePath = `public/${fileName}`; // Files will be stored under a 'public' folder in the bucket.

    // Ensure your Supabase bucket is named 'patient-images'.
    // RLS Policies for 'patient-images' bucket:
    //
    // 1. For PUBLIC READ ACCESS (SELECT):
    //    Allow anyone to read objects from the 'public' folder within the 'patient-images' bucket.
    //    This is needed for the image URLs to work directly in <img> tags or next/image.
    //
    //    CREATE POLICY "Public Read Access for Public Folder in Patient Images"
    //    ON storage.objects FOR SELECT
    //    TO public -- Or 'anon' for unauthenticated access
    //    USING (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
    //
    // 2. For AUTHENTICATED UPLOADS (INSERT):
    //    Allow authenticated users to upload (insert) objects into the 'public' folder.
    //
    //    CREATE POLICY "Authenticated Upload to Public Folder in Patient Images"
    //    ON storage.objects FOR INSERT
    //    TO authenticated
    //    WITH CHECK (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
    //
    // 3. For AUTHENTICATED DELETES (DELETE):
    //    Allow authenticated users to delete objects from the 'public' folder.
    //
    //    CREATE POLICY "Authenticated Delete from Public Folder in Patient Images"
    //    ON storage.objects FOR DELETE
    //    TO authenticated
    //    USING (bucket_id = 'patient-images' AND (storage.foldername(name))[1] = 'public');
    //
    // Note: If your app doesn't have user authentication yet, you might temporarily use 'public' or 'anon'
    // for INSERT/DELETE policies for testing, BUT THIS IS HIGHLY INSECURE FOR PRODUCTION.
    // Always secure write access in a production environment.

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
        // Try to remove the orphaned file to avoid clutter and potential issues.
        await supabase.storage.from('patient-images').remove([filePath]).catch(removeError => {
            console.error("Failed to remove orphaned file after public URL failure:", removeError, filePath);
        });
        throw new Error("Could not get public URL for uploaded image. The file was removed to prevent orphaned storage.");
    }

    return urlData.publicUrl;
}
