// 쌀집 대시보드 전역 상태 관리 (서버 API 연동)
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  SalesRecord, TaxInvoice, RiceProduct, InventoryItem, InventoryTransaction,
  Customer, Item, RetailCustomer, RetailSale, ShopProduct, Order, OrderStats, OrderStatus,
} from '@/types/rice';
import { salesApi, taxApi, productApi, inventoryApi, customerApi, itemApi, retailCustomerApi, retailSaleApi, shopProductApi, orderApi } from '@/lib/api';

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
  addTaxInvoice: (invoice: TaxInvoice) => Promise<void>;
  updateTaxInvoice: (id: string, invoice: Partial<TaxInvoice>) => Promise<void>;
  deleteTaxInvoice: (id: string) => Promise<void>;
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
  // 소매 단골 고객 (B2C - 매출/순이익 미반영)
  retailCustomers: RetailCustomer[];
  addRetailCustomer: (c: Omit<RetailCustomer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRetailCustomer: (id: string, c: Partial<RetailCustomer>) => Promise<void>;
  deleteRetailCustomer: (id: string) => Promise<void>;
  retailSales: RetailSale[];
  addRetailSale: (sale: Omit<RetailSale, 'id'>) => Promise<void>;
  updateRetailSale: (id: string, sale: Partial<RetailSale>) => Promise<void>;
  deleteRetailSale: (id: string) => Promise<void>;
  // 쇼핑몰 상품 관리
  shopProducts: ShopProduct[];
  addShopProduct: (p: Omit<ShopProduct, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateShopProduct: (id: string, p: Partial<ShopProduct>) => Promise<void>;
  deleteShopProduct: (id: string) => Promise<void>;
  // 주문 관리
  orders: Order[];
  orderStats: OrderStats | null;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
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
function mapRetailCustomer(r: Record<string, unknown>): RetailCustomer {
  return {
    id: r.id as string,
    name: r.name as string,
    phone: (r.phone as string) || '',
    address: (r.address as string) || '',
    birthDate: (r.birth_date as string) || '',
    preferredProduct: (r.preferred_product as string) || '',
    purchaseCycle: (r.purchase_cycle as string) || '',
    grade: ((r.grade as string) || 'regular') as RetailCustomer['grade'],
    memo: (r.memo as string) || '',
    createdAt: (r.created_at as string) || '',
    updatedAt: (r.updated_at as string) || '',
  };
}
function mapRetailSale(r: Record<string, unknown>): RetailSale {
  return {
    id: r.id as string,
    customerId: r.customer_id as string,
    date: r.date as string,
    productName: (r.product_name as string) || '',
    quantity: Number(r.quantity) || 0,
    unit: (r.unit as string) || 'kg',
    unitPrice: Number(r.unit_price) || 0,
    totalAmount: Number(r.total_amount) || 0,
    paymentMethod: ((r.payment_method as string) || 'cash') as RetailSale['paymentMethod'],
    memo: (r.memo as string) || '',
  };
}

function mapShopProduct(r: Record<string, unknown>): ShopProduct {
  let unitOptions: string[] = [];
  try { unitOptions = JSON.parse(r.unit_options as string || '[]'); } catch {}
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) || '',
    unit: (r.unit as string) || 'kg',
    unitOptions,
    price: Number(r.price) || 0,
    imageUrl: (r.image_url as string) || '',
    isAvailable: Number(r.is_available) !== 0,
    sortOrder: Number(r.sort_order) || 0,
    createdAt: (r.created_at as string) || '',
    updatedAt: (r.updated_at as string) || '',
  };
}

function mapOrderItem(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    productId: (r.product_id as string) || undefined,
    productName: r.product_name as string,
    unit: (r.unit as string) || 'kg',
    quantity: Number(r.quantity) || 0,
    unitPrice: Number(r.unit_price) || 0,
    totalPrice: Number(r.total_price) || 0,
  };
}

