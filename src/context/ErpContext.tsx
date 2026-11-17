import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  allocateBatchesForSale,
  BOOTSTRAP_ADMIN_EMAIL,
  Customer,
  CustomerSector,
  DEFAULT_TAX_RATE_PCT,
  DeliveryStatus,
  FinancialPayment,
  FleetVehicle,
  getSectorPrice,
  InventoryBatch,
  ORG_ID,
  PaymentMethod,
  POStatus,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  SalesOrder,
  SalesOrderItem,
  SalesRep,
  StockCount,
  Supplier,
  UserProfile,
  UserRole,
  VehicleStatus,
  VoucherMethod,
} from '../types/erp';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ErpContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  dataLoading: boolean;
  authError: string | null;
  authNeedsConsoleSetup: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithCredentials: (input: { identifier: string; password: string }) => Promise<void>;
  registerWithCredentials: (input: {
    displayName: string;
    identifier: string;
    password: string;
  }) => Promise<void>;
  clearAuthError: () => void;
  signOutUser: () => Promise<void>;
  canEdit: (roles: UserRole[]) => boolean;

  suppliers: Supplier[];
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  batches: InventoryBatch[];
  stockCounts: StockCount[];
  customers: Customer[];
  salesReps: SalesRep[];
  vehicles: FleetVehicle[];
  salesOrders: SalesOrder[];
  payments: FinancialPayment[];
  usersList: UserProfile[];

  toasts: ToastMessage[];
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  seedOperationalData: () => Promise<void>;
  seeding: boolean;

  createSupplier: (
    data: Omit<Supplier, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  createProduct: (
    data: Omit<Product, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateProduct: (
    id: string,
    updates: Partial<
      Pick<
        Product,
        | 'name'
        | 'category'
        | 'reorderPointUnits'
        | 'storageTempMin'
        | 'storageTempMax'
        | 'priceSupermarketYer'
        | 'priceWholesaleYer'
        | 'priceB2bYer'
        | 'taxable'
        | 'rotationPolicy'
      >
    >
  ) => Promise<void>;
  createPurchaseOrder: (input: {
    supplier: Supplier;
    shipmentType: 'local' | 'import';
    expectedDate: string;
    freightCostYer: number;
    customsDutyYer: number;
    notes: string;
    items: PurchaseOrderItem[];
  }) => Promise<void>;
  advancePurchaseOrderStatus: (po: PurchaseOrder, nextStatus: POStatus) => Promise<void>;
  receivePurchaseOrder: (
    po: PurchaseOrder,
    batchDetails: Record<
      string,
      {
        batchNumber: string;
        mfgDate: string;
        expiryDate: string;
        warehouseZone: string;
        recordedTempC: number;
      }
    >
  ) => Promise<void>;
  recordStockCount: (input: {
    batch: InventoryBatch;
    countedUnits: number;
    reason: string;
  }) => Promise<void>;
  updateBatchStorage: (
    batch: InventoryBatch,
    updates: {
      warehouseZone?: string;
      recordedTempC?: number;
      status?: InventoryBatch['status'];
    }
  ) => Promise<void>;
  createCustomer: (
    data: Omit<Customer, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  createSalesRep: (
    data: Omit<SalesRep, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  createVehicle: (
    data: Omit<FleetVehicle, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateVehicleStatus: (vehicleId: string, status: VehicleStatus, currentRoute?: string) => Promise<void>;
  createSalesOrder: (input: {
    customer: Customer;
    rep?: SalesRep;
    vehicle?: FleetVehicle;
    paymentMethod: PaymentMethod;
    taxRatePct: number;
    lineItems: {
      product: Product;
      uom: 'base' | 'pack';
      quantityEntered: number;
      customUnitPriceYer?: number;
    }[];
  }) => Promise<void>;
  updateSalesOrderDelivery: (input: {
    order: SalesOrder;
    deliveryStatus: DeliveryStatus;
    vehicleId?: string;
    routeName?: string;
    collectCashAmountYer?: number;
  }) => Promise<void>;
  recordPayment: (input: {
    paymentType: 'customer_receipt' | 'supplier_payment';
    partyId: string;
    partyName: string;
    referenceDocId?: string;
    amountYer: number;
    method: VoucherMethod;
    notes?: string;
  }) => Promise<void>;
  updateUserRole: (uid: string, role: UserRole, active: boolean) => Promise<void>;
}

const ErpContext = createContext<ErpContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ErpProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNeedsConsoleSetup, setAuthNeedsConsoleSetup] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const pendingRegistrationRef = useRef<{ displayName: string; phone: string } | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [payments, setPayments] = useState<FinancialPayment[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = makeId('toast');
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);
      if (!user) {
        setUserProfile(null);
        setAuthLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const isBootstrap = user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified;

        if (!snap.exists()) {
          const defaultRole: UserRole = isBootstrap ? 'admin' : 'viewer';
          const pending = pendingRegistrationRef.current;
          const displayName =
            pending?.displayName ||
            user.displayName ||
            user.email?.split('@')[0] ||
            'مستخدم النظام';
          const phone = pending?.phone || '';
          pendingRegistrationRef.current = null;
          await setDoc(userRef, {
            uid: user.uid,
            orgId: ORG_ID,
            displayName: displayName.slice(0, 120),
            role: defaultRole,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
            email: user.email || '',
            ...(phone ? { phone: phone.slice(0, 40) } : {}),
            updatedAt: serverTimestamp(),
          });
          if (isBootstrap) {
            await setDoc(doc(db, 'admins', user.uid), {
              grantedAt: serverTimestamp(),
              grantedBy: user.uid,
            });
          }
          setUserProfile({
            id: user.uid,
            uid: user.uid,
            orgId: ORG_ID,
            displayName,
            role: defaultRole,
            active: true,
          });
        } else {
          const data = snap.data() as UserProfile;
          setUserProfile({ ...data, id: snap.id });
        }
      } catch (err) {
        console.error('Failed to bootstrap user profile:', err);
        setAuthError('تعذر تحميل ملف المستخدم أو التحقق من الصلاحيات.');
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !userProfile) {
      setSuppliers([]);
      setProducts([]);
      setPurchaseOrders([]);
      setBatches([]);
      setStockCounts([]);
      setCustomers([]);
      setSalesReps([]);
      setVehicles([]);
      setSalesOrders([]);
      setPayments([]);
      setUsersList([]);
      return;
    }

    setDataLoading(true);
    const unsubs: (() => void)[] = [];

    const subscribeCol = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const q = query(collection(db, colName), where('orgId', '==', ORG_ID));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
          setter(items);
          setDataLoading(false);
        },
        (err) => {
          setDataLoading(false);
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );
      unsubs.push(unsub);
    };

    subscribeCol<Supplier>('suppliers', setSuppliers);
    subscribeCol<Product>('products', setProducts);
    subscribeCol<PurchaseOrder>('purchaseOrders', setPurchaseOrders);
    subscribeCol<InventoryBatch>('batches', setBatches);
    subscribeCol<StockCount>('stockCounts', setStockCounts);
    subscribeCol<Customer>('customers', setCustomers);
    subscribeCol<SalesRep>('salesReps', setSalesReps);
    subscribeCol<FleetVehicle>('vehicles', setVehicles);
    subscribeCol<SalesOrder>('salesOrders', setSalesOrders);
    subscribeCol<FinancialPayment>('payments', setPayments);

    // Subscribe to users list only for bootstrap admin or self
    const usersQuery =
      firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL
        ? query(collection(db, 'users'), where('orgId', '==', ORG_ID))
        : query(
            collection(db, 'users'),
            where('orgId', '==', ORG_ID),
            where('uid', '==', firebaseUser.uid)
          );

    const unsubUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as UserProfile);
        setUsersList(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
    unsubs.push(unsubUsers);

    // Also listen to own profile updates
    const unsubSelf = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile({ id: snap.id, ...snap.data() } as UserProfile);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
      }
    );
    unsubs.push(unsubSelf);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser?.uid, userProfile?.role]);

  const resolveAuthIdentifier = (identifier: string) => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      throw new Error('يرجى إدخال البريد الإلكتروني أو رقم الهاتف');
    }
    if (trimmed.includes('@')) {
      return {
        authEmail: trimmed.toLowerCase(),
        phone: '',
      };
    }
    const cleaned = trimmed.replace(/[\s\-()]/g, '');
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      throw new Error('يرجى إدخال بريد إلكتروني صحيح أو رقم هاتف مكون من 7 إلى 15 رقماً');
    }
    return {
      authEmail: `phone_${digits}@naqaa-phone.local`,
      phone: cleaned,
    };
  };

  const mapAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
      setAuthNeedsConsoleSetup(true);
      return 'مزود تسجيل الدخول بالبريد/كلمة المرور غير مفعل بعد في Firebase Console.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'هذا البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني أو رقم الهاتف وكلمة المرور.';
    }
    if (code === 'auth/weak-password') {
      return 'كلمة المرور قصيرة جداً. يجب أن تكون 6 أحرف على الأقل.';
    }
    if (code === 'auth/invalid-email') {
      return 'صيغة البريد الإلكتروني أو رقم الهاتف غير صالحة.';
    }
    if (code === 'auth/too-many-requests') {
      return 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً. حاول لاحقاً.';
    }
    return err instanceof Error ? err.message : 'تعذر إتمام عملية المصادقة';
  };

  const clearAuthError = () => {
    setAuthError(null);
    setAuthNeedsConsoleSetup(false);
  };

  const signInWithGoogle = async () => {
    clearAuthError();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(mapAuthError(err));
    }
  };

  const loginWithCredentials = async (input: { identifier: string; password: string }) => {
    clearAuthError();
    try {
      const { authEmail } = resolveAuthIdentifier(input.identifier);
      await signInWithEmailAndPassword(auth, authEmail, input.password);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const registerWithCredentials = async (input: {
    displayName: string;
    identifier: string;
    password: string;
  }) => {
    clearAuthError();
    try {
      const name = input.displayName.trim();
      if (name.length < 2) {
        throw new Error('يرجى إدخال الاسم الكامل (حرفين على الأقل)');
      }
      if (input.password.length < 6) {
        throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      }
      const { authEmail, phone } = resolveAuthIdentifier(input.identifier);
      pendingRegistrationRef.current = { displayName: name, phone };
      const cred = await createUserWithEmailAndPassword(auth, authEmail, input.password);
      await updateProfile(cred.user, { displayName: name });
    } catch (err) {
      pendingRegistrationRef.current = null;
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const canEdit = (roles: UserRole[]) => {
    if (!userProfile || !userProfile.active) return false;
    if (userProfile.role === 'admin' || firebaseUser?.email === BOOTSTRAP_ADMIN_EMAIL) {
      return true;
    }
    return roles.includes(userProfile.role);
  };

  const requireUid = () => {
    if (!firebaseUser) throw new Error('يجب تسجيل الدخول أولاً');
    return firebaseUser.uid;
  };

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const createSupplier: ErpContextValue['createSupplier'] = async (data) => {
    const uid = requireUid();
    const id = makeId('sup');
    try {
      await setDoc(doc(db, 'suppliers', id), {
        ...data,
        orgId: ORG_ID,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('تم إضافة المورد بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `suppliers/${id}`);
    }
  };

  const createProduct: ErpContextValue['createProduct'] = async (data) => {
    const uid = requireUid();
    const id = makeId('prd');
    try {
      await setDoc(doc(db, 'products', id), {
        ...data,
        orgId: ORG_ID,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('تم تسجيل الصنف بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${id}`);
    }
  };

  const updateProduct: ErpContextValue['updateProduct'] = async (id, updates) => {
    try {
      await updateDoc(doc(db, 'products', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      notify('تم تحديث بيانات الصنف');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
    }
  };

  const createPurchaseOrder: ErpContextValue['createPurchaseOrder'] = async (input) => {
    const uid = requireUid();
    const id = makeId('po');
    const goodsSubtotalYer = input.items.reduce((s, it) => s + it.lineTotalYer, 0);
    const totalLandedCostYer = goodsSubtotalYer + input.freightCostYer + input.customsDutyYer;
    const poNumber = `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 101)}`;

    try {
      await setDoc(doc(db, 'purchaseOrders', id), {
        orgId: ORG_ID,
        poNumber,
        supplierId: input.supplier.id,
        supplierName: input.supplier.name,
        shipmentType: input.shipmentType,
        status: 'ordered' as POStatus,
        expectedDate: input.expectedDate || '',
        goodsSubtotalYer: Math.round(goodsSubtotalYer),
        freightCostYer: Math.round(input.freightCostYer),
        customsDutyYer: Math.round(input.customsDutyYer),
        totalLandedCostYer: Math.round(totalLandedCostYer),
        paidAmountYer: 0,
        items: input.items,
        notes: input.notes || '',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify(`تم إصدار أمر الشراء ${poNumber}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `purchaseOrders/${id}`);
    }
  };

  const advancePurchaseOrderStatus: ErpContextValue['advancePurchaseOrderStatus'] = async (
    po,
    nextStatus
  ) => {
    try {
      await updateDoc(doc(db, 'purchaseOrders', po.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      notify(`تم تحديث حالة الشحنة ${po.poNumber}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `purchaseOrders/${po.id}`);
    }
  };

  const receivePurchaseOrder: ErpContextValue['receivePurchaseOrder'] = async (
    po,
    batchDetails
  ) => {
    const uid = requireUid();
    const batch = writeBatch(db);

    const overheadTotal = po.freightCostYer + po.customsDutyYer;
    const subtotalSafe = Math.max(1, po.goodsSubtotalYer);

    batch.update(doc(db, 'purchaseOrders', po.id), {
      status: 'received',
      updatedAt: serverTimestamp(),
    });

    for (const item of po.items) {
      const details = batchDetails[item.productId];
      const itemOverheadShare = (item.lineTotalYer / subtotalSafe) * overheadTotal;
      const landedUnitCostYer = Math.round(
        (item.lineTotalYer + itemOverheadShare) / Math.max(1, item.totalBaseUnits)
      );
      const batchId = makeId('bat');
      batch.set(doc(db, 'batches', batchId), {
        orgId: ORG_ID,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        batchNumber: details?.batchNumber || `LOT-${Date.now().toString().slice(-5)}`,
        warehouseZone: details?.warehouseZone || 'المستودع الرئيسي - أ',
        recordedTempC: details?.recordedTempC ?? 21,
        mfgDate: details?.mfgDate || new Date().toISOString().slice(0, 10),
        expiryDate:
          details?.expiryDate ||
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        initialUnits: item.totalBaseUnits,
        remainingUnits: item.totalBaseUnits,
        landedUnitCostYer,
        poId: po.id,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(db, 'products', item.productId), {
        lastPurchaseCostYer: landedUnitCostYer,
        updatedAt: serverTimestamp(),
      });
    }

    const supplier = suppliers.find((s) => s.id === po.supplierId);
    if (supplier) {
      batch.update(doc(db, 'suppliers', supplier.id), {
        balanceYer: Math.round(supplier.balanceYer + po.totalLandedCostYer),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      notify(`تم استلام الشحنة ${po.poNumber} وتوليد الدفعات بالتكلفة الشاملة`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `purchaseOrders/${po.id}`);
    }
  };

  const recordStockCount: ErpContextValue['recordStockCount'] = async ({
    batch: invBatch,
    countedUnits,
    reason,
  }) => {
    const uid = requireUid();
    const varianceUnits = countedUnits - invBatch.remainingUnits;
    const countId = makeId('cnt');
    const wb = writeBatch(db);

    wb.set(doc(db, 'stockCounts', countId), {
      orgId: ORG_ID,
      batchId: invBatch.id,
      productId: invBatch.productId,
      productName: invBatch.productName,
      batchNumber: invBatch.batchNumber,
      systemUnits: invBatch.remainingUnits,
      countedUnits,
      varianceUnits,
      reason,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });

    wb.update(doc(db, 'batches', invBatch.id), {
      remainingUnits: Math.min(countedUnits, invBatch.initialUnits),
      status: countedUnits <= 0 ? 'depleted' : invBatch.status === 'depleted' ? 'active' : invBatch.status,
      updatedAt: serverTimestamp(),
    });

    try {
      await wb.commit();
      notify('تم اعتماد الجرد الفعلي وتحديث رصيد الدفعة');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `stockCounts/${countId}`);
    }
  };

  const updateBatchStorage: ErpContextValue['updateBatchStorage'] = async (invBatch, updates) => {
    try {
      await updateDoc(doc(db, 'batches', invBatch.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      notify('تم تحديث بيانات التخزين للدفعة');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `batches/${invBatch.id}`);
    }
  };

  const createCustomer: ErpContextValue['createCustomer'] = async (data) => {
    const uid = requireUid();
    const id = makeId('cus');
    try {
      await setDoc(doc(db, 'customers', id), {
        ...data,
        orgId: ORG_ID,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('تم إضافة العميل بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `customers/${id}`);
    }
  };

  const createSalesRep: ErpContextValue['createSalesRep'] = async (data) => {
    const uid = requireUid();
    const id = makeId('rep');
    try {
      await setDoc(doc(db, 'salesReps', id), {
        ...data,
        orgId: ORG_ID,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('تم إضافة مندوب المبيعات');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `salesReps/${id}`);
    }
  };

  const createVehicle: ErpContextValue['createVehicle'] = async (data) => {
    const uid = requireUid();
    const id = makeId('veh');
    try {
      await setDoc(doc(db, 'vehicles', id), {
        ...data,
        orgId: ORG_ID,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('تم إضافة سيارة التوزيع للأسطول');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `vehicles/${id}`);
    }
  };

  const updateVehicleStatus: ErpContextValue['updateVehicleStatus'] = async (
    vehicleId,
    status,
    currentRoute
  ) => {
    try {
      const payload: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (currentRoute !== undefined) {
        payload.currentRoute = currentRoute;
      }
      await updateDoc(doc(db, 'vehicles', vehicleId), payload);
      notify('تم تحديث حالة السيارة');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicleId}`);
    }
  };

  const createSalesOrder: ErpContextValue['createSalesOrder'] = async (input) => {
    const uid = requireUid();
    const wb = writeBatch(db);
    const orderId = makeId('inv');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(salesOrders.length + 1001)}`;

    // Track cumulative batch deductions so multiple lines of same product don't overdraw
    const workingBatches = batches.map((b) => ({ ...b }));
    const builtItems: SalesOrderItem[] = [];
    let subtotalYer = 0;
    let taxAmountYer = 0;
    let cogsYer = 0;

    for (const line of input.lineItems) {
      const unitsPerPack = line.product.unitsPerPack || 1;
      const totalBaseUnits =
        line.uom === 'pack' ? line.quantityEntered * unitsPerPack : line.quantityEntered;

      const allocationResult = allocateBatchesForSale(
        line.product.id,
        totalBaseUnits,
        workingBatches,
        line.product.rotationPolicy
      );

      if (!allocationResult.sufficient) {
        throw new Error(
          `الرصيد الصالح للصنف "${line.product.name}" غير كافٍ (المتوفر: ${allocationResult.availableUnits} ${line.product.baseUnitName})`
        );
      }

      // Deduct from workingBatches & queue batch updates
      for (const slice of allocationResult.allocations) {
        const target = workingBatches.find((b) => b.id === slice.batchId);
        if (target) {
          target.remainingUnits -= slice.unitsTaken;
        }
      }

      const defaultUnitPrice = getSectorPrice(line.product, input.customer.sector);
      const baseUnitPrice =
        line.customUnitPriceYer !== undefined
          ? line.uom === 'pack'
            ? line.customUnitPriceYer / unitsPerPack
            : line.customUnitPriceYer
          : defaultUnitPrice;

      const lineSubtotalYer = Math.round(baseUnitPrice * totalBaseUnits);
      const lineTax = line.product.taxable
        ? Math.round((lineSubtotalYer * input.taxRatePct) / 100)
        : 0;
      const lineCogsYer = allocationResult.totalCogsYer;
      const lineProfitYer = lineSubtotalYer - lineCogsYer;

      subtotalYer += lineSubtotalYer;
      taxAmountYer += lineTax;
      cogsYer += lineCogsYer;

      builtItems.push({
        productId: line.product.id,
        productName: line.product.name,
        sku: line.product.sku,
        uom: line.uom,
        quantityEntered: line.quantityEntered,
        unitsPerPack,
        totalBaseUnits,
        unitPriceYer: Math.round(
          line.uom === 'pack' ? baseUnitPrice * unitsPerPack : baseUnitPrice
        ),
        lineSubtotalYer,
        lineCogsYer,
        lineProfitYer,
        allocations: allocationResult.allocations,
      });
    }

    const totalYer = subtotalYer + taxAmountYer;
    const grossProfitYer = subtotalYer - cogsYer;

    if (
      input.paymentMethod === 'credit' &&
      input.customer.creditLimitYer > 0 &&
      input.customer.balanceYer + totalYer > input.customer.creditLimitYer
    ) {
      throw new Error(
        `تتجاوز الفاتورة حد الائتمان المسموح للعميل (${input.customer.creditLimitYer.toLocaleString()} ر.ي)`
      );
    }

    const paidAmountYer = input.paymentMethod === 'cash' ? totalYer : 0;

    // Commit batch deductions
    for (const orig of batches) {
      const updated = workingBatches.find((w) => w.id === orig.id);
      if (updated && updated.remainingUnits !== orig.remainingUnits) {
        wb.update(doc(db, 'batches', orig.id), {
          remainingUnits: updated.remainingUnits,
          status: updated.remainingUnits <= 0 ? 'depleted' : orig.status,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const orderPayload: Record<string, unknown> = {
      orgId: ORG_ID,
      invoiceNumber,
      customerId: input.customer.id,
      customerName: input.customer.name,
      sector: input.customer.sector,
      repId: input.rep?.id || '',
      repName: input.rep?.name || '',
      vehicleId: input.vehicle?.id || '',
      routeName: input.customer.routeName || input.vehicle?.currentRoute || '',
      paymentMethod: input.paymentMethod,
      deliveryStatus: input.vehicle ? 'dispatched' : 'pending',
      subtotalYer,
      taxRatePct: input.taxRatePct,
      taxAmountYer,
      totalYer,
      cogsYer,
      grossProfitYer,
      paidAmountYer,
      items: builtItems,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    wb.set(doc(db, 'salesOrders', orderId), orderPayload);

    if (input.paymentMethod === 'credit') {
      wb.update(doc(db, 'customers', input.customer.id), {
        balanceYer: Math.round(input.customer.balanceYer + totalYer),
        updatedAt: serverTimestamp(),
      });
    } else {
      const payId = makeId('pay');
      wb.set(doc(db, 'payments', payId), {
        orgId: ORG_ID,
        voucherNumber: `RCV-${Date.now().toString().slice(-5)}`,
        paymentType: 'customer_receipt',
        partyId: input.customer.id,
        partyName: input.customer.name,
        referenceDocId: orderId,
        amountYer: totalYer,
        method: 'cash',
        notes: `تحصيل نقدي فوري لفاتورة ${invoiceNumber}`,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await wb.commit();
      notify(`تم إصدار الفاتورة ${invoiceNumber} وخصم الدفعات وفق FEFO`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `salesOrders/${orderId}`);
    }
  };

  const updateSalesOrderDelivery: ErpContextValue['updateSalesOrderDelivery'] = async ({
    order,
    deliveryStatus,
    vehicleId,
    routeName,
    collectCashAmountYer,
  }) => {
    const uid = requireUid();
    const wb = writeBatch(db);
    const collect = Math.max(0, Math.round(collectCashAmountYer || 0));
    const maxCollectible = Math.max(0, order.totalYer - order.paidAmountYer);
    const actualCollect = Math.min(collect, maxCollectible);

    const orderUpdates: Record<string, unknown> = {
      deliveryStatus,
      paidAmountYer: order.paidAmountYer + actualCollect,
      updatedAt: serverTimestamp(),
    };
    if (vehicleId !== undefined) orderUpdates.vehicleId = vehicleId;
    if (routeName !== undefined) orderUpdates.routeName = routeName;

    wb.update(doc(db, 'salesOrders', order.id), orderUpdates);

    if (actualCollect > 0) {
      const payId = makeId('pay');
      wb.set(doc(db, 'payments', payId), {
        orgId: ORG_ID,
        voucherNumber: `FLD-${Date.now().toString().slice(-5)}`,
        paymentType: 'customer_receipt',
        partyId: order.customerId,
        partyName: order.customerName,
        referenceDocId: order.id,
        amountYer: actualCollect,
        method: 'field_collection',
        notes: `تحصيل ميداني عند التسليم — ${order.invoiceNumber}`,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });

      const cust = customers.find((c) => c.id === order.customerId);
      if (cust) {
        wb.update(doc(db, 'customers', cust.id), {
          balanceYer: Math.max(0, Math.round(cust.balanceYer - actualCollect)),
          updatedAt: serverTimestamp(),
        });
      }
    }

    try {
      await wb.commit();
      notify(`تم تحديث حالة التسليم للفاتورة ${order.invoiceNumber}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `salesOrders/${order.id}`);
    }
  };

  const recordPayment: ErpContextValue['recordPayment'] = async (input) => {
    const uid = requireUid();
    const wb = writeBatch(db);
    const payId = makeId('pay');
    const amount = Math.round(input.amountYer);

    wb.set(doc(db, 'payments', payId), {
      orgId: ORG_ID,
      voucherNumber: `${input.paymentType === 'customer_receipt' ? 'RCV' : 'PAY'}-${Date.now().toString().slice(-5)}`,
      paymentType: input.paymentType,
      partyId: input.partyId,
      partyName: input.partyName,
      referenceDocId: input.referenceDocId || '',
      amountYer: amount,
      method: input.method,
      notes: input.notes || '',
      createdBy: uid,
      createdAt: serverTimestamp(),
    });

    if (input.paymentType === 'customer_receipt') {
      const cust = customers.find((c) => c.id === input.partyId);
      if (cust) {
        wb.update(doc(db, 'customers', cust.id), {
          balanceYer: Math.max(0, Math.round(cust.balanceYer - amount)),
          updatedAt: serverTimestamp(),
        });
      }
      if (input.referenceDocId) {
        const ord = salesOrders.find((o) => o.id === input.referenceDocId);
        if (ord) {
          wb.update(doc(db, 'salesOrders', ord.id), {
            paidAmountYer: Math.min(ord.totalYer, ord.paidAmountYer + amount),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } else {
      const sup = suppliers.find((s) => s.id === input.partyId);
      if (sup) {
        wb.update(doc(db, 'suppliers', sup.id), {
          balanceYer: Math.max(0, Math.round(sup.balanceYer - amount)),
          updatedAt: serverTimestamp(),
        });
      }
      if (input.referenceDocId) {
        const po = purchaseOrders.find((p) => p.id === input.referenceDocId);
        if (po) {
          wb.update(doc(db, 'purchaseOrders', po.id), {
            paidAmountYer: Math.min(po.totalLandedCostYer, po.paidAmountYer + amount),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    try {
      await wb.commit();
      notify(
        input.paymentType === 'customer_receipt'
          ? 'تم تسجيل سند القبض وتحديث مديونية العميل'
          : 'تم تسجيل سند الصرف وتحديث رصيد المورد'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `payments/${payId}`);
    }
  };

  const updateUserRole: ErpContextValue['updateUserRole'] = async (uid, role, active) => {
    const wb = writeBatch(db);
    wb.update(doc(db, 'users', uid), {
      role,
      active,
      updatedAt: serverTimestamp(),
    });
    if (role === 'admin' && active) {
      wb.set(doc(db, 'admins', uid), {
        grantedAt: serverTimestamp(),
        grantedBy: requireUid(),
      });
    }
    try {
      await wb.commit();
      notify('تم تحديث صلاحيات المستخدم');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  };

  // -------------------------------------------------------------------------
  // Seed Realistic Operational Data (2-Phase Batch for Relational Integrity)
  // -------------------------------------------------------------------------
  const seedOperationalData = async () => {
    const uid = requireUid();
    setSeeding(true);
    try {
      const today = new Date();
      const addDays = (days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      };

      // Phase 1: Master Entities (Suppliers, Products, Customers, Reps, Vehicles)
      const batch1 = writeBatch(db);

      const sup1 = 'sup_saba_local';
      const sup2 = 'sup_tihama_local';
      const sup3 = 'sup_gulf_intl';
      const sup4 = 'sup_anatolia_intl';

      batch1.set(doc(db, 'suppliers', sup1), {
        orgId: ORG_ID,
        name: 'مصنع سبأ للمنظفات الحديثة',
        supplierType: 'local',
        country: 'اليمن — صنعاء',
        contactName: 'أحمد المقطري',
        phone: '777123456',
        currency: 'YER',
        paymentTermsDays: 30,
        balanceYer: 1450000,
        leadTimeDays: 3,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'suppliers', sup2), {
        orgId: ORG_ID,
        name: 'شركة تهامة للكيماويات والعبوات',
        supplierType: 'local',
        country: 'اليمن — الحديدة',
        contactName: 'سالم الوصابي',
        phone: '733987654',
        currency: 'YER',
        paymentTermsDays: 45,
        balanceYer: 820000,
        leadTimeDays: 5,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'suppliers', sup3), {
        orgId: ORG_ID,
        name: 'مجموعة الخليج للمنظفات الصناعية',
        supplierType: 'international',
        country: 'السعودية — جدة',
        contactName: 'خالد السبيعي',
        phone: '+966501122334',
        currency: 'SAR',
        paymentTermsDays: 60,
        balanceYer: 3900000,
        leadTimeDays: 18,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'suppliers', sup4), {
        orgId: ORG_ID,
        name: 'الأناضول للبتروكيماويات والمنظفات',
        supplierType: 'international',
        country: 'تركيا — إسطنبول',
        contactName: 'طارق أرسلان',
        phone: '+905324455667',
        currency: 'USD',
        paymentTermsDays: 60,
        balanceYer: 0,
        leadTimeDays: 28,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const prd1 = 'prd_dish_lemon_1l';
      const prd2 = 'prd_pine_disinfect_3l';
      const prd3 = 'prd_laundry_auto_5kg';
      const prd4 = 'prd_bleach_4l';
      const prd5 = 'prd_glass_spray_750';
      const prd6 = 'prd_ind_degreaser_20l';

      batch1.set(doc(db, 'products', prd1), {
        orgId: ORG_ID,
        sku: 'CLN-DSH-100',
        name: 'سائل جلي مركز بالليمون (1 لتر)',
        category: 'dishwashing',
        baseUnitName: 'عبوة',
        packUnitName: 'كرتون',
        unitsPerPack: 12,
        volumeLitersPerUnit: 1,
        reorderPointUnits: 240,
        storageTempMin: 10,
        storageTempMax: 30,
        defaultSupplierId: sup1,
        lastPurchaseCostYer: 680,
        priceSupermarketYer: 950,
        priceWholesaleYer: 860,
        priceB2bYer: 820,
        taxable: true,
        rotationPolicy: 'FEFO',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'products', prd2), {
        orgId: ORG_ID,
        sku: 'CLN-DIS-300',
        name: 'مطهر ومعقم أرضيات صنوبر (3 لتر)',
        category: 'disinfectants',
        baseUnitName: 'جالون',
        packUnitName: 'كرتون',
        unitsPerPack: 4,
        volumeLitersPerUnit: 3,
        reorderPointUnits: 120,
        storageTempMin: 12,
        storageTempMax: 25,
        defaultSupplierId: sup3,
        lastPurchaseCostYer: 1650,
        priceSupermarketYer: 2300,
        priceWholesaleYer: 2100,
        priceB2bYer: 1980,
        taxable: true,
        rotationPolicy: 'FEFO',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'products', prd3), {
        orgId: ORG_ID,
        sku: 'CLN-LND-500',
        name: 'مسحوق غسيل أوتوماتيك عالي الرغوة (5 كجم)',
        category: 'laundry',
        baseUnitName: 'كيس',
        packUnitName: 'طرد',
        unitsPerPack: 4,
        volumeLitersPerUnit: 5,
        reorderPointUnits: 80,
        storageTempMin: 10,
        storageTempMax: 32,
        defaultSupplierId: sup3,
        lastPurchaseCostYer: 3800,
        priceSupermarketYer: 4950,
        priceWholesaleYer: 4600,
        priceB2bYer: 4400,
        taxable: true,
        rotationPolicy: 'FIFO',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'products', prd4), {
        orgId: ORG_ID,
        sku: 'CLN-BLC-400',
        name: 'كلور مبيض ومعقم مركز (4 لتر)',
        category: 'disinfectants',
        baseUnitName: 'جالون',
        packUnitName: 'كرتون',
        unitsPerPack: 4,
        volumeLitersPerUnit: 4,
        reorderPointUnits: 160,
        storageTempMin: 8,
        storageTempMax: 22,
        defaultSupplierId: sup2,
        lastPurchaseCostYer: 1120,
        priceSupermarketYer: 1600,
        priceWholesaleYer: 1450,
        priceB2bYer: 1380,
        taxable: true,
        rotationPolicy: 'FEFO',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'products', prd5), {
        orgId: ORG_ID,
        sku: 'CLN-GLS-075',
        name: 'ملمع زجاج وأسطح بخاخ (750 مل)',
        category: 'glass_surface',
        baseUnitName: 'بخاخ',
        packUnitName: 'كرتون',
        unitsPerPack: 24,
        volumeLitersPerUnit: 0.75,
        reorderPointUnits: 180,
        storageTempMin: 10,
        storageTempMax: 28,
        defaultSupplierId: sup1,
        lastPurchaseCostYer: 540,
        priceSupermarketYer: 820,
        priceWholesaleYer: 740,
        priceB2bYer: 710,
        taxable: true,
        rotationPolicy: 'FEFO',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'products', prd6), {
        orgId: ORG_ID,
        sku: 'CLN-IND-020',
        name: 'مزيل شحوم صناعي للمطابخ والفنادق (20 لتر)',
        category: 'industrial',
        baseUnitName: 'برميل',
        packUnitName: 'برميل',
        unitsPerPack: 1,
        volumeLitersPerUnit: 20,
        reorderPointUnits: 25,
        storageTempMin: 12,
        storageTempMax: 26,
        defaultSupplierId: sup4,
        lastPurchaseCostYer: 9800,
        priceSupermarketYer: 13500,
        priceWholesaleYer: 12800,
        priceB2bYer: 12200,
        taxable: true,
        rotationPolicy: 'FEFO',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const veh1 = 'veh_hino_01';
      const veh2 = 'veh_isuzu_02';
      const veh3 = 'veh_dyna_03';

      batch1.set(doc(db, 'vehicles', veh1), {
        orgId: ORG_ID,
        plateNumber: 'صنعاء 44192',
        modelName: 'هينو 300 صندوق مبرد',
        driverName: 'عبدالله الحيمي',
        capacityCartons: 320,
        currentRoute: 'خط السير الشمالي — صنعاء',
        status: 'on_route',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'vehicles', veh2), {
        orgId: ORG_ID,
        plateNumber: 'الحديدة 18304',
        modelName: 'إيسوزو NPR جامبو',
        driverName: 'منصور الزبيدي',
        capacityCartons: 450,
        currentRoute: 'خط السير الساحلي — الحديدة',
        status: 'ready',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'vehicles', veh3), {
        orgId: ORG_ID,
        plateNumber: 'تعز 77210',
        modelName: 'تويوتا داينا توزيع',
        driverName: 'ياسر الشرعبي',
        capacityCartons: 240,
        currentRoute: 'خط السير الجنوبي — تعز وعدن',
        status: 'on_route',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const rep1 = 'rep_faisal';
      const rep2 = 'rep_kareem';
      const rep3 = 'rep_nabil';

      batch1.set(doc(db, 'salesReps', rep1), {
        orgId: ORG_ID,
        name: 'فيصل الحمادي',
        phone: '771223344',
        routeName: 'خط السير الشمالي — صنعاء',
        commissionRatePct: 2.5,
        vehicleId: veh1,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'salesReps', rep2), {
        orgId: ORG_ID,
        name: 'كريم الأهدل',
        phone: '734556677',
        routeName: 'خط السير الساحلي — الحديدة',
        commissionRatePct: 2.0,
        vehicleId: veh2,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'salesReps', rep3), {
        orgId: ORG_ID,
        name: 'نبيل المعمري',
        phone: '711889900',
        routeName: 'خط السير الجنوبي — تعز وعدن',
        commissionRatePct: 3.0,
        vehicleId: veh3,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const cus1 = 'cus_alnoor_sm';
      const cus2 = 'cus_albaraka_sm';
      const cus3 = 'cus_tihama_ws';
      const cus4 = 'cus_alfajr_ws';
      const cus5 = 'cus_saba_hotel_b2b';
      const cus6 = 'cus_alsalam_hosp_b2b';

      batch1.set(doc(db, 'customers', cus1), {
        orgId: ORG_ID,
        name: 'هايبر النور للتسوق',
        sector: 'supermarket',
        routeName: 'خط السير الشمالي — صنعاء',
        assignedRepId: rep1,
        phone: '01-445210',
        cityDistrict: 'صنعاء — حدة',
        creditLimitYer: 3000000,
        balanceYer: 685400,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'customers', cus2), {
        orgId: ORG_ID,
        name: 'سوبرماركت البركة المركزي',
        sector: 'supermarket',
        routeName: 'خط السير الجنوبي — تعز وعدن',
        assignedRepId: rep3,
        phone: '04-228910',
        cityDistrict: 'تعز — جمال',
        creditLimitYer: 2000000,
        balanceYer: 0,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'customers', cus3), {
        orgId: ORG_ID,
        name: 'مؤسسة تهامة لتجارة الجملة',
        sector: 'wholesale',
        routeName: 'خط السير الساحلي — الحديدة',
        assignedRepId: rep2,
        phone: '03-219044',
        cityDistrict: 'الحديدة — شارع صنعاء',
        creditLimitYer: 8000000,
        balanceYer: 1945800,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'customers', cus4), {
        orgId: ORG_ID,
        name: 'مركز الفجر للجملة والتوزيع',
        sector: 'wholesale',
        routeName: 'خط السير الجنوبي — تعز وعدن',
        assignedRepId: rep3,
        phone: '02-358120',
        cityDistrict: 'عدن — المنصورة',
        creditLimitYer: 6500000,
        balanceYer: 920000,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'customers', cus5), {
        orgId: ORG_ID,
        name: 'فندق قصر سبأ السياحي',
        sector: 'b2b',
        routeName: 'خط السير الشمالي — صنعاء',
        assignedRepId: rep1,
        phone: '01-274000',
        cityDistrict: 'صنعاء — الستين',
        creditLimitYer: 5000000,
        balanceYer: 1122400,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1.set(doc(db, 'customers', cus6), {
        orgId: ORG_ID,
        name: 'مستشفى السلام التخصصي',
        sector: 'b2b',
        routeName: 'خط السير الشمالي — صنعاء',
        assignedRepId: rep1,
        phone: '01-510900',
        cityDistrict: 'صنعاء — الزبيري',
        creditLimitYer: 7000000,
        balanceYer: 0,
        active: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch1.commit();

      // Phase 2: Purchase Orders, Batches, Sales Orders, Payments
      const batch2 = writeBatch(db);

      const po1 = 'po_2026_101';
      const po2 = 'po_2026_102';
      const po3 = 'po_2026_103';

      batch2.set(doc(db, 'purchaseOrders', po1), {
        orgId: ORG_ID,
        poNumber: 'PO-2026-101',
        supplierId: sup1,
        supplierName: 'مصنع سبأ للمنظفات الحديثة',
        shipmentType: 'local',
        status: 'received',
        expectedDate: addDays(-20),
        goodsSubtotalYer: 1410000,
        freightCostYer: 40000,
        customsDutyYer: 0,
        totalLandedCostYer: 1450000,
        paidAmountYer: 0,
        items: [
          {
            productId: prd1,
            productName: 'سائل جلي مركز بالليمون (1 لتر)',
            sku: 'CLN-DSH-100',
            uom: 'pack',
            quantityEntered: 100,
            unitsPerPack: 12,
            totalBaseUnits: 1200,
            unitCostYer: 7920,
            lineTotalYer: 792000,
          },
          {
            productId: prd5,
            productName: 'ملمع زجاج وأسطح بخاخ (750 مل)',
            sku: 'CLN-GLS-075',
            uom: 'pack',
            quantityEntered: 50,
            unitsPerPack: 24,
            totalBaseUnits: 1200,
            unitCostYer: 12360,
            lineTotalYer: 618000,
          },
        ],
        notes: 'توريد محلي للمستودع الرئيسي',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch2.set(doc(db, 'purchaseOrders', po2), {
        orgId: ORG_ID,
        poNumber: 'PO-2026-102',
        supplierId: sup3,
        supplierName: 'مجموعة الخليج للمنظفات الصناعية',
        shipmentType: 'import',
        status: 'received',
        expectedDate: addDays(-10),
        goodsSubtotalYer: 3420000,
        freightCostYer: 260000,
        customsDutyYer: 220000,
        totalLandedCostYer: 3900000,
        paidAmountYer: 0,
        items: [
          {
            productId: prd2,
            productName: 'مطهر ومعقم أرضيات صنوبر (3 لتر)',
            sku: 'CLN-DIS-300',
            uom: 'pack',
            quantityEntered: 200,
            unitsPerPack: 4,
            totalBaseUnits: 800,
            unitCostYer: 5800,
            lineTotalYer: 1160000,
          },
          {
            productId: prd3,
            productName: 'مسحوق غسيل أوتوماتيك عالي الرغوة (5 كجم)',
            sku: 'CLN-LND-500',
            uom: 'pack',
            quantityEntered: 160,
            unitsPerPack: 4,
            totalBaseUnits: 640,
            unitCostYer: 14125,
            lineTotalYer: 2260000,
          },
        ],
        notes: 'شحنة استيراد عبر منفذ شحن — تم توزيع الجمارك والشحن على التكلفة',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch2.set(doc(db, 'purchaseOrders', po3), {
        orgId: ORG_ID,
        poNumber: 'PO-2026-103',
        supplierId: sup4,
        supplierName: 'الأناضول للبتروكيماويات والمنظفات',
        shipmentType: 'import',
        status: 'customs',
        expectedDate: addDays(6),
        goodsSubtotalYer: 1960000,
        freightCostYer: 290000,
        customsDutyYer: 195000,
        totalLandedCostYer: 2445000,
        paidAmountYer: 0,
        items: [
          {
            productId: prd6,
            productName: 'مزيل شحوم صناعي للمطابخ والفنادق (20 لتر)',
            sku: 'CLN-IND-020',
            uom: 'pack',
            quantityEntered: 250,
            unitsPerPack: 1,
            totalBaseUnits: 250,
            unitCostYer: 7840,
            lineTotalYer: 1960000,
          },
        ],
        notes: 'الحاوية في التخليص الجمركي — ميناء الحديدة',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Batches (including near-expiry FEFO batch and low-stock alert on prd6!)
      const bat1 = 'bat_dish_old';
      const bat2 = 'bat_dish_new';
      const bat3 = 'bat_pine_01';
      const bat4 = 'bat_laundry_01';
      const bat5 = 'bat_bleach_01';
      const bat6 = 'bat_glass_01';
      const bat7 = 'bat_ind_low';

      batch2.set(doc(db, 'batches', bat1), {
        orgId: ORG_ID,
        productId: prd1,
        productName: 'سائل جلي مركز بالليمون (1 لتر)',
        sku: 'CLN-DSH-100',
        batchNumber: 'LOT-DSH-2501',
        warehouseZone: 'مخزن أ — رف 1',
        recordedTempC: 21,
        mfgDate: addDays(-330),
        expiryDate: addDays(28),
        initialUnits: 600,
        remainingUnits: 144,
        landedUnitCostYer: 660,
        poId: po1,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'batches', bat2), {
        orgId: ORG_ID,
        productId: prd1,
        productName: 'سائل جلي مركز بالليمون (1 لتر)',
        sku: 'CLN-DSH-100',
        batchNumber: 'LOT-DSH-2604',
        warehouseZone: 'مخزن أ — رف 2',
        recordedTempC: 20,
        mfgDate: addDays(-25),
        expiryDate: addDays(340),
        initialUnits: 1200,
        remainingUnits: 960,
        landedUnitCostYer: 680,
        poId: po1,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'batches', bat3), {
        orgId: ORG_ID,
        productId: prd2,
        productName: 'مطهر ومعقم أرضيات صنوبر (3 لتر)',
        sku: 'CLN-DIS-300',
        batchNumber: 'LOT-PIN-2602',
        warehouseZone: 'مخزن مبرد — قطاع ب',
        recordedTempC: 19,
        mfgDate: addDays(-45),
        expiryDate: addDays(320),
        initialUnits: 800,
        remainingUnits: 640,
        landedUnitCostYer: 1650,
        poId: po2,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'batches', bat4), {
        orgId: ORG_ID,
        productId: prd3,
        productName: 'مسحوق غسيل أوتوماتيك عالي الرغوة (5 كجم)',
        sku: 'CLN-LND-500',
        batchNumber: 'LOT-LND-2603',
        warehouseZone: 'مخزن جاف — قطاع ج',
        recordedTempC: 23,
        mfgDate: addDays(-30),
        expiryDate: addDays(510),
        initialUnits: 640,
        remainingUnits: 520,
        landedUnitCostYer: 3800,
        poId: po2,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'batches', bat5), {
        orgId: ORG_ID,
        productId: prd4,
        productName: 'كلور مبيض ومعقم مركز (4 لتر)',
        sku: 'CLN-BLC-400',
        batchNumber: 'LOT-BLC-2511',
        warehouseZone: 'مخزن أ — منطقة الكلور',
        recordedTempC: 24, // Above 22°C max threshold -> triggers storage temp alert!
        mfgDate: addDays(-190),
        expiryDate: addDays(38), // Near expiry alert too!
        initialUnits: 400,
        remainingUnits: 192,
        landedUnitCostYer: 1120,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'batches', bat6), {
        orgId: ORG_ID,
        productId: prd5,
        productName: 'ملمع زجاج وأسطح بخاخ (750 مل)',
        sku: 'CLN-GLS-075',
        batchNumber: 'LOT-GLS-2601',
        warehouseZone: 'مخزن أ — رف 4',
        recordedTempC: 21,
        mfgDate: addDays(-20),
        expiryDate: addDays(420),
        initialUnits: 1200,
        remainingUnits: 1008,
        landedUnitCostYer: 540,
        poId: po1,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'batches', bat7), {
        orgId: ORG_ID,
        productId: prd6,
        productName: 'مزيل شحوم صناعي للمطابخ والفنادق (20 لتر)',
        sku: 'CLN-IND-020',
        batchNumber: 'LOT-IND-2509',
        warehouseZone: 'مخزن B2B — قطاع د',
        recordedTempC: 20,
        mfgDate: addDays(-120),
        expiryDate: addDays(245),
        initialUnits: 80,
        remainingUnits: 18, // Below reorderPointUnits (25) -> triggers Reorder alert!
        landedUnitCostYer: 9800,
        status: 'active',
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Sales Orders across all 3 sectors
      const inv1 = 'inv_2026_1001';
      const inv2 = 'inv_2026_1002';
      const inv3 = 'inv_2026_1003';
      const inv4 = 'inv_2026_1004';

      batch2.set(doc(db, 'salesOrders', inv1), {
        orgId: ORG_ID,
        invoiceNumber: 'INV-2026-1001',
        customerId: cus1,
        customerName: 'هايبر النور للتسوق',
        sector: 'supermarket',
        repId: rep1,
        repName: 'فيصل الحمادي',
        vehicleId: veh1,
        routeName: 'خط السير الشمالي — صنعاء',
        paymentMethod: 'credit',
        deliveryStatus: 'delivered',
        subtotalYer: 596000,
        taxRatePct: 15,
        taxAmountYer: 89400,
        totalYer: 685400,
        cogsYer: 416640,
        grossProfitYer: 179360,
        paidAmountYer: 0,
        items: [
          {
            productId: prd1,
            productName: 'سائل جلي مركز بالليمون (1 لتر)',
            sku: 'CLN-DSH-100',
            uom: 'pack',
            quantityEntered: 24,
            unitsPerPack: 12,
            totalBaseUnits: 288,
            unitPriceYer: 11400,
            lineSubtotalYer: 273600,
            lineCogsYer: 190080,
            lineProfitYer: 83520,
            allocations: [
              {
                batchId: bat1,
                batchNumber: 'LOT-DSH-2501',
                unitsTaken: 288,
                landedUnitCostYer: 660,
                expiryDate: addDays(28),
              },
            ],
          },
          {
            productId: prd2,
            productName: 'مطهر ومعقم أرضيات صنوبر (3 لتر)',
            sku: 'CLN-DIS-300',
            uom: 'pack',
            quantityEntered: 35,
            unitsPerPack: 4,
            totalBaseUnits: 140,
            unitPriceYer: 9200,
            lineSubtotalYer: 322400,
            lineCogsYer: 226560,
            lineProfitYer: 95840,
            allocations: [
              {
                batchId: bat3,
                batchNumber: 'LOT-PIN-2602',
                unitsTaken: 140,
                landedUnitCostYer: 1650,
                expiryDate: addDays(320),
              },
            ],
          },
        ],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch2.set(doc(db, 'salesOrders', inv2), {
        orgId: ORG_ID,
        invoiceNumber: 'INV-2026-1002',
        customerId: cus3,
        customerName: 'مؤسسة تهامة لتجارة الجملة',
        sector: 'wholesale',
        repId: rep2,
        repName: 'كريم الأهدل',
        vehicleId: veh2,
        routeName: 'خط السير الساحلي — الحديدة',
        paymentMethod: 'credit',
        deliveryStatus: 'dispatched',
        subtotalYer: 1692000,
        taxRatePct: 15,
        taxAmountYer: 253800,
        totalYer: 1945800,
        cogsYer: 1368000,
        grossProfitYer: 324000,
        paidAmountYer: 0,
        items: [
          {
            productId: prd3,
            productName: 'مسحوق غسيل أوتوماتيك عالي الرغوة (5 كجم)',
            sku: 'CLN-LND-500',
            uom: 'pack',
            quantityEntered: 30,
            unitsPerPack: 4,
            totalBaseUnits: 120,
            unitPriceYer: 18400,
            lineSubtotalYer: 552000,
            lineCogsYer: 456000,
            lineProfitYer: 96000,
            allocations: [
              {
                batchId: bat4,
                batchNumber: 'LOT-LND-2603',
                unitsTaken: 120,
                landedUnitCostYer: 3800,
                expiryDate: addDays(510),
              },
            ],
          },
          {
            productId: prd4,
            productName: 'كلور مبيض ومعقم مركز (4 لتر)',
            sku: 'CLN-BLC-400',
            uom: 'pack',
            quantityEntered: 196,
            unitsPerPack: 4,
            totalBaseUnits: 786,
            unitPriceYer: 5800,
            lineSubtotalYer: 1140000,
            lineCogsYer: 912000,
            lineProfitYer: 228000,
            allocations: [
              {
                batchId: bat5,
                batchNumber: 'LOT-BLC-2511',
                unitsTaken: 208,
                landedUnitCostYer: 1120,
                expiryDate: addDays(38),
              },
            ],
          },
        ],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch2.set(doc(db, 'salesOrders', inv3), {
        orgId: ORG_ID,
        invoiceNumber: 'INV-2026-1003',
        customerId: cus5,
        customerName: 'فندق قصر سبأ السياحي',
        sector: 'b2b',
        repId: rep1,
        repName: 'فيصل الحمادي',
        vehicleId: veh1,
        routeName: 'خط السير الشمالي — صنعاء',
        paymentMethod: 'credit',
        deliveryStatus: 'delivered',
        subtotalYer: 976000,
        taxRatePct: 15,
        taxAmountYer: 146400,
        totalYer: 1122400,
        cogsYer: 784000,
        grossProfitYer: 192000,
        paidAmountYer: 0,
        items: [
          {
            productId: prd6,
            productName: 'مزيل شحوم صناعي للمطابخ والفنادق (20 لتر)',
            sku: 'CLN-IND-020',
            uom: 'pack',
            quantityEntered: 80,
            unitsPerPack: 1,
            totalBaseUnits: 80,
            unitPriceYer: 12200,
            lineSubtotalYer: 976000,
            lineCogsYer: 784000,
            lineProfitYer: 192000,
            allocations: [
              {
                batchId: bat7,
                batchNumber: 'LOT-IND-2509',
                unitsTaken: 80,
                landedUnitCostYer: 9800,
                expiryDate: addDays(245),
              },
            ],
          },
        ],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch2.set(doc(db, 'salesOrders', inv4), {
        orgId: ORG_ID,
        invoiceNumber: 'INV-2026-1004',
        customerId: cus2,
        customerName: 'سوبرماركت البركة المركزي',
        sector: 'supermarket',
        repId: rep3,
        repName: 'نبيل المعمري',
        vehicleId: veh3,
        routeName: 'خط السير الجنوبي — تعز وعدن',
        paymentMethod: 'cash',
        deliveryStatus: 'pending',
        subtotalYer: 157440,
        taxRatePct: 15,
        taxAmountYer: 23616,
        totalYer: 181056,
        cogsYer: 103680,
        grossProfitYer: 53760,
        paidAmountYer: 181056,
        items: [
          {
            productId: prd5,
            productName: 'ملمع زجاج وأسطح بخاخ (750 مل)',
            sku: 'CLN-GLS-075',
            uom: 'pack',
            quantityEntered: 8,
            unitsPerPack: 24,
            totalBaseUnits: 192,
            unitPriceYer: 19680,
            lineSubtotalYer: 157440,
            lineCogsYer: 103680,
            lineProfitYer: 53760,
            allocations: [
              {
                batchId: bat6,
                batchNumber: 'LOT-GLS-2601',
                unitsTaken: 192,
                landedUnitCostYer: 540,
                expiryDate: addDays(420),
              },
            ],
          },
        ],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch2.set(doc(db, 'payments', 'pay_seed_1'), {
        orgId: ORG_ID,
        voucherNumber: 'RCV-2026-001',
        paymentType: 'customer_receipt',
        partyId: cus2,
        partyName: 'سوبرماركت البركة المركزي',
        referenceDocId: inv4,
        amountYer: 181056,
        method: 'field_collection',
        notes: 'تحصيل نقدي فوري عبر مندوب خط تعز',
        createdBy: uid,
        createdAt: serverTimestamp(),
      });

      await batch2.commit();
      notify('تم تهيئة بيانات الشركة التشغيلية بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seedOperationalData');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ErpContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authLoading,
        dataLoading,
        authError,
        authNeedsConsoleSetup,
        signInWithGoogle,
        loginWithCredentials,
        registerWithCredentials,
        clearAuthError,
        signOutUser,
        canEdit,
        suppliers,
        products,
        purchaseOrders,
        batches,
        stockCounts,
        customers,
        salesReps,
        vehicles,
        salesOrders,
        payments,
        usersList,
        toasts,
        notify,
        dismissToast,
        seedOperationalData,
        seeding,
        createSupplier,
        createProduct,
        updateProduct,
        createPurchaseOrder,
        advancePurchaseOrderStatus,
        receivePurchaseOrder,
        recordStockCount,
        updateBatchStorage,
        createCustomer,
        createSalesRep,
        createVehicle,
        updateVehicleStatus,
        createSalesOrder,
        updateSalesOrderDelivery,
        recordPayment,
        updateUserRole,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp must be used inside ErpProvider');
  return ctx;
}
