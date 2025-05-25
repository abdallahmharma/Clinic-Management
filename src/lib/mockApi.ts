
// هذا الملف لم يعد مستخدماً. تم استبداله بـ src/lib/api.ts الذي يستخدم Supabase.
// يمكنك حذف هذا الملف إذا أردت.
// أبقيته هنا مؤقتًا كمرجع إذا احتجت إلى مقارنة الدوال.

import type { Patient, Appointment, PatientSelectItem } from './types';
import { format } from 'date-fns';

// Mock Database
let mockPatients: Patient[] = [
  { id: '1', name: 'أحمد محمد', age: 34, phone: '0501234567', email: 'ahmad.m@example.com', imageUrl: 'https://placehold.co/100x100.png', createdAt: new Date().toISOString() },
  { id: '2', name: 'فاطمة علي', age: 28, phone: '0557654321', email: 'fatima.a@example.com', imageUrl: 'https://placehold.co/100x100.png', createdAt: new Date().toISOString() },
  { id: '3', name: 'خالد عبدالله', age: 45, phone: '0533216789', email: 'khalid.b@example.com', createdAt: new Date().toISOString() },
];

let mockAppointments: Appointment[] = [
  { id: 'a1', patientId: '1', patientName: 'أحمد محمد', date: format(new Date(), 'yyyy-MM-dd'), time: '10:00', notes: 'فحص دوري', createdAt: new Date().toISOString() },
  { id: 'a2', patientId: '2', patientName: 'فاطمة علي', date: format(new Date(), 'yyyy-MM-dd'), time: '11:30', notes: 'متابعة علاج', createdAt: new Date().toISOString() },
  { id: 'a3', patientId: '1', patientName: 'أحمد محمد', date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), time: '14:00', createdAt: new Date().toISOString() },
];

let nextPatientId = mockPatients.length + 1;
let nextAppointmentId = mockAppointments.length + 1;

// Patient Functions
export async function getPatients(): Promise<Patient[]> {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return [...mockPatients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockPatients.find(p => p.id === id);
}

export async function addPatient(patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newPatient: Patient = { 
    ...patientData, 
    id: String(nextPatientId++), 
    createdAt: new Date().toISOString() 
  };
  mockPatients.push(newPatient);
  return newPatient;
}

export async function updatePatient(id: string, patientData: Partial<Omit<Patient, 'id' | 'createdAt'>>): Promise<Patient | null> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockPatients.findIndex(p => p.id === id);
  if (index !== -1) {
    mockPatients[index] = { ...mockPatients[index], ...patientData };
    return mockPatients[index];
  }
  return null;
}

export async function deletePatient(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const initialLength = mockPatients.length;
  mockPatients = mockPatients.filter(p => p.id !== id);
  // Also delete related appointments
  mockAppointments = mockAppointments.filter(a => a.patientId !== id);
  return mockPatients.length < initialLength;
}

export async function getPatientSelectItems(): Promise<PatientSelectItem[]> {
    const patients = await getPatients();
    return patients.map(p => ({ value: p.id, label: p.name }));
}

// Appointment Functions
export async function getAppointments(): Promise<Appointment[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [...mockAppointments].sort((a,b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime());
}

export async function getAppointmentsByDate(date: string): Promise<Appointment[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockAppointments.filter(a => a.date === date).sort((a,b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
}

export async function addAppointment(appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'patientName'>): Promise<Appointment> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const patient = await getPatientById(appointmentData.patientId);
  if (!patient) throw new Error('Patient not found');
  
  const newAppointment: Appointment = { 
    ...appointmentData, 
    patientName: patient.name,
    id: 'a' + String(nextAppointmentId++), 
    createdAt: new Date().toISOString() 
  };
  mockAppointments.push(newAppointment);
  return newAppointment;
}

export async function updateAppointment(id: string, appointmentData: Partial<Omit<Appointment, 'id' | 'createdAt' | 'patientName'>>): Promise<Appointment | null> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockAppointments.findIndex(a => a.id === id);
  if (index !== -1) {
    let updatedAppointment = { ...mockAppointments[index], ...appointmentData };
    if (appointmentData.patientId) {
        const patient = await getPatientById(appointmentData.patientId);
        if (patient) updatedAppointment.patientName = patient.name;
    }
    mockAppointments[index] = updatedAppointment;
    return mockAppointments[index];
  }
  return null;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const initialLength = mockAppointments.length;
  mockAppointments = mockAppointments.filter(a => a.id !== id);
  return mockAppointments.length < initialLength;
}

// Simulate Supabase storage for image upload
export async function uploadPatientImage(file: File): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate upload time
    // In a real scenario, this would return a URL from Supabase Storage
    // For mock, we'll just return a placeholder URL.
    // This function is not directly used in the UI forms to simplify, forms will use an input for image URL.
    return `https://placehold.co/100x100.png?text=${encodeURIComponent(file.name)}`;
}
