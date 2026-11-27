"use client";

import * as React from 'react';
import { format } from 'date-fns';
import {
  CheckSquare,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Square,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/lib/types';
import { getAllPatientsBatched } from '@/lib/api';
import {
  PATIENT_EXPORT_COLUMNS,
  type PatientExportColumnKey,
  getPatientExportCellValue,
} from './PatientsPrintView';

export type PatientExportScope = 'all' | 'page';

interface PatientsPrintExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalFilteredCount: number;
  currentPagePatients: Patient[];
  currentPage: number;
  totalPages: number;
  exportScope: PatientExportScope;
  onExportScopeChange: (scope: PatientExportScope) => void;
  selectedColumns: PatientExportColumnKey[];
  onSelectedColumnsChange: (columns: PatientExportColumnKey[]) => void;
  onPrintReady: (patientsToPrint: Patient[], scopeLabel?: string) => void;
  searchTerm?: string;
}

function escapeCsvCell(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PatientsPrintExportDialog({
  open,
  onOpenChange,
  totalFilteredCount,
  currentPagePatients,
  currentPage,
  totalPages,
  exportScope,
  onExportScopeChange,
  selectedColumns,
  onSelectedColumnsChange,
  onPrintReady,
  searchTerm,
}: PatientsPrintExportDialogProps) {
  const { toast } = useToast();
  const [exportingType, setExportingType] = React.useState<
    'print' | 'csv' | 'excel' | 'pdf' | null
  >(null);
  const [batchProgress, setBatchProgress] = React.useState<{
    loaded: number;
    total: number | null;
  } | null>(null);

  const effectiveTargetCount =
    exportScope === 'page' && totalPages > 1
      ? currentPagePatients.length
      : totalFilteredCount;

  const activeColumnDefs = React.useMemo(
    () => PATIENT_EXPORT_COLUMNS.filter((col) => selectedColumns.includes(col.key)),
    [selectedColumns]
  );

  const isDisabled =
    activeColumnDefs.length === 0 || effectiveTargetCount === 0 || exportingType !== null;

  const resolveTargetPatients = React.useCallback(async (): Promise<Patient[]> => {
    if (exportScope === 'page' || totalPages <= 1) {
      return currentPagePatients;
    }

    setBatchProgress({ loaded: 0, total: totalFilteredCount });
    try {
      return await getAllPatientsBatched(searchTerm, (loaded, total) => {
        setBatchProgress({ loaded, total: total ?? totalFilteredCount });
      });
    } finally {
      setBatchProgress(null);
    }
  }, [exportScope, totalPages, currentPagePatients, totalFilteredCount, searchTerm]);

  const toggleColumn = React.useCallback(
    (key: PatientExportColumnKey, checked: boolean) => {
      if (checked) {
        if (!selectedColumns.includes(key)) {
          const ordered = PATIENT_EXPORT_COLUMNS.map((c) => c.key).filter(
            (k) => k === key || selectedColumns.includes(k)
          );
          onSelectedColumnsChange(ordered);
        }
      } else {
        onSelectedColumnsChange(selectedColumns.filter((k) => k !== key));
      }
    },
    [selectedColumns, onSelectedColumnsChange]
  );

  const handleSelectAll = React.useCallback(() => {
    onSelectedColumnsChange(PATIENT_EXPORT_COLUMNS.map((c) => c.key));
  }, [onSelectedColumnsChange]);

  const handleClearAll = React.useCallback(() => {
    onSelectedColumnsChange([]);
  }, [onSelectedColumnsChange]);

  const handleDirectPrint = React.useCallback(async () => {
    if (isDisabled) return;
    setExportingType('print');
    try {
      const targetPatients = await resolveTargetPatients();
      const scopeLabel =
        exportScope === 'page' && totalPages > 1
          ? `الصفحة ${currentPage} من ${totalPages}`
          : undefined;

      onPrintReady(targetPatients, scopeLabel);
      onOpenChange(false);
      setTimeout(() => {
        window.print();
      }, 220);
    } catch (error) {
      console.error('Prepare print error:', error);
      toast({
        title: 'خطأ',
        description: 'تعذر تجهيز بيانات الطباعة.',
        variant: 'destructive',
      });
    } finally {
      setExportingType(null);
    }
  }, [
    isDisabled,
    resolveTargetPatients,
    exportScope,
    totalPages,
    currentPage,
    onPrintReady,
    onOpenChange,
    toast,
  ]);

  const handleExportCsv = React.useCallback(async () => {
    if (isDisabled) return;
    setExportingType('csv');
    try {
      const targetPatients = await resolveTargetPatients();
      const headers = activeColumnDefs.map((col) => escapeCsvCell(col.label)).join(',');
      const rows = targetPatients.map((patient, idx) =>
        activeColumnDefs
          .map((col) =>
            escapeCsvCell(
              getPatientExportCellValue(patient, idx, col.key, { includeAgeUnit: false })
            )
          )
          .join(',')
      );

      // UTF-8 BOM ensures Excel and other spreadsheet apps display Arabic text properly
      const csvContent = `\uFEFF${[headers, ...rows].join('\r\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const dateStamp = format(new Date(), 'yyyy-MM-dd');
      downloadBlob(blob, `patients-list-${dateStamp}.csv`);
      toast({
        title: 'تم التصدير',
        description: `تم تصدير ${targetPatients.length} سجل إلى ملف CSV بنجاح.`,
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تصدير ملف CSV.',
        variant: 'destructive',
      });
    } finally {
      setExportingType(null);
    }
  }, [isDisabled, resolveTargetPatients, activeColumnDefs, toast]);

  const handleExportExcel = React.useCallback(async () => {
    if (isDisabled) return;
    setExportingType('excel');
    try {
      const [targetPatients, XLSX] = await Promise.all([
        resolveTargetPatients(),
        import('xlsx'),
      ]);
      const headers = activeColumnDefs.map((col) => col.label);
      const dataRows = targetPatients.map((patient, idx) =>
        activeColumnDefs.map((col) =>
          getPatientExportCellValue(patient, idx, col.key, { includeAgeUnit: false })
        )
      );

      const aoa = [headers, ...dataRows];
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet['!views'] = [{ rightToLeft: true }];
      worksheet['!cols'] = activeColumnDefs.map((col, colIdx) => {
        const maxLen = Math.max(
          col.label.length,
          ...dataRows.slice(0, 200).map((row) => String(row[colIdx] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 6, 12), 40) };
      });

      const workbook = XLSX.utils.book_new();
      workbook.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(workbook, worksheet, 'المرضى');

      const dateStamp = format(new Date(), 'yyyy-MM-dd');
      XLSX.writeFile(workbook, `patients-list-${dateStamp}.xlsx`);
      toast({
        title: 'تم التصدير',
        description: `تم تصدير ${targetPatients.length} سجل إلى ملف Excel بنجاح.`,
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تصدير ملف Excel.',
        variant: 'destructive',
      });
    } finally {
      setExportingType(null);
    }
  }, [isDisabled, resolveTargetPatients, activeColumnDefs, toast]);

  const handleExportPdf = React.useCallback(async () => {
    if (isDisabled) return;
    setExportingType('pdf');

    let offscreenHost: HTMLDivElement | null = null;
    try {
      const [targetPatients, { default: jsPDF }, { default: html2canvas }] = await Promise.all([
        resolveTargetPatients(),
        import('jspdf'),
        import('html2canvas'),
      ]);

      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }

      offscreenHost = document.createElement('div');
      offscreenHost.setAttribute('dir', 'rtl');
      offscreenHost.setAttribute('lang', 'ar');
      offscreenHost.style.position = 'fixed';
      offscreenHost.style.left = '-99999px';
      offscreenHost.style.top = '0';
      offscreenHost.style.width = '794px';
      offscreenHost.style.background = '#ffffff';
      offscreenHost.style.zIndex = '-1';
      document.body.appendChild(offscreenHost);

      const ROWS_PER_PAGE = 28;
      const pdfTotalPages = Math.max(1, Math.ceil(targetPatients.length / ROWS_PER_PAGE));
      const printedAt = format(new Date(), 'dd/MM/yyyy - HH:mm');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();

      for (let pageIdx = 0; pageIdx < pdfTotalPages; pageIdx++) {
        const chunkStart = pageIdx * ROWS_PER_PAGE;
        const chunk = targetPatients.slice(chunkStart, chunkStart + ROWS_PER_PAGE);

        const pageContainer = document.createElement('div');
        pageContainer.setAttribute('dir', 'rtl');
        pageContainer.style.width = '794px';
        pageContainer.style.padding = '28px 34px';
        pageContainer.style.backgroundColor = '#ffffff';
        pageContainer.style.color = '#0f172a';
        pageContainer.style.fontFamily = "'Tajawal', Arial, Helvetica, sans-serif";
        pageContainer.style.boxSizing = 'border-box';

        if (pageIdx === 0) {
          const headerDiv = document.createElement('div');
          headerDiv.style.display = 'flex';
          headerDiv.style.justifyContent = 'space-between';
          headerDiv.style.alignItems = 'flex-start';
          headerDiv.style.borderBottom = '2px solid #1e293b';
          headerDiv.style.paddingBottom = '10px';
          headerDiv.style.marginBottom = '14px';

          const titleWrap = document.createElement('div');
          const titleEl = document.createElement('h1');
          titleEl.textContent = 'قائمة المرضى المسجلين';
          titleEl.style.fontSize = '20px';
          titleEl.style.fontWeight = '700';
          titleEl.style.margin = '0 0 4px 0';
          titleEl.style.color = '#0f172a';

          const metaEl = document.createElement('p');
          metaEl.style.fontSize = '11px';
          metaEl.style.color = '#475569';
          metaEl.style.margin = '0';
          const metaParts = [`تاريخ التصدير: ${printedAt}`];
          if (exportScope === 'page' && totalPages > 1) {
            metaParts.push(`النطاق: الصفحة ${currentPage} من ${totalPages}`);
          }
          if (searchTerm?.trim()) {
            metaParts.push(`البحث: ${searchTerm.trim()}`);
          }
          metaEl.textContent = metaParts.join(' · ');

          titleWrap.appendChild(titleEl);
          titleWrap.appendChild(metaEl);

          const countBadge = document.createElement('div');
          countBadge.textContent = `إجمالي المرضى: ${targetPatients.length}`;
          countBadge.style.fontSize = '12px';
          countBadge.style.fontWeight = '700';
          countBadge.style.border = '1px solid #cbd5e1';
          countBadge.style.borderRadius = '6px';
          countBadge.style.padding = '5px 10px';
          countBadge.style.backgroundColor = '#f8fafc';

          headerDiv.appendChild(titleWrap);
          headerDiv.appendChild(countBadge);
          pageContainer.appendChild(headerDiv);
        }

        const tableEl = document.createElement('table');
        tableEl.setAttribute('dir', 'rtl');
        tableEl.style.width = '100%';
        tableEl.style.borderCollapse = 'collapse';
        tableEl.style.fontSize = '12px';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.style.backgroundColor = '#f1f5f9';

        for (const col of activeColumnDefs) {
          const th = document.createElement('th');
          th.textContent = col.label;
          th.style.border = '1px solid #cbd5e1';
          th.style.padding = '7px 8px';
          th.style.fontWeight = '700';
          th.style.color = '#0f172a';
          th.style.textAlign = col.key === 'name' ? 'right' : 'center';
          headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        tableEl.appendChild(thead);

        const tbody = document.createElement('tbody');
        chunk.forEach((patient, localIdx) => {
          const globalIdx = chunkStart + localIdx;
          const tr = document.createElement('tr');
          tr.style.backgroundColor = globalIdx % 2 === 1 ? '#f8fafc' : '#ffffff';

          for (const col of activeColumnDefs) {
            const td = document.createElement('td');
            const val = getPatientExportCellValue(patient, globalIdx, col.key, {
              includeAgeUnit: true,
            });
            td.style.border = '1px solid #cbd5e1';
            td.style.padding = '6px 8px';
            td.style.color = '#0f172a';
            td.style.textAlign = col.key === 'name' ? 'right' : 'center';
            if (col.key === 'name') {
              td.style.fontWeight = '600';
            }

            if (col.key === 'phone') {
              const span = document.createElement('span');
              span.setAttribute('dir', 'ltr');
              span.style.display = 'inline-block';
              span.textContent = val;
              td.appendChild(span);
            } else {
              td.textContent = val;
            }
            tr.appendChild(td);
          }

          tbody.appendChild(tr);
        });
        tableEl.appendChild(tbody);
        pageContainer.appendChild(tableEl);

        const footerEl = document.createElement('div');
        footerEl.textContent = `صفحة ${pageIdx + 1} من ${pdfTotalPages}`;
        footerEl.style.marginTop = '10px';
        footerEl.style.fontSize = '10px';
        footerEl.style.color = '#64748b';
        footerEl.style.textAlign = 'center';
        pageContainer.appendChild(footerEl);

        offscreenHost.replaceChildren(pageContainer);

        const canvas = await html2canvas(pageContainer, {
          scale: 1.75,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (pageIdx > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');
      }

      const dateStamp = format(new Date(), 'yyyy-MM-dd');
      pdf.save(`patients-list-${dateStamp}.pdf`);
      toast({
        title: 'تم التصدير',
        description: `تم حفظ ملف PDF (${targetPatients.length} سجل) بنجاح.`,
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إنشاء ملف PDF.',
        variant: 'destructive',
      });
    } finally {
      if (offscreenHost && offscreenHost.parentNode) {
        offscreenHost.parentNode.removeChild(offscreenHost);
      }
      setExportingType(null);
    }
  }, [
    isDisabled,
    resolveTargetPatients,
    exportScope,
    totalPages,
    currentPage,
    searchTerm,
    activeColumnDefs,
    toast,
  ]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !exportingType && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[520px]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Printer className="h-5 w-5 text-primary" />
            خيارات الطباعة والتصدير
          </DialogTitle>
          <DialogDescription>
            اختر الأعمدة المطلوب تضمينها ونطاق البيانات للطباعة أو التصدير.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {totalPages > 1 && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground">نطاق البيانات:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={exportScope === 'all' ? 'default' : 'outline'}
                  onClick={() => onExportScopeChange('all')}
                  disabled={exportingType !== null}
                  className="h-8 text-xs justify-between px-3"
                >
                  <span>جميع النتائج</span>
                  <Badge
                    variant={exportScope === 'all' ? 'secondary' : 'outline'}
                    className="px-1.5 py-0 text-[11px] tabular-nums"
                  >
                    {totalFilteredCount}
                  </Badge>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={exportScope === 'page' ? 'default' : 'outline'}
                  onClick={() => onExportScopeChange('page')}
                  disabled={exportingType !== null}
                  className="h-8 text-xs justify-between px-3"
                >
                  <span>الصفحة الحالية ({currentPage})</span>
                  <Badge
                    variant={exportScope === 'page' ? 'secondary' : 'outline'}
                    className="px-1.5 py-0 text-[11px] tabular-nums"
                  >
                    {currentPagePatients.length}
                  </Badge>
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>المرضى المشمولون:</span>
              <Badge variant="secondary" className="tabular-nums">
                {effectiveTargetCount}
              </Badge>
              <span>الأعمدة:</span>
              <Badge variant="outline" className="tabular-nums">
                {activeColumnDefs.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleSelectAll}
                disabled={exportingType !== null}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                تحديد الكل
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleClearAll}
                disabled={exportingType !== null}
              >
                <Square className="h-3.5 w-3.5" />
                إلغاء التحديد
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-lg border p-3.5 bg-muted/30">
            {PATIENT_EXPORT_COLUMNS.map((col) => {
              const checked = selectedColumns.includes(col.key);
              const checkboxId = `export-col-${col.key}`;
              return (
                <div
                  key={col.key}
                  className="flex items-center gap-2.5 rounded-md border bg-background px-3 py-2"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={(state) => toggleColumn(col.key, state === true)}
                    disabled={exportingType !== null}
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="cursor-pointer text-sm font-medium flex-1"
                  >
                    {col.label}
                  </Label>
                </div>
              );
            })}
          </div>

          {batchProgress && (
            <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-xs text-primary">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                جاري جلب السجلات على دفعات: <strong className="tabular-nums">{batchProgress.loaded}</strong>
                {batchProgress.total !== null ? (
                  <>
                    {' '}من أصل <strong className="tabular-nums">{batchProgress.total}</strong>
                  </>
                ) : null}
              </span>
            </div>
          )}

          {activeColumnDefs.length === 0 && (
            <p className="text-xs text-destructive">
              يرجى تحديد عمود واحد على الأقل لتتمكن من الطباعة أو التصدير.
            </p>
          )}
          {effectiveTargetCount === 0 && (
            <p className="text-xs text-destructive">
              لا توجد بيانات مرضى مطابقة حالياً للطباعة أو التصدير.
            </p>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:space-x-0">
          <Button
            type="button"
            onClick={handleDirectPrint}
            disabled={isDisabled}
            className="w-full gap-1.5"
          >
            {exportingType === 'print' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            طباعة
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={isDisabled}
            className="w-full gap-1.5"
          >
            {exportingType === 'csv' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportExcel}
            disabled={isDisabled}
            className="w-full gap-1.5 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400"
          >
            {exportingType === 'excel' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Excel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleExportPdf}
            disabled={isDisabled}
            className="w-full gap-1.5"
          >
            {exportingType === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
