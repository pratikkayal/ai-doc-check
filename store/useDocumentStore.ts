import { create } from 'zustand';
import { ChecklistItem, DocumentMetadata, VerificationReport } from '@/types';

interface DocumentStore {
  // Authentication
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;

  // Checklist
  checklist: ChecklistItem[];
  setChecklist: (items: ChecklistItem[]) => void;
  updateChecklistItem: (id: number, updates: Partial<ChecklistItem>) => void;

  // Document
  document: DocumentMetadata | null;
  setDocument: (doc: DocumentMetadata | null) => void;

  // Processing
  isProcessing: boolean;
  setProcessing: (value: boolean) => void;
  currentProcessingItem: number | null;
  setCurrentProcessingItem: (id: number | null) => void;

  // Report
  report: VerificationReport | null;
  setReport: (report: VerificationReport | null) => void;

  // Reset
  reset: () => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  // Authentication
  isAuthenticated: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),

  // Checklist
  checklist: [],
  setChecklist: (items) => set({ checklist: items }),
  updateChecklistItem: (id, updates) =>
    set((state) => ({
      checklist: state.checklist.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  // Document
  document: null,
  setDocument: (doc) => set({ document: doc }),

  // Processing
  isProcessing: false,
  setProcessing: (value) => set({ isProcessing: value }),
  currentProcessingItem: null,
  setCurrentProcessingItem: (id) => set({ currentProcessingItem: id }),

  // Report
  report: null,
  setReport: (report) => set({ report: report }),

  // Reset
  reset: () =>
    set({
      checklist: [],
      document: null,
      isProcessing: false,
      currentProcessingItem: null,
      report: null,
    }),
}));

