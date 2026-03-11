// 쌀집 대시보드 전역 상태 관리
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  SalesRecord,
  TaxInvoice,
  RiceProduct,
  InventoryItem,
  InventoryTransaction,
} from '@/types/rice';

interface RiceContextType {
  // 매출 데이터
  salesRecords: SalesRecord[];
  setSalesRecords: (records: SalesRecord[]) => void;
  addSalesRecords: (records: SalesRecord[]) => void;

  // 세금계산서 데이터
  taxInvoices: TaxInvoice[];
  setTaxInvoices: (invoices: TaxInvoice[]) => void;
  addTaxInvoices: (invoices: TaxInvoice[]) => void;

  // 쌀 품목/원가
  riceProducts: RiceProduct[];
  addRiceProduct: (product: Omit<RiceProduct, 'id' | 'costPerKg'>) => void;
  updateRiceProduct: (id: string, product: Partial<RiceProduct>) => void;
  deleteRiceProduct: (id: string) => void;

  // 재고
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  initInventory: (productId: string, quantity: number) => void;
  addInventoryTransaction: (tx: Omit<InventoryTransaction, 'id'>) => void;
  updateInventory: (productId: string, delta: number, type: 'in' | 'out' | 'adjust', memo?: string) => void;
}

const RiceContext = createContext<RiceContextType | null>(null);

export const useRice = () => {
  const ctx = useContext(RiceContext);
  if (!ctx) throw new Error('useRice must be used within RiceProvider');
  return ctx;
};

// localStorage 헬퍼
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

const save = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export const RiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [salesRecords, setSalesRecordsState] = useState<SalesRecord[]>(() => load('rice_sales', []));
  const [taxInvoices, setTaxInvoicesState] = useState<TaxInvoice[]>(() => load('rice_tax', []));
  const [riceProducts, setRiceProducts] = useState<RiceProduct[]>(() => load('rice_products', []));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => load('rice_inventory', []));
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(
    () => load('rice_inv_tx', [])
  );

  useEffect(() => { save('rice_sales', salesRecords); }, [salesRecords]);
  useEffect(() => { save('rice_tax', taxInvoices); }, [taxInvoices]);
  useEffect(() => { save('rice_products', riceProducts); }, [riceProducts]);
  useEffect(() => { save('rice_inventory', inventory); }, [inventory]);
  useEffect(() => { save('rice_inv_tx', inventoryTransactions); }, [inventoryTransactions]);

  const setSalesRecords = useCallback((records: SalesRecord[]) => {
    setSalesRecordsState(records);
  }, []);

  const addSalesRecords = useCallback((records: SalesRecord[]) => {
    setSalesRecordsState(prev => {
      // 중복 제거 (id 기준)
      const existingIds = new Set(prev.map(r => r.id));
      const newRecords = records.filter(r => !existingIds.has(r.id));
      return [...prev, ...newRecords];
    });
  }, []);

  const setTaxInvoices = useCallback((invoices: TaxInvoice[]) => {
    setTaxInvoicesState(invoices);
  }, []);

  const addTaxInvoices = useCallback((invoices: TaxInvoice[]) => {
    setTaxInvoicesState(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const newInvoices = invoices.filter(r => !existingIds.has(r.id));
      return [...prev, ...newInvoices];
    });
  }, []);

  const addRiceProduct = useCallback((product: Omit<RiceProduct, 'id' | 'costPerKg'>) => {
    const costPerKg = product.purchasePrice / product.weightPerBag;
    const newProduct: RiceProduct = { ...product, id: uuidv4(), costPerKg };
    setRiceProducts(prev => [...prev, newProduct]);
    // 재고 항목도 자동 생성
    setInventory(prev => {
      const exists = prev.find(i => i.productId === newProduct.id);
      if (!exists) {
        return [...prev, {
          id: uuidv4(),
          productId: newProduct.id,
          productName: newProduct.name,
          weightPerBag: newProduct.weightPerBag,
          currentStock: 0,
          currentStockKg: 0,
          lastUpdated: new Date().toISOString(),
        }];
      }
      return prev;
    });
  }, []);

  const updateRiceProduct = useCallback((id: string, update: Partial<RiceProduct>) => {
    setRiceProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...update };
      updated.costPerKg = updated.purchasePrice / updated.weightPerBag;
      return updated;
    }));
  }, []);

  const deleteRiceProduct = useCallback((id: string) => {
    setRiceProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const initInventory = useCallback((productId: string, quantity: number) => {
    setInventory(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      return {
        ...item,
        currentStock: quantity,
        currentStockKg: quantity * item.weightPerBag,
        lastUpdated: new Date().toISOString(),
      };
    }));
  }, []);

  const addInventoryTransaction = useCallback((tx: Omit<InventoryTransaction, 'id'>) => {
    const newTx: InventoryTransaction = { ...tx, id: uuidv4() };
    setInventoryTransactions(prev => [...prev, newTx]);
  }, []);

  const updateInventory = useCallback((
    productId: string,
    delta: number,
    type: 'in' | 'out' | 'adjust',
    memo?: string
  ) => {
    setInventory(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const newStock = type === 'adjust' ? delta : item.currentStock + (type === 'in' ? delta : -delta);
      return {
        ...item,
        currentStock: Math.max(0, newStock),
        currentStockKg: Math.max(0, newStock) * item.weightPerBag,
        lastUpdated: new Date().toISOString(),
      };
    }));
    // 거래 이력 추가
    const item = inventory.find(i => i.productId === productId);
    if (item) {
      addInventoryTransaction({
        productId,
        productName: item.productName,
        type,
        quantity: delta,
        quantityKg: delta * item.weightPerBag,
        date: new Date().toISOString(),
        memo,
      });
    }
  }, [inventory, addInventoryTransaction]);

  return (
    <RiceContext.Provider value={{
      salesRecords, setSalesRecords, addSalesRecords,
      taxInvoices, setTaxInvoices, addTaxInvoices,
      riceProducts, addRiceProduct, updateRiceProduct, deleteRiceProduct,
      inventory, inventoryTransactions, initInventory,
      addInventoryTransaction, updateInventory,
    }}>
      {children}
    </RiceContext.Provider>
  );
};
