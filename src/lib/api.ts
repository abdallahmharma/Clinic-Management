
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { compressImageToWebP, getStoragePathFromUrl, isDisplayableImageSrc } from './utils';
import type { Database } from './database.types';
import type { Patient, Appointment, AppointmentStatus } from './types';
import { isActiveUpcomingStatus, normalizeAppointmentStatus } from './appointment-status';

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
      patientPhone: '0771234567',
      date: today,
      time: '10:00',
      type: 'بشرة',
      status: 'confirmed',
      notes: 'جلسة تنظيف ونضارة البشرة',
      createdAt: nowIso,
    },
    {
      id: 'mock-appt-2',
      patientId: 'mock-patient-2',
      patientName: 'علي حسن كريم',
      patientPhone: '0789876543',
      date: today,
      time: '12:30',
      type: 'استشارة',
      status: 'confirmed',
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
        const parsed = JSON.parse(raw);
        memoryAppointments = Array.isArray(parsed)
          ? parsed.map((appt) => ({
              ...appt,
              status: normalizeAppointmentStatus(appt?.status),
            }))
          : [];
        return memoryAppointments;
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
    patientName: row.patients?.name || 'اسم غير معروف',
    patientPhone: row.patients?.phone || undefined,
    date: row.date,
    time: row.time,
    type: row.type || 'غير محدد',
    status: normalizeAppointmentStatus(row?.status),
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}


const SUPABASE_BATCH_SIZE = 1000;

export interface PaginatedPatientsParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}

