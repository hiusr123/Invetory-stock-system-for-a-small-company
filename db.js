// db.js
(function() {
  let SUPABASE_URL = localStorage.getItem('MY_PRIVATE_URL');
  let SUPABASE_KEY = localStorage.getItem('MY_PRIVATE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const url = prompt("Setup: Paste your Supabase URL");
    const key = prompt("Setup: Paste your Supabase Anon Key");
    if (url && key) {
      localStorage.setItem('MY_PRIVATE_URL', url.replace(/\/$/, "")); 
      localStorage.setItem('MY_PRIVATE_KEY', key);
      location.reload();
    }
    return;
  }

  async function api(endpoint, method = 'GET', body = null, isUpsert = false) {
    const options = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': isUpsert ? 'resolution=merge-duplicates' : 'return=minimal'
      }
    };
    
    if (body) options.body = JSON.stringify(body);
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);

      if (res.status === 204 || res.statusText === 'No Content') {
        return { success: true };
      }

      const text = await res.text();
      const data = text ? JSON.parse(text) : { success: true };

      if (!res.ok) {
        console.error("Supabase Error:", data);
        return data;
      }
      return data;
    } catch (err) {
      console.error("Connection Error:", err);
      return { error: true, message: err.message };
    }
  }

  window.InventoryDB = {
    init: async () => true,
    
    exportProductsObject: async () => {
      const data = await api('products?select=*');
      const obj = {};
      if (Array.isArray(data)) {
        data.forEach(p => { obj[p.barcode] = p; });
      }
      return obj;
    },

    putProduct: async (barcode, product) => {
      return api('products', 'POST', { barcode, ...product }, true);
    },

    bulkPutProducts: async (productObj) => {
      const list = Object.keys(productObj).map(id => ({
        barcode: id,
        ...productObj[id]
      }));
      return api('products', 'POST', list, true);
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

    saveAllProjects: async (projectsObj) => {
      return api('settings', 'POST', { 
        key: 'project_allocations', 
        value: projectsObj 
      }, true); 
    },

    loadAllProjects: async () => {
      const res = await api('settings?key=eq.project_allocations&select=value');
      return (Array.isArray(res) && res[0]) ? res[0].value : {};
    },

    saveCategories: async (catArray) => {
      return api('settings', 'POST', { 
        key: 'categories', 
        value: catArray 
      }, true);
    },

    loadCategories: async () => {
      const res = await api('settings?key=eq.categories&select=value');
      return (Array.isArray(res) && res[0]) ? res[0].value : ['Default'];
    },

    resetKeys: () => {
      localStorage.clear();
      location.reload();
    }
  };
})();

