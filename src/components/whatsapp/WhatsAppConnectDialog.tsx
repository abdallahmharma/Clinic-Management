"use client";

import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WhatsAppConnectPanel } from './WhatsAppConnectPanel';

interface WhatsAppConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppConnectDialog({
  open,
  onOpenChange,
}: WhatsAppConnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            ربط واتساب (WhatsApp Cloud API)
          </DialogTitle>
          <DialogDescription>
            إعداد الربط الرسمي لاستقبال رسائل وطلبات الحجز وإرسال التذكيرات التلقائية بأمان.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <WhatsAppConnectPanel
            showInboxAndTester={false}
            onNavigateAway={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
