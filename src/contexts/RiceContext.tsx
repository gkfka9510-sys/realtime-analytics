// 쌀집 대시보드 전역 상태 관리 (서버 API 연동)
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  SalesRecord, TaxInvoice, RiceProduct, InventoryItem, InventoryTransaction,
  Customer, Item,
} from '@/types/rice';
import { salesApi, taxApi, productApi, inventoryApi, customerApi, itemApi } from '@/lib/api';

interface RiceContextType {
  // 매출
  salesRecords: SalesRecord[];
  setSalesRecords: (records: SalesRecord[]) => void;
  addSalesRecords: (records: SalesRecord[]) => Promise<void>;
  addSalesRecord: (record: SalesRecord) => Promise<void>;
  updateSalesRecord: (id: string, record: Partial<SalesRecord>) => Promise<void>;
  deleteSalesRecord: (id: string) => Promise<void>;
  // 세금계산서
  taxInvoices: TaxInvoice[];
  setTaxInvoices: (invoices: TaxInvoice[]) => void;
  addTaxInvoices: (invoices: TaxInvoice[]) => Promise<void>;
  // 쌀 품목(원가)
  riceProducts: RiceProduct[];
  addRiceProduct: (product: Omit<RiceProduct, 'id' | 'costPerKg'>) => Promise<void>;
  updateRiceProduct: (id: string, product: Partial<RiceProduct>) => Promise<void>;
  deleteRiceProduct: (id: string) => Promise<void>;
  // 재고
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  initInventory: (productId: string, quantity: number) => Promise<void>;
  addInventoryTransaction: (tx: Omit<InventoryTransaction, 'id'>) => Promise<void>;
  updateInventory: (productId: string, delta: number, type: 'in' | 'out' | 'adjust', memo?: string) => Promise<void>;
  // 거래처 (기초데이터)
  customers: Customer[];
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomer: (id: string, c: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  // 품목 (기초데이터)
  items: Item[];
  addItem: (item: Omit<Item, 'id' | 'createdAt'>) => Promise<void>;
  updateItem: (id: string, item: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  // 공통
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
    unit: (r.unit as string) || 'kg',
    unitPrice: Number(r.unit_price) || 0,
    totalAmount: Number(r.total_amount) || 0,
    memo: (r.memo as string) || '',
    transactionType: (r.transaction_type as SalesRecord['transactionType']) || 'sale',
    customerId: (r.customer_id as string) || undefined,
    itemId: (r.item_id as string) || undefined,
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
function mapCustomer(r: Record<string, unknown>): Customer {
  return {
    id: r.id as string,
    name: r.name as string,
    phone: (r.phone as string) || '',
    bizNo: (r.biz_no as string) || '',
    address: (r.address as string) || '',
    ceoName: (r.ceo_name as string) || '',
    bizType: (r.biz_type as string) || '',
    bizItem: (r.biz_item as string) || '',
    email: (r.email as string) || '',
    memo: (r.memo as string) || '',
    createdAt: (r.created_at as string) || '',
  };
}
function mapItem(r: Record<string, unknown>): Item {
  return {
    id: r.id as string,
    name: r.name as string,
    spec: (r.spec as string) || '',
    unit: (r.unit as string) || 'kg',
    stock: Number(r.stock) || 0,
    costPrice: Number(r.cost_price) || 0,
    memo: (r.memo as string) || '',
    createdAt: (r.created_at as string) || '',
  };
}

export const RiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [salesRecords, setSalesRecordsState] = useState<SalesRecord[]>([]);
  const [taxInvoices, setTaxInvoicesState] = useState<TaxInvoice[]>([]);
  const [riceProducts, setRiceProducts] = useState<RiceProduct[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sales, tax, products, inv, invTx, custs, itms] = await Promise.all([
        salesApi.getAll().catch(() => []),
        taxApi.getAll().catch(() => []),
        productApi.getAll().catch(() => []),
        inventoryApi.getAll().catch(() => []),
        inventoryApi.getTransactions().catch(() => []),
        customerApi.getAll().catch(() => []),
        itemApi.getAll().catch(() => []),
      ]);
      setSalesRecordsState((sales as Record<string, unknown>[]).map(mapSales));
      setTaxInvoicesState((tax as Record<string, unknown>[]).map(mapTax));
      setRiceProducts((products as Record<string, unknown>[]).map(mapProduct));
      setInventory((inv as Record<string, unknown>[]).map(mapInventory));
      setInventoryTransactions((invTx as Record<string, unknown>[]).map(mapInvTx));
      setCustomers((custs as Record<string, unknown>[]).map(mapCustomer));
      setItems((itms as Record<string, unknown>[]).map(mapItem));
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
      return [...records.filter(r => !existingIds.has(r.id)), ...prev];
    });
  }, []);

  const addSalesRecord = useCallback(async (record: SalesRecord) => {
    await salesApi.insert(record);
    setSalesRecordsState(prev => [record, ...prev]);
  }, []);

  const updateSalesRecord = useCallback(async (id: string, update: Partial<SalesRecord>) => {
    await salesApi.update(id, update);
    setSalesRecordsState(prev => prev.map(r => r.id === id ? { ...r, ...update } : r));
  }, []);

  const deleteSalesRecord = useCallback(async (id: string) => {
    await salesApi.delete(id);
    setSalesRecordsState(prev => prev.filter(r => r.id !== id));
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

  // 거래처
  const addCustomer = useCallback(async (c: Omit<Customer, 'id' | 'createdAt'>) => {
    const id = uuidv4();
    await customerApi.save({ id, ...c });
    setCustomers(prev => [...prev, { id, ...c, createdAt: new Date().toISOString() }]);
  }, []);

  const updateCustomer = useCallback(async (id: string, update: Partial<Customer>) => {
    await customerApi.update(id, update);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    await customerApi.delete(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  // 품목
  const addItem = useCallback(async (item: Omit<Item, 'id' | 'createdAt'>) => {
    const id = uuidv4();
    await itemApi.save({ id, ...item });
    setItems(prev => [...prev, { id, ...item, createdAt: new Date().toISOString() }]);
  }, []);

  const updateItem = useCallback(async (id: string, update: Partial<Item>) => {
    await itemApi.update(id, update);
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...update } : i));
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await itemApi.delete(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <RiceContext.Provider value={{
      salesRecords, setSalesRecords, addSalesRecords, addSalesRecord, updateSalesRecord, deleteSalesRecord,
      taxInvoices, setTaxInvoices, addTaxInvoices,
      riceProducts, addRiceProduct, updateRiceProduct, deleteRiceProduct,
      inventory, inventoryTransactions, initInventory,
      addInventoryTransaction, updateInventory,
      customers, addCustomer, updateCustomer, deleteCustomer,
      items, addItem, updateItem, deleteItem,
      refreshAll, isLoading,
    }}>
      {children}
    </RiceContext.Provider>
  );
};
