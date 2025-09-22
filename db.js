// db.js — IndexedDB-backed persistence for Inventory Management
// Exposes global InventoryDB with async methods:
//   • init() -> Promise
//   • getAllProducts() -> Promise (Array of products)
//   • exportProductsObject() -> Promise (plain object)
//   • bulkPutProducts(productsObj) -> Promise
//   • putProduct(barcode, product) -> Promise
//   • deleteProduct(barcode) -> Promise
//   • addTransaction(txObj) -> Promise
//   • getRecentTransactions(limit) -> Promise (Array)
//   • clearTransactions() -> Promise


(function(){
  const DB_NAME = 'inventory-db';
  const DB_VERSION = 1;
  const STORE_PRODUCTS = 'products';
  const STORE_TRANSACTIONS = 'transactions';

  let _db = null;

  function openDB(){
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PRODUCTS)){
          db.createObjectStore(STORE_PRODUCTS, { keyPath: 'barcode' });
        }
        if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)){
          db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => {
        _db = req.result;
        resolve(_db);
      };
      req.onerror = () => reject(req.error || new Error('Failed to open DB'));
    });
  }

  function _txn(storeName, mode = 'readonly'){
    return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
  }

  async function getAllProducts(){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async function exportProductsObject(){
    const arr = await getAllProducts();
    const obj = {};
    arr.forEach(p => {
      const { barcode, ...rest } = p;
      obj[barcode] = rest;
    });
    return obj;
  }

  async function bulkPutProducts(productsObj){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE_PRODUCTS], 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      // Option: clear first then add
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        try {
          for (const barcode of Object.keys(productsObj)){
            const payload = Object.assign({ barcode }, productsObj[barcode]);
            store.put(payload);
          }
        } catch (e) {
          rej(e);
        }
      };
      clearReq.onerror = () => rej(clearReq.error);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function putProduct(barcode, product){
    const db = await openDB();
    const payload = Object.assign({ barcode }, product);
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE_PRODUCTS], 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      const req = store.put(payload);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async function deleteProduct(barcode){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE_PRODUCTS], 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      const req = store.delete(barcode);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async function addTransaction(txObj){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE_TRANSACTIONS], 'readwrite');
      const store = tx.objectStore(STORE_TRANSACTIONS);
      const req = store.add(txObj);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async function getRecentTransactions(limit = 200){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
      const store = tx.objectStore(STORE_TRANSACTIONS);
      const req = store.openCursor(null, 'prev'); // newest first
      const out = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && out.length < limit) {
          out.push(cursor.value);
          cursor.continue();
        } else {
          res(out);
        }
      };
      req.onerror = () => rej(req.error);
    });
  }

  async function clearTransactions(){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE_TRANSACTIONS], 'readwrite');
      const store = tx.objectStore(STORE_TRANSACTIONS);
      const req = store.clear();
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  // Migration helper: copy from localStorage keys (if provided) into IDB.
  async function migrateFromLocalStorage(lsProductsKey, lsTxKey){
    if (!lsProductsKey) throw new Error('lsProductsKey required');
    const raw = localStorage.getItem(lsProductsKey);
    if (!raw) return { importedProducts:0, importedTransactions:0 };
    let products = {};
    try { products = JSON.parse(raw); } catch(e) { throw new Error('Failed to parse local products JSON'); }
    await bulkPutProducts(products);

    let txsCount = 0;
    if (lsTxKey) {
      const r = localStorage.getItem(lsTxKey);
      if (r) {
        try {
          const txs = JSON.parse(r);
          if (Array.isArray(txs)){
            for (const t of txs.slice().reverse()) { // oldest first
              await addTransaction(t);
              txsCount++;
            }
          }
        } catch(e) { /* ignore tx import errors */ }
      }
    }
    return { importedProducts: Object.keys(products).length, importedTransactions: txsCount };
  }

  // Expose global API
  window.InventoryDB = {
    init: openDB,
    getAllProducts,
    exportProductsObject,
    bulkPutProducts,
    putProduct,
    deleteProduct,
    addTransaction,
    getRecentTransactions,
    clearTransactions,
    migrateFromLocalStorage
  };
})();
