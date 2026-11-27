"use client";

import * as React from 'react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import type { Patient } from '@/lib/types';

export type PatientExportColumnKey = 'index' | 'name' | 'phone' | 'age' | 'createdAt';

export interface PatientExportColumnDef {
  key: PatientExportColumnKey;
  label: string;
}

export const PATIENT_EXPORT_COLUMNS: PatientExportColumnDef[] = [
  { key: 'index', label: 'التسلسل' },
  { key: 'name', label: 'اسم المريض' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'age', label: 'العمر' },
  { key: 'createdAt', label: 'تاريخ التسجيل' },
];

export const DEFAULT_PATIENT_EXPORT_COLUMNS: PatientExportColumnKey[] = [
  'index',
  'name',
  'phone',
  'age',
  'createdAt',
];

export function formatPatientRegistrationDate(dateStr: string): string {
  try {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return 'غير محدد';
    return format(parsed, 'dd/MM/yyyy', { locale: arSA });
  } catch {
    return 'غير محدد';
  }
}

export function getPatientExportCellValue(
  patient: Patient,
  rowIndex: number,
  columnKey: PatientExportColumnKey,
  options?: { includeAgeUnit?: boolean }
): string {
  switch (columnKey) {
    case 'index':
      return String(rowIndex + 1);
    case 'name':
      return patient.name || '';
    case 'phone':
      return patient.phone || '';
    case 'age':
      return options?.includeAgeUnit ? `${patient.age} سنة` : String(patient.age);
    case 'createdAt':
      return formatPatientRegistrationDate(patient.createdAt);
  }
}

interface PatientsPrintViewProps {
  patients: Patient[];
  selectedColumns: PatientExportColumnKey[];
  searchTerm?: string;
  scopeLabel?: string;
}

export function PatientsPrintView({
  patients,
  selectedColumns,
  searchTerm,
  scopeLabel,
}: PatientsPrintViewProps) {
  const activeColumns = PATIENT_EXPORT_COLUMNS.filter((col) =>
    selectedColumns.includes(col.key)
  );
  const printedAt = format(new Date(), 'dd/MM/yyyy - HH:mm', { locale: arSA });

  if (activeColumns.length === 0) return null;

  return (
    <section
      dir="rtl"
      className="hidden print:block w-full bg-white text-black"
      aria-label="نسخة الطباعة لجدول المرضى"
    >
      <div className="border-b-2 border-slate-800 pb-3 mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">قائمة المرضى المسجلين</h1>
          <p className="text-xs text-slate-600 mt-1">
            تاريخ الطباعة: <span dir="ltr">{printedAt}</span>
            {scopeLabel ? ` · النطاق: ${scopeLabel}` : ''}
            {searchTerm?.trim() ? ` · تصفية البحث: "${searchTerm.trim()}"` : ''}
          </p>
        </div>
        <div className="text-sm font-semibold text-slate-800 border border-slate-300 rounded px-3 py-1">
          العدد الإجمالي: {patients.length}
        </div>
      </div>

      <table className="w-full border-collapse text-sm" dir="rtl">
        <thead>
          <tr className="bg-slate-100 border-b-2 border-slate-400">
            {activeColumns.map((col) => (
              <th
                key={col.key}
                className={`border border-slate-300 px-3 py-2 font-bold text-slate-900 ${
                  col.key === 'name' ? 'text-right' : 'text-center'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patients.map((patient, idx) => (
            <tr key={patient.id} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
              {activeColumns.map((col) => {
                const value = getPatientExportCellValue(patient, idx, col.key, {
                  includeAgeUnit: true,
                });
                return (
                  <td
                    key={col.key}
                    className={`border border-slate-300 px-3 py-2 text-slate-900 ${
                      col.key === 'name' ? 'text-right font-medium' : 'text-center'
                    }`}
                  >
                    {col.key === 'phone' ? (
                      <span dir="ltr" className="inline-block font-mono">
                        {value}
                      </span>
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