function mapOrder(r: Record<string, unknown>): Order {
  return {
    id: r.id as string,
    orderNo: r.order_no as string,
    customerName: r.customer_name as string,
    customerPhone: r.customer_phone as string,
    customerAddress: r.customer_address as string,
    deliveryDate: r.delivery_date as string,
    totalAmount: Number(r.total_amount) || 0,
    memo: (r.memo as string) || '',
    status: (r.status as Order['status']) || 'pending',
    createdAt: (r.created_at as string) || '',
    updatedAt: (r.updated_at as string) || '',
    items: Array.isArray(r.items) ? (r.items as Record<string, unknown>[]).map(mapOrderItem) : [],
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
  const [retailCustomers, setRetailCustomers] = useState<RetailCustomer[]>([]);
  const [retailSales, setRetailSales] = useState<RetailSale[]>([]);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);

    // 1단계: 핵심 데이터 (매출, 세금, 상품, 재고) - 순차 로드로 DB 부하 분산
    const sales = await salesApi.getAll().catch(() => []);
    setSalesRecordsState((sales as Record<string, unknown>[]).map(mapSales));

    const tax = await taxApi.getAll().catch(() => []);
    setTaxInvoicesState((tax as Record<string, unknown>[]).map(mapTax));

    const products = await productApi.getAll().catch(() => []);
    setRiceProducts((products as Record<string, unknown>[]).map(mapProduct));

    const inv = await inventoryApi.getAll().catch(() => []);
    setInventory((inv as Record<string, unknown>[]).map(mapInventory));

    setIsLoading(false); // 핵심 데이터 로드 완료 → 즉시 UI 표시

    // 2단계: 보조 데이터 (재고이력, 거래처, 품목) - 비동기 백그라운드
    Promise.all([
      inventoryApi.getTransactions().catch(() => []),
      customerApi.getAll().catch(() => []),
      itemApi.getAll().catch(() => []),
    ]).then(([invTx, custs, itms]) => {
      setInventoryTransactions((invTx as Record<string, unknown>[]).map(mapInvTx));
      setCustomers((custs as Record<string, unknown>[]).map(mapCustomer));
      setItems((itms as Record<string, unknown>[]).map(mapItem));
    }).catch(err => console.error('보조 데이터 로드 오류:', err));

    // 3단계: 소매/주문 데이터 - 완전 비동기 (탭 진입 시에도 별도 로드)
    Promise.all([
      retailCustomerApi.getAll().catch(() => []),
      retailSaleApi.getAll().catch(() => []),
    ]).then(([rCusts, rSales]) => {
      setRetailCustomers((rCusts as Record<string, unknown>[]).map(mapRetailCustomer));
      setRetailSales((rSales as Record<string, unknown>[]).map(mapRetailSale));
    }).catch(err => console.error('소매 데이터 로드 오류:', err));

    // 4단계: 쇼핑몰/주문 데이터 - 가장 나중에 (대시보드 표시 후 로드)
    setTimeout(() => {
      Promise.all([
        shopProductApi.getAll().catch(() => []),
        orderApi.getAll().catch(() => []),
        orderApi.getStats().catch(() => null),
      ]).then(([sProds, ords, oStats]) => {
        setShopProducts((sProds as Record<string, unknown>[]).map(mapShopProduct));
        setOrders((ords as Record<string, unknown>[]).map(mapOrder));
        if (oStats) setOrderStats(oStats as OrderStats);
      }).catch(err => console.error('주문 데이터 로드 오류:', err));
    }, 1000); // 1초 후 로드 (핵심 UI 렌더링 후)
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

  const addTaxInvoice = useCallback(async (invoice: TaxInvoice) => {
    await taxApi.insert(invoice);
    setTaxInvoicesState(prev => [invoice, ...prev]);
  }, []);

  const updateTaxInvoice = useCallback(async (id: string, update: Partial<TaxInvoice>) => {
    await taxApi.update(id, update);
    setTaxInvoicesState(prev => prev.map(t => t.id === id ? { ...t, ...update } : t));
  }, []);

  const deleteTaxInvoice = useCallback(async (id: string) => {
    await taxApi.delete(id);
    setTaxInvoicesState(prev => prev.filter(t => t.id !== id));
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

  // 소매 단골 고객
  const addRetailCustomer = useCallback(async (c: Omit<RetailCustomer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = uuidv4();
    await retailCustomerApi.save({ id, ...c });
    setRetailCustomers(prev => [...prev, { id, ...c, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
  }, []);

  const updateRetailCustomer = useCallback(async (id: string, update: Partial<RetailCustomer>) => {
    await retailCustomerApi.update(id, update);
    setRetailCustomers(prev => prev.map(c => c.id === id ? { ...c, ...update, updatedAt: new Date().toISOString() } : c));
  }, []);

  const deleteRetailCustomer = useCallback(async (id: string) => {
    await retailCustomerApi.delete(id);
    setRetailCustomers(prev => prev.filter(c => c.id !== id));
    setRetailSales(prev => prev.filter(s => s.customerId !== id));
  }, []);

  // 소매 판매 기록
  const addRetailSale = useCallback(async (sale: Omit<RetailSale, 'id'>) => {
    const id = uuidv4();
    await retailSaleApi.insert({ id, ...sale });
    setRetailSales(prev => [{ id, ...sale }, ...prev]);
  }, []);

  const updateRetailSale = useCallback(async (id: string, update: Partial<RetailSale>) => {
    await retailSaleApi.update(id, update);
    setRetailSales(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const deleteRetailSale = useCallback(async (id: string) => {
    await retailSaleApi.delete(id);
    setRetailSales(prev => prev.filter(s => s.id !== id));
  }, []);

  // 쇼핑몰 상품
  const addShopProduct = useCallback(async (p: Omit<ShopProduct, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = uuidv4();
    await shopProductApi.save({ id, ...p });
    setShopProducts(prev => [...prev, { id, ...p, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
  }, []);

  const updateShopProduct = useCallback(async (id: string, update: Partial<ShopProduct>) => {
    await shopProductApi.update(id, update);
    setShopProducts(prev => prev.map(p => p.id === id ? { ...p, ...update, updatedAt: new Date().toISOString() } : p));
  }, []);

  const deleteShopProduct = useCallback(async (id: string) => {
    await shopProductApi.delete(id);
    setShopProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  // 주문 관리
  const refreshOrders = useCallback(async () => {
    try {
      const [ords, oStats] = await Promise.all([
        orderApi.getAll().catch(() => []),
        orderApi.getStats().catch(() => null),
      ]);
      setOrders((ords as Record<string, unknown>[]).map(mapOrder));
      if (oStats) setOrderStats(oStats as OrderStats);
    } catch (err) {
      console.error('주문 로드 오류:', err);
    }
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    await orderApi.updateStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    await orderApi.delete(id);
    setOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  return (
    <RiceContext.Provider value={{
      salesRecords, setSalesRecords, addSalesRecords, addSalesRecord, updateSalesRecord, deleteSalesRecord,
      taxInvoices, setTaxInvoices, addTaxInvoices, addTaxInvoice, updateTaxInvoice, deleteTaxInvoice,
      riceProducts, addRiceProduct, updateRiceProduct, deleteRiceProduct,
      inventory, inventoryTransactions, initInventory,
      addInventoryTransaction, updateInventory,
      customers, addCustomer, updateCustomer, deleteCustomer,
      items, addItem, updateItem, deleteItem,
      retailCustomers, addRetailCustomer, updateRetailCustomer, deleteRetailCustomer,
      retailSales, addRetailSale, updateRetailSale, deleteRetailSale,
      shopProducts, addShopProduct, updateShopProduct, deleteShopProduct,
      orders, orderStats, updateOrderStatus, deleteOrder, refreshOrders,
      refreshAll, isLoading,
    }}>
      {children}
    </RiceContext.Provider>
  );
};