export interface PaginatedPatientsResult {
  patients: Patient[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function sanitizeSearchTermForPostgrest(searchTerm: string): string {
  return searchTerm
    .trim()
    .replace(/[,()%*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterAndSortMockPatients(searchTerm?: string): Patient[] {
  const normalized = (searchTerm || '').trim().toLowerCase();
  const sorted = [...loadMockPatients()].sort((a, b) => {
    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  if (!normalized) return sorted;
  return sorted.filter(
    (p) =>
      p.name.toLowerCase().includes(normalized) ||
      p.phone.toLowerCase().includes(normalized)
  );
}

// Patient Functions
export async function getPatientsPaginated(
  params: PaginatedPatientsParams = {}
): Promise<PaginatedPatientsResult> {
  const safePageSize = Math.min(Math.max(1, Math.floor(params.pageSize ?? 50)), 200);
  const requestedPage = Math.max(1, Math.floor(params.page ?? 1));
  const rawSearch = params.searchTerm || '';

  if (!isSupabaseConfigured || !supabase) {
    const allFiltered = filterAndSortMockPatients(rawSearch);
    const totalCount = allFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const safePage = Math.min(requestedPage, totalPages);
    const from = (safePage - 1) * safePageSize;
    return {
      patients: allFiltered.slice(from, from + safePageSize),
      totalCount,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  const cleanSearch = sanitizeSearchTermForPostgrest(rawSearch);
  const runPageQuery = async (targetPage: number) => {
    const from = (targetPage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let query = supabase!
      .from('patients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (cleanSearch) {
      const pattern = `%${cleanSearch}%`;
      query = query.or(`name.ilike.${pattern},phone.ilike.${pattern}`);
    }

    return query.range(from, to);
  };

  let activePage = requestedPage;
  let { data, error, count } = await runPageQuery(activePage);

  if (error) {
    console.error('Error fetching paginated patients:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  const totalCount = count ?? (data ? data.length : 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  if (activePage > totalPages && totalCount > 0) {
    activePage = totalPages;
    const fallbackRes = await runPageQuery(activePage);
    if (fallbackRes.error) {
      console.error('Error fetching clamped patients page:', fallbackRes.error);
      throw fallbackRes.error;
    }
    data = fallbackRes.data;
  }

  return {
    patients: data ? data.map(mapPatientRowToPatient) : [],
    totalCount,
    page: activePage,
    pageSize: safePageSize,
  };
}

export async function getAllPatientsBatched(
  searchTerm?: string,
  onProgress?: (loadedCount: number, totalCount: number | null) => void
): Promise<Patient[]> {
  if (!isSupabaseConfigured || !supabase) {
    const allFiltered = filterAndSortMockPatients(searchTerm);
    onProgress?.(allFiltered.length, allFiltered.length);
    return allFiltered;
  }

  const cleanSearch = sanitizeSearchTermForPostgrest(searchTerm || '');
  const collected: Patient[] = [];
  let knownTotalCount: number | null = null;
  let batchIndex = 0;

  while (true) {
    const from = batchIndex * SUPABASE_BATCH_SIZE;
    const to = from + SUPABASE_BATCH_SIZE - 1;

    let query = supabase
      .from('patients')
      .select('*', batchIndex === 0 ? { count: 'exact' } : undefined)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (cleanSearch) {
      const pattern = `%${cleanSearch}%`;
      query = query.or(`name.ilike.${pattern},phone.ilike.${pattern}`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error('Error fetching patients batch:', {
        batchIndex,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    if (batchIndex === 0 && typeof count === 'number') {
      knownTotalCount = count;
    }

    const batchRows = data ? data.map(mapPatientRowToPatient) : [];
    collected.push(...batchRows);
    onProgress?.(collected.length, knownTotalCount);

    if (
      batchRows.length < SUPABASE_BATCH_SIZE ||
      (knownTotalCount !== null && collected.length >= knownTotalCount)
    ) {
      break;
    }

    batchIndex += 1;
  }

  return collected;
}

export async function getPatients(): Promise<Patient[]> {
  return getAllPatientsBatched();
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
    image_urls: patientData.imageUrls ?? [],
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

    if (patientData.name !== undefined || patientData.phone !== undefined) {
      const appointments = loadMockAppointments();
      saveMockAppointments(
        appointments.map(a =>
          a.patientId === id
            ? {
                ...a,
                patientName: patientData.name ?? a.patientName,
                patientPhone: patientData.phone ?? a.patientPhone,
              }
            : a
        )
      );
    }
    return updated;
  }

   const patientToUpdate: Database['public']['Tables']['patients']['Update'] = {};
   if (patientData.name !== undefined) patientToUpdate.name = patientData.name;
   if (patientData.age !== undefined) patientToUpdate.age = patientData.age;
   if (patientData.phone !== undefined) patientToUpdate.phone = patientData.phone;
   if (patientData.imageUrls !== undefined) patientToUpdate.image_urls = patientData.imageUrls ?? [];

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

export interface DeletePatientResult {
  storageDeletedAll: boolean;
  failedStorageCount: number;
}

export async function deletePatient(id: string, imageUrls?: string[]): Promise<DeletePatientResult> {
  if (!isSupabaseConfigured || !supabase) {
    saveMockAppointments(loadMockAppointments().filter(a => a.patientId !== id));
    saveMockPatients(loadMockPatients().filter(p => p.id !== id));
    return { storageDeletedAll: true, failedStorageCount: 0 };
  }

  // 1. Collect image paths/URLs (from argument or DB) and delete them from Storage first
  let targetImageUrls = imageUrls;
  if (targetImageUrls === undefined) {
    try {
      const { data: patientRow, error: fetchImagesError } = await supabase
        .from('patients')
        .select('image_urls')
        .eq('id', id)
        .maybeSingle();

      if (fetchImagesError) {
        console.warn(`Warning fetching image_urls before deleting patient (${id}):`, fetchImagesError);
      } else if (patientRow?.image_urls) {
        targetImageUrls = patientRow.image_urls;
      }
    } catch (fetchErr) {
      console.warn(`Unexpected error fetching image_urls for patient (${id}):`, fetchErr);
    }
  }

  const uniqueImageUrls = Array.from(new Set((targetImageUrls || []).filter(Boolean)));
  let failedStorageCount = 0;

  if (uniqueImageUrls.length > 0) {
    try {
      const storageResults = await Promise.allSettled(
        uniqueImageUrls.map((urlOrPath) => deletePatientImageFromStorage(urlOrPath))
      );

      for (const result of storageResults) {
        if (result.status === 'rejected' || result.value === false) {
          failedStorageCount += 1;
        }
      }

      if (failedStorageCount > 0) {
        console.warn(
          `Partial storage cleanup warning for patient (${id}): ${failedStorageCount}/${uniqueImageUrls.length} file(s) failed to delete.`
        );
      }
    } catch (storageCleanupErr) {
      failedStorageCount = uniqueImageUrls.length;
      console.warn(`Unexpected storage cleanup error for patient (${id}):`, storageCleanupErr);
    }
  }

  // 2. Delete related appointments
  const { error: appointmentError } = await supabase
    .from('appointments')
    .delete()
    .eq('patient_id', id);

  if (appointmentError) {
    console.error(`Error deleting related appointments for patient ID ${id}:`, { message: appointmentError.message, details: appointmentError.details, hint: appointmentError.hint, code: appointmentError.code });
    throw appointmentError;
  }

  // 3. Delete the patient record
  const { error: patientError } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);

  if (patientError) {
    console.error(`Error deleting patient (${id}):`, { message: patientError.message, details: patientError.details, hint: patientError.hint, code: patientError.code });
    throw patientError;
  }

  return {
    storageDeletedAll: failedStorageCount === 0,
    failedStorageCount,
  };
}

export interface DashboardStatsResult {
  totalPatients: number;
  monthlyAppointmentsCount: number;
  upcomingTodayCount: number;
  totalTodayCount: number;
  todayAppointments: Appointment[];
}

export async function getDashboardStats(referenceDate = new Date()): Promise<DashboardStatsResult> {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const month = String(monthIndex + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  const todayString = `${year}-${month}-${day}`;
  const currentTimeString = `${String(referenceDate.getHours()).padStart(2, '0')}:${String(referenceDate.getMinutes()).padStart(2, '0')}`;

  const monthStart = `${year}-${month}-01`;
  const nextMonthDate = new Date(year, monthIndex + 1, 1);
  const nextMonthStart = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthPrefix = `${year}-${month}`;

  if (!isSupabaseConfigured || !supabase) {
    const patients = loadMockPatients();
    const allAppointments = loadMockAppointments();
    const monthlyAppointments = allAppointments.filter((appt) =>
      appt.date.startsWith(currentMonthPrefix)
    );
    const todayAppointments = monthlyAppointments
      .filter((appt) => appt.date === todayString)
      .sort((a, b) => a.time.localeCompare(b.time));
    const upcomingTodayCount = todayAppointments.filter(
      (appt) => appt.time.slice(0, 5) >= currentTimeString && isActiveUpcomingStatus(appt.status)
    ).length;

    return {
      totalPatients: patients.length,
      monthlyAppointmentsCount: monthlyAppointments.length,
      upcomingTodayCount,
      totalTodayCount: todayAppointments.length,
      todayAppointments,
    };
  }

  const [patientsCountRes, monthlyAppointmentsRes] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase
      .from('appointments')
      .select('*, patients(name, phone)')
      .gte('date', monthStart)
      .lt('date', nextMonthStart)
      .order('time', { ascending: true }),
  ]);

  if (patientsCountRes.error) {
    console.error('Error counting patients:', patientsCountRes.error);
    throw patientsCountRes.error;
  }
  if (monthlyAppointmentsRes.error) {
    console.error('Error fetching monthly appointments:', monthlyAppointmentsRes.error);
    throw monthlyAppointmentsRes.error;
  }

  const monthlyAppointments = (monthlyAppointmentsRes.data || []).map(mapAppointmentRowToAppointment);
  const todayAppointments = monthlyAppointments.filter((appt) => appt.date === todayString);
  const upcomingTodayCount = todayAppointments.filter(
    (appt) => appt.time.slice(0, 5) >= currentTimeString && isActiveUpcomingStatus(appt.status)
  ).length;

  return {
    totalPatients: patientsCountRes.count ?? 0,
    monthlyAppointmentsCount: monthlyAppointments.length,
    upcomingTodayCount,
    totalTodayCount: todayAppointments.length,
    todayAppointments,
  };
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
    .select('*, patients(name, phone)') 
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
    .select('*, patients(name, phone)')
    .eq('date', date)
    .order('time', { ascending: true });

  if (error) {
    console.error(`Error fetching appointments by date (${date}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? data.map(mapAppointmentRowToAppointment) : [];
}

export async function getAppointmentsByPatientId(patientId: string): Promise<Appointment[]> {
  if (!isSupabaseConfigured || !supabase) {
    return loadMockAppointments()
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(name, phone)')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
    .order('time', { ascending: false });

  if (error) {
    console.error(`Error fetching appointments for patient (${patientId}):`, { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data ? data.map(mapAppointmentRowToAppointment) : [];
}

export async function addAppointment(
  appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'patientName' | 'patientPhone' | 'status'> & {
    status?: AppointmentStatus;
  }
): Promise<Appointment> {
  const normalizedStatus = normalizeAppointmentStatus(appointmentData.status);

  if (!isSupabaseConfigured || !supabase) {
    const patients = loadMockPatients();
    const patient = patients.find(p => p.id === appointmentData.patientId);
    const newAppointment: Appointment = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `appt-${Date.now()}`,
      patientId: appointmentData.patientId,
      patientName: patient?.name || 'اسم غير معروف',
      patientPhone: patient?.phone || undefined,
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type || 'غير محدد',
      status: normalizedStatus,
      notes: appointmentData.notes || undefined,
      createdAt: new Date().toISOString(),
    };
    saveMockAppointments([newAppointment, ...loadMockAppointments()]);
    return newAppointment;
  }

  const appointmentToInsert: Database['public']['Tables']['appointments']['Insert'] = {
    patient_id: appointmentData.patientId,
    date: appointmentData.date,
    time: appointmentData.time,
    type: appointmentData.type,
    status: normalizedStatus,
    notes: appointmentData.notes,
  };
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointmentToInsert)
    .select('*, patients(name, phone)') 
    .single();

  if (error) {
    console.error('Error adding appointment:', { message: error.message, details: error.details, hint: error.hint, code: error.code }, 'Input data:', appointmentToInsert);
    throw error;
  }
  return mapAppointmentRowToAppointment(data);
}

export async function updateAppointment(
  id: string,
  appointmentData: Partial<Omit<Appointment, 'id' | 'createdAt' | 'patientName' | 'patientPhone'>>
): Promise<Appointment | null> {
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
      status:
        appointmentData.status !== undefined
          ? normalizeAppointmentStatus(appointmentData.status)
          : normalizeAppointmentStatus(appointments[idx].status),
      patientName: patient?.name || appointments[idx].patientName,
      patientPhone: patient?.phone || appointments[idx].patientPhone,
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
  if (appointmentData.status !== undefined) {
    appointmentToUpdate.status = normalizeAppointmentStatus(appointmentData.status);
  }
  if (appointmentData.notes !== undefined) appointmentToUpdate.notes = appointmentData.notes;

  const { data, error } = await supabase
    .from('appointments')
    .update(appointmentToUpdate)
    .eq('id', id)
    .select('*, patients(name, phone)') 
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

const PATIENT_IMAGES_BUCKET = 'patient-images';

// Supabase storage for image upload (Private Bucket — stores stable relative path like "public/...")
export async function uploadPatientImage(file: File, identifier?: string): Promise<string> {
  const processedFile = await compressImageToWebP(file, 1200, 0.8);

  if (!isSupabaseConfigured || !supabase) {
    if (typeof FileReader !== 'undefined') {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(processedFile);
      });
    }
    return `https://placehold.co/400x400?text=${encodeURIComponent(processedFile.name)}`;
  }

  const fileExt =
    processedFile.type === 'image/webp'
      ? 'webp'
      : processedFile.name.split('.').pop() || 'webp';
  const uniqueFilePrefix = identifier || crypto.randomUUID();
  const uniqueSuffix = Math.random().toString(36).slice(2, 7);
  const fileName = `${uniqueFilePrefix}-${Date.now()}-${uniqueSuffix}.${fileExt}`;
  const filePath = `public/${fileName}`;

  const { data, error: uploadError } = await supabase.storage
    .from(PATIENT_IMAGES_BUCKET)
    .upload(filePath, processedFile, {
      contentType: processedFile.type || 'image/webp',
    });

  if (uploadError) {
    console.error(
      'Error uploading image to Supabase Storage:',
      { message: uploadError.message, name: (uploadError as any).name, status: (uploadError as any).status },
      'File path:',
      filePath
    );
    throw uploadError;
  }

  // Store the canonical storage path (e.g. "public/...") in DB instead of a public or expiring URL
  return data.path || filePath;
}

interface CachedSignedUrl {
  signedUrl: string;
  expiresAt: number;
}

const SIGNED_URL_EXPIRY_BUFFER_MS = 60_000;
const signedUrlCache = new Map<string, CachedSignedUrl>();

function getValidCachedSignedUrl(storagePath: string): string | null {
  const cached = signedUrlCache.get(storagePath);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt - SIGNED_URL_EXPIRY_BUFFER_MS) {
    signedUrlCache.delete(storagePath);
    return null;
  }
  return cached.signedUrl;
}

export function getCachedPatientImageUrls(
  urlsOrPaths: string[] | null | undefined
): { cachedMap: Record<string, string>; hasMissing: boolean } {
  const cachedMap: Record<string, string> = {};
  if (!urlsOrPaths || urlsOrPaths.length === 0) {
    return { cachedMap, hasMissing: false };
  }

  let hasMissing = false;
  const uniqueItems = Array.from(new Set(urlsOrPaths.filter(Boolean)));

  for (const item of uniqueItems) {
    if (item.startsWith('data:') || item.startsWith('blob:')) {
      cachedMap[item] = item;
      continue;
    }

    const storagePath = getStoragePathFromUrl(item, PATIENT_IMAGES_BUCKET);
    if (!storagePath || !isSupabaseConfigured || !supabase) {
      if (isDisplayableImageSrc(item)) {
        cachedMap[item] = item;
      }
      continue;
    }

    const cachedSignedUrl = getValidCachedSignedUrl(storagePath);
    if (cachedSignedUrl) {
      cachedMap[item] = cachedSignedUrl;
    } else {
      hasMissing = true;
    }
  }

  return { cachedMap, hasMissing };
}

/**
 * Resolves an array of stored patient image references (either "public/..." paths
 * or legacy full Supabase URLs) into temporary Signed URLs for display/preview,
 * reusing cached Signed URLs until close to expiration.
 * Never mutates the underlying database values.
 */
export async function resolvePatientImageUrls(
  urlsOrPaths: string[] | null | undefined,
  expiresInSeconds = 3600
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  if (!urlsOrPaths || urlsOrPaths.length === 0) return resolved;

  const uniqueItems = Array.from(new Set(urlsOrPaths.filter(Boolean)));
  const pathToOriginalItems = new Map<string, string[]>();

  for (const item of uniqueItems) {
    if (item.startsWith('data:') || item.startsWith('blob:')) {
      resolved[item] = item;
      continue;
    }

    const storagePath = getStoragePathFromUrl(item, PATIENT_IMAGES_BUCKET);
    if (!storagePath) {
      if (isDisplayableImageSrc(item)) {
        resolved[item] = item;
      }
      continue;
    }

    if (!isSupabaseConfigured || !supabase) {
      if (isDisplayableImageSrc(item)) {
        resolved[item] = item;
      }
      continue;
    }

    const cachedSignedUrl = getValidCachedSignedUrl(storagePath);
    if (cachedSignedUrl) {
      resolved[item] = cachedSignedUrl;
      continue;
    }

    const existing = pathToOriginalItems.get(storagePath) || [];
    existing.push(item);
    pathToOriginalItems.set(storagePath, existing);
  }

  const pathsToSign = Array.from(pathToOriginalItems.keys());
  if (pathsToSign.length === 0 || !supabase) {
    return resolved;
  }

  const { data, error } = await supabase.storage
    .from(PATIENT_IMAGES_BUCKET)
    .createSignedUrls(pathsToSign, expiresInSeconds);

  if (error) {
    console.error('Error creating signed URLs for patient images:', error);
    return resolved;
  }

  const expiresAt = Date.now() + expiresInSeconds * 1000;
  if (data) {
    for (const entry of data) {
      if (entry.path && entry.signedUrl && !entry.error) {
        signedUrlCache.set(entry.path, {
          signedUrl: entry.signedUrl,
          expiresAt,
        });
        const originals = pathToOriginalItems.get(entry.path) || [];
        for (const orig of originals) {
          resolved[orig] = entry.signedUrl;
        }
      } else if (entry.error) {
        console.warn('Failed to sign patient image path:', entry.path, entry.error);
      }
    }
  }

  return resolved;
}

/**
 * Deletes an image object from the private Supabase Storage bucket using either
 * its stored relative path ("public/...") or a legacy full URL.
 */
export async function deletePatientImageFromStorage(urlOrPath: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return true;

  const storagePath = getStoragePathFromUrl(urlOrPath, PATIENT_IMAGES_BUCKET);
  if (!storagePath) return true;

  signedUrlCache.delete(storagePath);

  const { error } = await supabase.storage
    .from(PATIENT_IMAGES_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error('Error deleting image from Supabase Storage:', error, storagePath);
    return false;
  }

  return true;
}
