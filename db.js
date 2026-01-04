// db.js
(function() {
  let SUPABASE_URL = localStorage.getItem('MY_PRIVATE_URL');
  let SUPABASE_KEY = localStorage.getItem('MY_PRIVATE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const url = prompt("Setup: Paste your Supabase URL");
    const key = prompt("Setup: Paste your Supabase Anon Key");
    if (url && key) {
      localStorage.setItem('MY_PRIVATE_URL', url.replace(/\/$/, "")); // Remove trailing slash
      localStorage.setItem('MY_PRIVATE_KEY', key);
      location.reload();
    }
    return;
  }

  // FIXED API BRIDGE
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

      // Handle "No Content" (Status 204) - Fixes your JSON.parse error
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
        // IMPORTANT: We use barcode column as the key, but it now contains "Model-Suffix"
        data.forEach(p => { 
          const id = p.suffix ? `${p.modelNumber}-${p.suffix}` : p.modelNumber;
          obj[id || p.barcode] = p; 
        });
      }
      return obj;
    },

    // 'id' here is the Model-Suffix generated in Part 1
    putProduct: async (id, product) => {
      return api('products', 'POST', { barcode: id, ...product }, true);
    },

    bulkPutProducts: async (productObj) => {
      const list = Object.keys(productObj).map(id => ({
        barcode: id, // Mapping the unique Model-Suffix ID to the barcode column
        ...productObj[id]
      }));
      return api('products', 'POST', list, true);
    },

    // Inside your db.js
    addTransaction: async (tx) => {
      return api('transactions', 'POST', {
        // Left side: Database Column Name | Right side: Variable from your tx object
        barcode: tx.productId,
        stock_change: tx.stockChange,
        reason: tx.reason,
        ref: tx.ref || tx.poNumber || "",
        created_at: tx.when || new Date().toISOString(),

        // These MUST match the names in your Supabase screenshot (image_5d90fe.png)
        displayName: tx.displayName || "",
        stockAfter: Number(tx.stockAfter) || 0,
        project: tx.project || "",
        projectAction: tx.projectAction || "",
        poNumber: tx.poNumber || ""
      });
    },

    getRecentTransactions: async (limit = 1000) => {
      return api(`transactions?select=*&order=created_at.desc&limit=${limit}`);
    },

    // Crucial for the "Rename" logic to work without leaving orphans
    deleteProductByModel: async (modelNum) => {
      // This targets the 'modelNumber' column specifically
      const url = `products?modelNumber=eq.${encodeURIComponent(modelNum)}`;
      return api(url, 'DELETE');
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
    },
    
  };
})();