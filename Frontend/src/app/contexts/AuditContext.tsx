import { createContext, useContext, useState, ReactNode } from 'react';

export interface AuditRecord {
  id: number;
  timestamp: Date;
  user: string;
  userRole: 'admin' | 'employee';
  type: 'inventory' | 'asset';
  action: 'create' | 'update' | 'delete' | 'stock_receipt' | 'audit';
  itemCode: string;
  itemName: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  price?: number;
  quantity?: number;
  stockBefore?: number;
  stockAfter?: number;
  invoiceNumber?: string;
  description?: string;
}

interface AuditContextType {
  auditRecords: AuditRecord[];
  addAuditRecord: (record: Omit<AuditRecord, 'id' | 'timestamp'>) => void;
  getRecordsByType: (type: 'inventory' | 'asset') => AuditRecord[];
  getRecordsByItem: (itemCode: string) => AuditRecord[];
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);

  const addAuditRecord = (record: Omit<AuditRecord, 'id' | 'timestamp'>) => {
    // Verificar se há mudanças reais nos valores
    const hasRealChanges = record.changes.some(change => {
      // Comparar valores, considerando tipos e valores
      if (change.oldValue === change.newValue) {
        return false;
      }
      // Se ambos forem números, comparar numericamente
      if (typeof change.oldValue === 'number' && typeof change.newValue === 'number') {
        return change.oldValue !== change.newValue;
      }
      // Comparação padrão
      return String(change.oldValue) !== String(change.newValue);
    });

    // Só adiciona o registro se houver mudanças reais
    if (!hasRealChanges && record.action !== 'create' && record.action !== 'delete' && record.action !== 'stock_receipt') {
      return;
    }

    const newRecord: AuditRecord = {
      ...record,
      id: auditRecords.length > 0 ? Math.max(...auditRecords.map(r => r.id)) + 1 : 1,
      timestamp: new Date(),
    };
    setAuditRecords([newRecord, ...auditRecords]);
  };

  const getRecordsByType = (type: 'inventory' | 'asset') => {
    return auditRecords.filter(record => record.type === type);
  };

  const getRecordsByItem = (itemCode: string) => {
    return auditRecords.filter(record => record.itemCode === itemCode);
  };

  return (
    <AuditContext.Provider
      value={{
        auditRecords,
        addAuditRecord,
        getRecordsByType,
        getRecordsByItem,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
}