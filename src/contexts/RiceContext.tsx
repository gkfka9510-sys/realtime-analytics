// 쌀집 대시보드 전역 상태 관리 (서버 API 연동)
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  SalesRecord, TaxInvoice, RiceProduct, InventoryItem, InventoryTransaction,
} from '@/types/rice';
import { salesApi, taxApi, productApi, inventoryApi } from '@/lib/api';

interface RiceContextType {
  salesRecords: SalesRecord[];
  setSalesRecords: (records: SalesRecord[]) => void;
  addSalesRecords: (records: SalesRecord[]) => Promise<void>;
  taxInvoices: TaxInvoice[];
  setTaxInvoices: (invoices: TaxInvoice[]) => void;
  addTaxInvoices: (invoices: TaxInvoice[]) => Promise<void>;
  riceProducts: RiceProduct[];
  addRiceProduct: (product: Omit<RiceProduct, 'id' | 'costPerKg'>) => Promise<void>;
  updateRiceProduct: (id: string, product: Partial<RiceProduct>) => Promise<void>;
  deleteRiceProduct: (id: string) => Promise<void>;
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  initInventory: (productId: string, quantity: number) => Promise<void>;
  addInventoryTransaction: (tx: Omit<InventoryTransaction, 'id'>) => Promise<void>;
  updateInventory: (productId: string, delta: number, type: 'in' | 'out' | 'adjust', memo?: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  isLoading: boolean;
}

const RiceContext = createContext<RiceContextType | null>(null);
export const useRice = () => {
  const ctx = useContext(RiceContext);
  if (!ctx) throw new Error('useRice must be used within RiceProvider');
  return ctx;
};

// DB 레코드 → 프론트엔드 타입 변환
function mapSales(r: Record<string, unknown>): SalesRecord {
  return {
    id: r.id as string,
    date: r.date as string,
    companyName: r.company_name as string,
    productName: (r.product_name as string) || '',
    quantity: Number(r.quantity) || 0,
    unitPrice: Number(r.unit_price) || 0,
    totalAmount: Number(r.total_amount) || 0,
    memo: (r.memo as string) || '',
  };
}
function mapTax(r: Record<string, unknown>): TaxInvoice {
  return {
    id: r.id as string,
    issueDate: r.issue_date as string,
    companyName: r.company_name as string,
    totalAmount: Number(r.total_amount) || 0,
    memo: (r.memo as string) || '',
  };
}
function mapProduct(r: Record<string, unknown>): RiceProduct {
  return {
    id: r.id as string,
    name: r.name as string,
    weightPerBag: Number(r.weight_per_bag),
    purchasePrice: Number(r.purchase_price),
    costPerKg: Number(r.cost_per_kg),
    sellingPricePerKg: Number(r.selling_price_per_kg) || 0,
  };
}
function mapInventory(r: Record<string, unknown>): InventoryItem {
  return {
    id: r.id as string,
    productId: r.product_id as string,
    productName: r.product_name as string,
    weightPerBag: Number(r.weight_per_bag),
    currentStock: Number(r.current_stock),
    currentStockKg: Number(r.current_stock_kg),
    lastUpdated: r.last_updated as string,
  };
}
function mapInvTx(r: Record<string, unknown>): InventoryTransaction {
  return {
    id: r.id as string,
    productId: r.product_id as string,
    productName: r.product_name as string,
    type: r.type as 'in' | 'out' | 'adjust',
    quantity: Number(r.quantity),
    quantityKg: Number(r.quantity_kg),
    date: r.date as string,
    memo: (r.memo as string) || '',
  };
}

export const RiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [salesRecords, setSalesRecordsState] = useState<SalesRecord[]>([]);
  const [taxInvoices, setTaxInvoicesState] = useState<TaxInvoice[]>([]);
  const [riceProducts, setRiceProducts] = useState<RiceProduct[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sales, tax, products, inv, invTx] = await Promise.all([
        salesApi.getAll().catch(() => []),
        taxApi.getAll().catch(() => []),
        productApi.getAll().catch(() => []),
        inventoryApi.getAll().catch(() => []),
        inventoryApi.getTransactions().catch(() => []),
      ]);
      setSalesRecordsState((sales as Record<string, unknown>[]).map(mapSales));
      setTaxInvoicesState((tax as Record<string, unknown>[]).map(mapTax));
      setRiceProducts((products as Record<string, unknown>[]).map(mapProduct));
      setInventory((inv as Record<string, unknown>[]).map(mapInventory));
      setInventoryTransactions((invTx as Record<string, unknown>[]).map(mapInvTx));
    } catch (err) {
      console.error('데이터 로드 오류:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const setSalesRecords = useCallback((records: SalesRecord[]) => {
    setSalesRecordsState(records);
  }, []);

  const addSalesRecords = useCallback(async (records: SalesRecord[]) => {
    await salesApi.bulkInsert(records);
    setSalesRecordsState(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      return [...prev, ...records.filter(r => !existingIds.has(r.id))];
    });
  }, []);

  const setTaxInvoices = useCallback((invoices: TaxInvoice[]) => {
    setTaxInvoicesState(invoices);
  }, []);

  const addTaxInvoices = useCallback(async (invoices: TaxInvoice[]) => {
    await taxApi.bulkInsert(invoices);
    setTaxInvoicesState(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      return [...prev, ...invoices.filter(r => !existingIds.has(r.id))];
    });
  }, []);

  const addRiceProduct = useCallback(async (product: Omit<RiceProduct, 'id' | 'costPerKg'>) => {
    const id = uuidv4();
    const costPerKg = product.purchasePrice / product.weightPerBag;
    await productApi.save({ id, ...product, costPerKg });
    const newProduct: RiceProduct = { id, ...product, costPerKg };
    setRiceProducts(prev => [...prev, newProduct]);
    // 재고 초기화
    setInventory(prev => {
      if (prev.find(i => i.productId === id)) return prev;
      return [...prev, {
        id: uuidv4(), productId: id, productName: product.name,
        weightPerBag: product.weightPerBag, currentStock: 0, currentStockKg: 0,
        lastUpdated: new Date().toISOString(),
      }];
    });
  }, []);

  const updateRiceProduct = useCallback(async (id: string, update: Partial<RiceProduct>) => {
    setRiceProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...update };
      updated.costPerKg = updated.purchasePrice / updated.weightPerBag;
      return updated;
    }));
    const product = riceProducts.find(p => p.id === id);
    if (product) {
      const merged = { ...product, ...update };
      merged.costPerKg = merged.purchasePrice / merged.weightPerBag;
      await productApi.update(id, merged);
    }
  }, [riceProducts]);

  const deleteRiceProduct = useCallback(async (id: string) => {
    await productApi.delete(id);
    setRiceProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const initInventory = useCallback(async (productId: string, quantity: number) => {
    const item = inventory.find(i => i.productId === productId);
    if (!item) return;
    const currentStockKg = quantity * item.weightPerBag;
    await inventoryApi.init({
      productId, productName: item.productName,
      weightPerBag: item.weightPerBag, quantity,
    });
    setInventory(prev => prev.map(i =>
      i.productId === productId
        ? { ...i, currentStock: quantity, currentStockKg, lastUpdated: new Date().toISOString() }
        : i
    ));
  }, [inventory]);

  const addInventoryTransaction = useCallback(async (tx: Omit<InventoryTransaction, 'id'>) => {
    const id = uuidv4();
    await inventoryApi.addTransaction({ ...tx, id });
    setInventoryTransactions(prev => [{ ...tx, id }, ...prev]);
  }, []);

  const updateInventory = useCallback(async (
    productId: string, delta: number, type: 'in' | 'out' | 'adjust', memo?: string
  ) => {
    const item = inventory.find(i => i.productId === productId);
    if (!item) return;
    const newStock = type === 'adjust' ? delta : item.currentStock + (type === 'in' ? delta : -delta);
    const clamped = Math.max(0, newStock);
    const currentStockKg = clamped * item.weightPerBag;

    setInventory(prev => prev.map(i =>
      i.productId === productId
        ? { ...i, currentStock: clamped, currentStockKg, lastUpdated: new Date().toISOString() }
        : i
    ));
    await inventoryApi.update(productId, { currentStock: clamped, currentStockKg });

    const tx: Omit<InventoryTransaction, 'id'> = {
      productId, productName: item.productName, type,
      quantity: delta, quantityKg: delta * item.weightPerBag,
      date: new Date().toISOString(), memo,
    };
    await addInventoryTransaction(tx);
  }, [inventory, addInventoryTransaction]);

  return (
    <RiceContext.Provider value={{
      salesRecords, setSalesRecords, addSalesRecords,
      taxInvoices, setTaxInvoices, addTaxInvoices,
      riceProducts, addRiceProduct, updateRiceProduct, deleteRiceProduct,
      inventory, inventoryTransactions, initInventory,
      addInventoryTransaction, updateInventory,
      refreshAll, isLoading,
    }}>
      {children}
    </RiceContext.Provider>
  );
};
