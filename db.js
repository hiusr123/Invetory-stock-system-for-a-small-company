// db.js
(function() {
  // Use "const" so these can't be changed easily in the console
  const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
  const SUPABASE_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';
  const SECRET_ACCESS_KEY = 'choose_your_secret_password'; // e.g., 'my-storage-789'

  // SECRET URL LOGIC
  const urlParams = new URLSearchParams(window.location.search);
  const userKey = urlParams.get('access');

  if (userKey !== SECRET_ACCESS_KEY) {
    console.error("Access Denied");
    document.body.innerHTML = "<div style='text-align:center; margin-top:100px;'><h1>404 Not Found</h1></div>";
    return;
  }

  // Define the API bridge
  async function api(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    return res.json();
  }

  window.InventoryDB = {
    init: async () => true,
    
    // Returns products as a local object { "BARCODE": {data} }
    exportProductsObject: async () => {
      const data = await api('products?select=*');
      const obj = {};
      // Ensure data is an array before looping
      if (Array.isArray(data)) {
        data.forEach(p => { obj[p.barcode] = p; });
      }
      return obj;
    },

    // Upserts a single product
    putProduct: async (barcode, product) => {
      return api('products', 'POST', { barcode, ...product });
    },

    // Upserts multiple products at once (Used for Restore/Bulk operations)
    bulkPutProducts: async (productObj) => {
      const list = Object.keys(productObj).map(id => ({
        barcode: id,
        ...productObj[id]
      }));
      return api('products', 'POST', list);
    },

    addTransaction: async (tx) => {
      return api('transactions', 'POST', {
        barcode: tx.productId,
        stock_change: tx.stockChange,
        reason: tx.reason,
        ref: tx.ref || tx.poNumber,
        created_at: tx.when || new Date().toISOString()
      });
    },

    getRecentTransactions: async (limit = 1000) => {
      return api(`transactions?select=*&order=created_at.desc&limit=${limit}`);
    },

    deleteProduct: async (barcode) => {
      return api(`products?barcode=eq.${barcode}`, 'DELETE');
    },

    // --- Project Allocations ---
    // Note: We use the 'key' as a unique identifier in the settings table
    saveAllProjects: async (projectsObj) => {
      return api('settings', 'POST', { 
        key: 'project_allocations', 
        value: projectsObj 
      });
    },

    loadAllProjects: async () => {
      const res = await api('settings?key=eq.project_allocations&select=value');
      return res[0]?.value || {};
    },

    // --- Categories ---
    saveCategories: async (catArray) => {
      return api('settings', 'POST', { 
        key: 'categories', 
        value: catArray 
      });
    },

    loadCategories: async () => {
      const res = await api('settings?key=eq.categories&select=value');
      return res[0]?.value || ['Default'];
    }
  };
})();
