  // ============ Data Stores (Cloud Synced) ============
  let productDatabase = {};
  let transactions = [];
  let projectAllocations = {}; 
  let categories = ['Default'];
  let bulkInHasUnsavedChanges = false;
  let bulkOutHasUnsavedChanges = false;
  let productModalHasUnsavedChanges = false;

  // NEW: Cloud Startup Function
  async function syncFromCloud() {
    try {
      showStatus("Full Cloud Sync...");
      
      // 1. Fetch Products
      productDatabase = await InventoryDB.exportProductsObject();
      
      // 2. Fetch Transactions
      const raw = await InventoryDB.getRecentTransactions(1000);
      transactions = raw.map(t => ({
        productId: t.barcode,
        stockChange: t.stock_change,
        reason: t.reason,
        when: t.created_at,
        ref: t.ref
      }));

      // 3. FETCH CATEGORIES FROM CLOUD (Instead of localStorage)
      categories = await InventoryDB.loadCategories();

      // 4. FETCH PROJECT ALLOCATIONS FROM CLOUD (Instead of localStorage)
      projectAllocations = await InventoryDB.loadAllProjects();

      init(); 
      showStatus("Cloud Fully Synced!");
    } catch (e) {
      showStatus("Sync Error", false);
      console.error(e);
    }
  }

    // ============ Helpers ============
    function showStatus(msg, ok=true){
      const el = document.getElementById('status-toast');
      el.style.display='block';
      el.style.borderLeftColor = ok ? 'var(--ok)' : 'var(--danger)';
      el.textContent = msg;
      setTimeout(()=>{ el.style.display='none'; }, 1800);
    }
    function fmt(n){ return Number(n||0).toLocaleString(); }
    function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
    function escapeForJs(s=''){ return s.replace(/['"\\]/g, m=>({"'":"\\'","\"":"\\\"","\\":"\\\\"}[m])); }

    function getProductId(p){
      const model = (p.modelNumber||'').trim();
      const suffix = (p.suffix||'').trim();
      return suffix ? `${model}-${suffix}` : model;
    }
    function getProductDisplayName(p){
      const model = p?.modelNumber || 'Unknown';
      const suffix = p?.suffix ? `-${p.suffix}` : '';
      return model + suffix;
    }

    function getAllProjects(){
      const set = new Set();
      for(const pid in projectAllocations){
        const obj = projectAllocations[pid];
        for(const proj in obj){ set.add(proj); }
      }
      return Array.from(set).sort();
    }

    function getTotalProjectQuantity(productId){
      const map = projectAllocations[productId]||{}; let sum=0; for(const k in map) sum += Number(map[k]||0); return sum;
    }
    function getPhysicalStock(productId){
      const p = productDatabase[productId]||{}; return Number(p.currentQuantity||0) + getTotalProjectQuantity(productId);
    }

    function updateCategoryOptions(){
      // stock tab
      const sel = document.getElementById('filter-category');
      sel.innerHTML = '<option value="">All</option>' + categories.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
      // total stock modal
      const sel2 = document.getElementById('total-filter-category');
      sel2.innerHTML = '<option value="">All Categories</option>' + categories.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
      // datalist for product form
      const dl = document.getElementById('datalist-categories');
      dl.innerHTML = categories.map(c=>`<option value="${escapeHtml(c)}"></option>`).join('');
      // admin list
      renderCategoriesList();
    }

    // ============ Tabs ============
    function switchTab(name){
      document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
      document.getElementById('tab-stock').style.display = name==='stock'? 'block':'none';
      document.getElementById('tab-projects').style.display = name==='projects'? 'block':'none';
      document.getElementById('tab-transactions').style.display = name==='transactions'? 'block':'none';
      if(name==='stock') updateAllProductsView(false);
      if(name==='projects') renderProjectsTab();
      if(name==='transactions') updateTransactionHistory();
    }

    // ============ Stock Tab (All Products) ============
    function updateAllProductsView(resetPage=true, goTo=1){
      const container = document.getElementById('products-list');
      const q = (document.getElementById('filter-search').value||'').toLowerCase();
      const cat = document.getElementById('filter-category').value||'';
      const keys = Object.keys(productDatabase).sort();
      let filtered = keys.filter(k=>{
        const p = productDatabase[k];
        if(!p) return false;
        if(cat && p.category!==cat) return false;
        const text = `${p.modelNumber||''} ${p.barcode||''}`.toLowerCase();
        if(q && !text.includes(q)) return false;
        return true;
      });

      if(filtered.length===0){ container.innerHTML = '<div class="small">No products found.</div>'; return; }

      const PAGE = 50;
      const total = filtered.length; const pages = Math.max(1, Math.ceil(total/PAGE));
      let page = Number(container.dataset.page||1);
      if(resetPage) page = goTo;
      page = Math.max(1, Math.min(page, pages));
      container.dataset.page = page;
      const start = (page-1)*PAGE; const slice = filtered.slice(start, start+PAGE);

      let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="small">Showing ${start+1}-${start+slice.length} of ${total}</div>
          <div class="row" style="gap:6px">
            <span class="pill">Page ${page}/${pages}</span>
            <button class="btn" onclick="updateAllProductsView(false,1)">First</button>
            <button class="btn" onclick="updateAllProductsView(false,${page-1})">Prev</button>
            <button class="btn" onclick="updateAllProductsView(false,${page+1})">Next</button>
            <button class="btn" onclick="updateAllProductsView(false,${pages})">Last</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Model</th><th>Barcode</th><th>Category</th><th>Location</th>
              <th>In Stock</th><th>Reserved For Projects</th><th>Total Physical Stock</th>
              <th style="width:180px">Actions</th>
            </tr>
          </thead>
          <tbody>`;

      slice.forEach(id=>{
        const p = productDatabase[id];
        const stock = Number(p.currentQuantity||0);
        const reserved = getTotalProjectQuantity(id);
        const totalPhys = getPhysicalStock(id);
        html += `
        <tr>
          <td>${escapeHtml(getProductDisplayName(p))}</td>
          <td>${escapeHtml(p.barcode||'')}</td>
          <td>${escapeHtml(p.category||'')}</td>
          <td>${escapeHtml(p.location||'')}</td>
          <td>${fmt(stock)}</td>
          <td>${fmt(reserved)}</td>
          <td><b>${fmt(totalPhys)}</b></td>
          <td>
            <button class="btn" onclick="editProduct('${escapeForJs(id)}')">Edit</button>
            <button class="btn" onclick="prepProjectFromRow('${escapeForJs(id)}')">Project…</button>
          </td>
        </tr>`;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function exportProductsCSV(){
      const keys = Object.keys(productDatabase).sort();
      const header = 'productId,modelNumber,suffix,category,location,barcode,stock,reserved,totalPhysical,description';
      const rows = keys.map(id=>{
        const p = productDatabase[id];
        const stock = Number(p.currentQuantity||0);
        const reserved = getTotalProjectQuantity(id);
        const total = stock + reserved;
        const csv = [id,p.modelNumber||'',p.suffix||'',p.category||'',p.location||'',p.barcode||'',stock,reserved,total,(p.description||'')]
          .map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',');
        return csv;
      });
      downloadCSV('products.csv', [header].concat(rows).join('\n'));
    }

    // ============ Add/Edit Product Modal ============
    let editingProductId = null;
    function showAddProduct(){
      editingProductId = null;
      document.getElementById('product-modal-title').textContent='Add Product';
      document.getElementById('p-model').value='';
      document.getElementById('p-suffix').value='';
      document.getElementById('p-category').value='';
      document.getElementById('p-qty').value='0';
      document.getElementById('p-location').value='';
      document.getElementById('p-barcode').value='';
      document.getElementById('p-desc').value='';
      document.getElementById('product-modal').style.display='flex';
      document.body.style.overflow='hidden';
      productModalHasUnsavedChanges = false;
      addProductFormChangeListeners()
    }
    function hideAddProduct(){
      if (productModalHasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
          return;
        }
      }
      document.getElementById('product-modal').style.display='none';
      document.body.style.overflow='auto';
      removeProductFormChangeListeners();
    }

    function editProduct(id){
      const p = productDatabase[id]; if(!p) return;
      editingProductId = id;
      document.getElementById('product-modal-title').textContent='Edit Product';
      document.getElementById('p-model').value=p.modelNumber||'';
      document.getElementById('p-suffix').value=p.suffix||'';
      document.getElementById('p-category').value=p.category||'';
      document.getElementById('p-qty').value=p.currentQuantity||0;
      document.getElementById('p-location').value=p.location||'';
      document.getElementById('p-barcode').value=p.barcode||'';
      document.getElementById('p-desc').value=p.description||'';
      document.getElementById('product-modal').style.display='flex';
      document.body.style.overflow='hidden';
      productModalHasUnsavedChanges = false;
      addProductFormChangeListeners();
    }

    async function saveProduct() {
      const p = {
        modelNumber: document.getElementById('p-model').value.trim(),
        suffix: document.getElementById('p-suffix').value.trim(),
        category: document.getElementById('p-category').value.trim(),
        currentQuantity: Number(document.getElementById('p-qty').value) || 0,
        location: document.getElementById('p-location').value.trim(),
        barcode: document.getElementById('p-barcode').value.trim(),
        description: document.getElementById('p-desc').value.trim()
      };

      const id = getProductId(p);
      if (!p.modelNumber) {
        showStatus('Model number is required.', false);
        return;
      }

      showStatus("Syncing to Cloud...");

      try {
        if (editingProductId && editingProductId !== id) {
          // SCENARIO: Product ID changed (Rename)
          await InventoryDB.deleteProduct(editingProductId);
          
          // Move project data to the new ID if it exists
          if (projectAllocations[editingProductId]) {
            projectAllocations[id] = projectAllocations[editingProductId];
            delete projectAllocations[editingProductId];
            await InventoryDB.saveAllProjects(projectAllocations);
          }
          
          delete productDatabase[editingProductId];
        }

        // Single source of truth update
        productDatabase[id] = p;
        await InventoryDB.putProduct(id, p);

        updateCategoryOptions();
        updateAllProductsView();
        renderProjectsTab();

        showStatus('Saved to Cloud successfully!');
        document.getElementById('product-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        productModalHasUnsavedChanges = false;

      } catch (error) {
        console.error("Cloud Save Error:", error);
        showStatus('Error: Could not save to Cloud.', false);
      }
    }

    async function deleteProduct() {
      if (!editingProductId) return;
      if (!confirm(`Are you sure you want to delete ${editingProductId}?`)) return;

      showStatus("Deleting from Cloud...");

      try {
        // 1. Delete from Cloud
        await InventoryDB.deleteProduct(editingProductId);

        // 2. Remove from local memory
        delete productDatabase[editingProductId];
        
        // 3. Clean up projects if any
        if(projectAllocations[editingProductId]) {
          delete projectAllocations[editingProductId];
          await InventoryDB.saveAllProjects(projectAllocations);
        }

        updateAllProductsView();
        renderProjectsTab();
        
        document.getElementById('product-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        editingProductId = null;
        productModalHasUnsavedChanges = false;
        
        showStatus('Product deleted from Cloud.');
      } catch (err) {
        showStatus("Cloud Error: Could not delete product.", false);
      }
    }

    // ============ Projects Tab Actions ============
    function renderProjectsTab(){
      updateProjectAction();
      const container = document.getElementById('project-products-list');
      const keys = Object.keys(productDatabase).sort();

      const q = (document.getElementById('project-filter-search').value || '').toLowerCase();

      let filtered = keys.filter(id => {
        const p = productDatabase[id];
        if(!p) return false;
        const text = `${p.modelNumber||''} ${p.barcode||''}`.toLowerCase();
        if(q && !text.includes(q)) return false;
        return true;
      });

      if(filtered.length===0){ 
        container.innerHTML = '<div class="small">No products found.</div>'; 
        return; 
      }

      let html = '<table><thead><tr><th>Model</th><th>In Stock</th><th>Reserved for Projects</th><th>Total Physical Stocks</th><th></th></tr></thead><tbody>';
      filtered.forEach(id=>{
        const p = productDatabase[id];
        const stock = Number(p.currentQuantity||0);
        const reserved = getTotalProjectQuantity(id);
        const total = stock+reserved;
        html += `<tr>
          <td>${escapeHtml(getProductDisplayName(p))}</td>
          <td>${fmt(stock)}</td>
          <td>${fmt(reserved)}</td>
          <td><b>${fmt(total)}</b></td>
          <td><button class="btn" onclick="prepProjectFromRow('${escapeForJs(id)}')">Select</button></td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }


    function prepProjectFromRow(id){
      // set into a data attr for performProjectAction
      document.getElementById('project-products-list').dataset.selectedId = id;
      const name = getProductDisplayName(productDatabase[id]);
      showStatus(`Selected: ${name}`);
    }

    function updateProjectAction(){
      const action = document.getElementById('project-action-select').value;
      const showPO = (action==='addstock');
      const showDate = (action==='addstock' || action==='removestock');
      document.getElementById('po-number-row').style.display = showPO ? 'block':'none';
      document.getElementById('stock-date-row').style.display = showDate ? 'block':'none';
    }

    async function performProjectAction() {
      const container = document.getElementById('project-products-list');
      const selectedId = container.dataset.selectedId;
      const p = productDatabase[selectedId];
      if (!p) return;

      const action = document.getElementById('project-action-select').value;
      const qty = Math.max(0, Number(document.getElementById('project-quantity').value) || 0);
      const proj = document.getElementById('project-name').value.trim();
      const reason = document.getElementById('project-reason').value.trim();
      const po = document.getElementById('project-po-number').value.trim();
      const customDate = document.getElementById('project-stock-date').value;

      if (qty <= 0 || !proj) { showStatus('Qty and Project Name required.', false); return; }

      let stockChange = 0;
      let actionDesc = "";

      if (action === 'add') { 
        if (qty > (p.currentQuantity || 0)) { showStatus('Not enough stock.', false); return; }
        p.currentQuantity -= qty;
        projectAllocations[selectedId] = projectAllocations[selectedId] || {};
        projectAllocations[selectedId][proj] = (projectAllocations[selectedId][proj] || 0) + qty;
        stockChange = -qty;
        actionDesc = `Reserved for ${proj}`;
      } 
      else if (action === 'removeproject') {
        const currentAlloc = (projectAllocations[selectedId] || {})[proj] || 0;
        if (qty > currentAlloc) { showStatus('Not enough in project.', false); return; }
        p.currentQuantity = (p.currentQuantity || 0) + qty;
        projectAllocations[selectedId][proj] -= qty;
        if (projectAllocations[selectedId][proj] <= 0) delete projectAllocations[selectedId][proj];
        stockChange = qty;
        actionDesc = `Returned from ${proj}`;
      }

      showStatus("Updating Cloud...");
      try {
        // Batch these requests for data integrity
        await Promise.all([
          InventoryDB.putProduct(selectedId, p),
          InventoryDB.saveAllProjects(projectAllocations),
          InventoryDB.addTransaction({
            productId: selectedId,
            stockChange: stockChange,
            reason: reason || actionDesc,
            ref: po || proj,
            when: customDate ? new Date(customDate).toISOString() : new Date().toISOString()
          })
        ]);

        updateAllProductsView();
        renderProjectsTab();
        showStatus(`Success: ${actionDesc}`);
        
        document.getElementById('project-quantity').value = 1;
        document.getElementById('project-reason').value = '';
      } catch (err) {
        showStatus("Cloud Sync Failed", false);
      }
    }

    // ============ Bulk In / Out ============
    function openBulkInModal(){
      document.getElementById('bulk-in-modal').style.display='flex';
      document.body.style.overflow='hidden';
      const tb = document.querySelector('#bulk-in-table tbody'); tb.innerHTML=''; addBulkRow('in');
      bulkInHasUnsavedChanges = false;
    }
    function closeBulkInModal(){ 
      if (bulkInHasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
          return;
        }
      }
      document.getElementById('bulk-in-modal').style.display='none'; 
      document.body.style.overflow='auto'; 
      bulkInHasUnsavedChanges = false;
    }
    function openBulkOutModal(){
      document.getElementById('bulk-out-modal').style.display='flex';
      document.body.style.overflow='hidden';
      const tb = document.querySelector('#bulk-out-table tbody'); tb.innerHTML=''; addBulkRow('out');
      bulkOutHasUnsavedChanges = false;
    }
    function closeBulkOutModal(){ 
      if (bulkOutHasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
          return;
        }
      }
      document.getElementById('bulk-out-modal').style.display='none'; 
      document.body.style.overflow='auto'; 
      bulkOutHasUnsavedChanges = false;
    }

    function addBulkRow(type){
      const tbody = document.querySelector(`#bulk-${type}-table tbody`);
      const row = document.createElement('tr');

      const catOptions = categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

      row.innerHTML = `
        <td>
          <select class="bulk-category" onchange="updateBulkModelOptions(this)">
            <option value="">-- Select --</option>
            ${catOptions}
          </select>
        </td>
        <td>
          <select class="bulk-model" onchange="bulkModelSelected(this)">
            <option value="">-- Select Model --</option>
            <option value="_new">➕ Create New</option>
          </select>
          <input class="bulk-model-input" placeholder="Model" style="display:none;"/>
        </td>
        <td><input class="bulk-suffix" placeholder="Suffix"/></td>
        <td><input type="number" class="bulk-qty" min="0" value="0"/></td>
        <td><input class="bulk-location" placeholder="Location"/></td>
        <td><input class="bulk-barcode" placeholder="Barcode"/></td>
        <td><input class="bulk-reason" placeholder="ProjectCode"/></td>
        <td><input class="bulk-po" placeholder="PO Number"/></td>
        <td>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="date" class="bulk-date">
            <button type="button" onclick="this.previousElementSibling.showPicker()">📅</button>
          </div>
        </td>
        <td><button class="btn btn-secondary" onclick="this.closest('tr').remove()">✖</button></td>
      `;
      tbody.appendChild(row);
      addBulkRowEventListeners(row, type);
    }
    function addBulkRowEventListeners(row, type) {
      const inputs = row.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.addEventListener('input', () => markBulkUnsaved(type));
        input.addEventListener('change', () => markBulkUnsaved(type));
      });
    }
    function removeBulkRow(button, type) {
      button.closest('tr').remove();
      markBulkUnsaved(type);
    }

    // New function: Mark bulk operations as having unsaved changes
    function markBulkUnsaved(type) {
      if (type === 'in') {
        bulkInHasUnsavedChanges = true;
      } else if (type === 'out') {
        bulkOutHasUnsavedChanges = true;
      }
    }
    function addProductFormChangeListeners() {
      const inputs = document.querySelectorAll('#product-modal input, #product-modal textarea');
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          productModalHasUnsavedChanges = true;
        });
        input.addEventListener('change', () => {
          productModalHasUnsavedChanges = true;
        });
      });
    }

    
    function removeProductFormChangeListeners() {
      const inputs = document.querySelectorAll('#product-modal input, #product-modal textarea');
      inputs.forEach(input => {
        const clone = input.cloneNode(true);   // clone removes old listeners
        input.parentNode.replaceChild(clone, input);
      });
      productModalHasUnsavedChanges = false;
    }
    function updateBulkModelOptions(categorySelect){
      const row = categorySelect.closest('tr');
      const modelSelect = row.querySelector('.bulk-model');
      const modelInput = row.querySelector('.bulk-model-input');
      const locationInput = row.querySelector('.bulk-location');
      const barcodeInput = row.querySelector('.bulk-barcode');
      const suffixInput = row.querySelector('.bulk-suffix');

      // reset
      modelSelect.innerHTML = '<option value="">-- Select Model --</option><option value="_new">➕ Create New</option>';
      modelInput.style.display = 'none';
      modelInput.value = '';
      locationInput.value = '';
      barcodeInput.value = '';
      suffixInput.value = '';

      const cat = categorySelect.value;
      if(!cat) return;

      // filter products by category
      const models = Object.values(productDatabase)
        .filter(p => p.category === cat)
        .map(p => getProductDisplayName(p));

      models.sort().forEach(m=>{
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });
    }

    function bulkModelSelected(modelSelect){
      const row = modelSelect.closest('tr');
      const modelInput = row.querySelector('.bulk-model-input');
      const locationInput = row.querySelector('.bulk-location');
      const barcodeInput = row.querySelector('.bulk-barcode');
      const suffixInput = row.querySelector('.bulk-suffix');

      if(modelSelect.value === "_new"){
        // switch to free input mode
        modelInput.style.display = 'block';
        modelSelect.style.display = 'none';
        modelInput.focus();
        locationInput.value = '';
        barcodeInput.value = '';
        suffixInput.value = '';
        return;
      }

      modelInput.style.display = 'none';
      modelSelect.style.display = 'block';

      // Find product by matching the selected display name exactly
      // OR find the base model if no exact match exists
      let product = null;
      
      // First try exact match with display name
      product = Object.values(productDatabase).find(
        p => getProductDisplayName(p) === modelSelect.value
      );
      
      // If no exact match, try to find base model (without suffix)
      if (!product) {
        const selectedValue = modelSelect.value;
        // Extract base model name (everything before the first dash, if any)
        const baseModel = selectedValue.split('-')[0];
        
        product = Object.values(productDatabase).find(
          p => p.modelNumber === baseModel && (!p.suffix || p.suffix === '')
        );
      }

      // Auto-fill fields if product found
      if(product){
        locationInput.value = product.location || '';
        barcodeInput.value = product.barcode || '';
        // Never auto-fill suffix to prevent creating new products accidentally
        suffixInput.value = '';
      } else {
        // No matching product found - clear all fields
        locationInput.value = '';
        barcodeInput.value = '';
        suffixInput.value = '';
      }
    }


    function exportBulkTable(type){
      const rows = document.querySelectorAll(`#bulk-${type}-table tbody tr`);
      if(rows.length===0){ alert('No rows to export.'); return; }
      const header = 'model,category,suffix,qty,location,barcode,remark,poNumber,date';
      const lines = Array.from(rows).map(r=>{
        const vals = ['.bulk-model','.bulk-category','.bulk-suffix','.bulk-qty','.bulk-location','.bulk-barcode','.bulk-reason','.bulk-po','.bulk-date']
          .map(sel=>r.querySelector(sel).value||'');
        return vals.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
      });
      downloadCSV(`bulk-${type}-preview.csv`, [header].concat(lines).join('\n'));
    }

    async function saveBulkProducts(type) {
      const rows = document.querySelectorAll(`#bulk-${type}-table tbody tr`);
      if (rows.length === 0) {
        alert('Add at least one row.');
        return;
      }
      let count = 0;
      let hasErrors = false;

      // --- FIRST PASS: VALIDATION (Your original logic) ---
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const modelField = r.querySelector('.bulk-model');
        let model = modelField?.value.trim() || '';
        if (model === "_new" || !model) {
          model = r.querySelector('.bulk-model-input').value.trim();
        }

        const qty = Number(r.querySelector('.bulk-qty').value) || 0;
        const qtyInput = r.querySelector('.bulk-qty');

        r.querySelectorAll('input, select').forEach(field => {
          field.style.border = '';
          field.title = '';
        });

        if (!model || qty <= 0) {
          if (!model) {
            const mInput = r.querySelector('.bulk-model-input');
            const mSelect = r.querySelector('.bulk-model');
            (mSelect.style.display !== 'none' ? mSelect : mInput).style.border = '2px solid var(--danger)';
          }
          if (qty <= 0) {
            qtyInput.style.border = '2px solid var(--danger)';
            qtyInput.title = 'Quantity must be greater than 0';
          }
          hasErrors = true;
          continue;
        }

        if (type === 'out') {
          const suffix = r.querySelector('.bulk-suffix').value.trim();
          const id = suffix ? `${model}-${suffix}` : model;
          const p = productDatabase[id];
          const stockQty = Number(p?.currentQuantity || 0);
          if (qty > stockQty) {
            qtyInput.style.border = '2px solid var(--danger)';
            qtyInput.title = `Only ${stockQty} available`;
            hasErrors = true;
          }
        }
      }

      if (hasErrors) {
        showStatus('Please fix errors or check stock.', false);
        return;
      }

      // --- SECOND PASS: CLOUD SAVE ---
      showStatus(`Saving ${rows.length} rows to Cloud...`);

      for (const r of rows) {
        const modelField = r.querySelector('.bulk-model');
        let model = (modelField?.value === "_new" || !modelField?.value) 
                    ? r.querySelector('.bulk-model-input').value.trim() 
                    : modelField.value.trim();

        const qty = Number(r.querySelector('.bulk-qty').value) || 0;
        const suffix = r.querySelector('.bulk-suffix').value.trim();
        const id = suffix ? `${model}-${suffix}` : model;

        // Get product from local DB or create new
        const p = productDatabase[id] || { 
            modelNumber: model, suffix, 
            category: r.querySelector('.bulk-category').value.trim(),
            location: r.querySelector('.bulk-location').value.trim(),
            barcode: r.querySelector('.bulk-barcode').value.trim() || id,
            currentQuantity: 0 
        };

        // Update quantities
        if (type === 'in') p.currentQuantity = Number(p.currentQuantity || 0) + qty;
        else p.currentQuantity = Number(p.currentQuantity || 0) - qty;

        // 1. Save Product to Cloud
        await InventoryDB.putProduct(id, p);

        // 2. Log Transaction to Cloud
        const customDate = r.querySelector('.bulk-date').value.trim();
        const tx = {
          productId: id,
          stockChange: (type === 'in' ? qty : -qty),
          reason: r.querySelector('.bulk-reason').value.trim() || `Bulk ${type}`,
          ref: r.querySelector('.bulk-po').value.trim() || '',
          when: customDate ? new Date(customDate).toISOString() : new Date().toISOString()
        };
        await InventoryDB.addTransaction(tx);

        // Update local memory
        await InventoryDB.putProduct(id, p);
        transactions.unshift({ ...tx, displayName: getProductDisplayName(p) });
        count++;
      }

      await InventoryDB.bulkPutProducts(productDatabase);
      
      updateAllProductsView();
      renderProjectsTab();
      updateTransactionHistory();

      if (type === 'in') { bulkInHasUnsavedChanges = false; closeBulkInModal(); } 
      else { bulkOutHasUnsavedChanges = false; closeBulkOutModal(); }

      showStatus(`Cloud Synced: Saved ${count} rows.`);
    }


    // ============ PO Overview ============
    function showPOOverview(){ document.getElementById('po-overview-modal').style.display='flex'; document.body.style.overflow='hidden'; generatePOOverview(); }
    function hidePOOverview(){ document.getElementById('po-overview-modal').style.display='none'; document.body.style.overflow='auto'; }

    function generatePOOverview(){
      const search = (document.getElementById('po-search').value||'').trim().toLowerCase();
      const content = document.getElementById('po-overview-content');
      const list = transactions.filter(tx=> (tx.poNumber||'').toLowerCase().includes(search));
      if(list.length===0){ content.innerHTML = '<div class="small">No matching PO transactions.</div>'; return; }
      let html = '<table><thead><tr><th>PO Number</th><th>Date</th><th>Product</th><th>Qty</th><th>After Stock</th></tr></thead><tbody>';
      list.forEach(tx=>{
        const dt = new Date(tx.when);
        html += `<tr>
          <td>${escapeHtml(tx.poNumber||'')}</td>
          <td>${dt.toLocaleString()}</td>
          <td>${escapeHtml(tx.displayName||tx.productId)}</td>
          <td>${tx.stockChange>0?'+':''}${tx.stockChange}</td>
          <td>${tx.stockAfter}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      content.innerHTML = html;
    }

    function exportPOOverviewCSV(){
      const search = (document.getElementById('po-search').value||'').trim().toLowerCase();
      const list = transactions.filter(tx=> (tx.poNumber||'').toLowerCase().includes(search));
      const header = 'poNumber,date,product,qty,stockAfter,ProjectCode';
      const rows = list.map(tx=>{
        const vals = [tx.poNumber||'', new Date(tx.when).toISOString(), tx.displayName||tx.productId, tx.stockChange, tx.stockAfter, tx.reason||''];
        return vals.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
      });
      downloadCSV('po-overview.csv', [header].concat(rows).join('\n'));
    }

    // ============ Projects Overview ============
    function showProjectsOverview(){ document.getElementById('projects-overview-modal').style.display='flex'; document.body.style.overflow='hidden'; generateProjectsOverview(); refreshProjectsDropdown(); }
    function hideProjectsOverview(){ document.getElementById('projects-overview-modal').style.display='none'; document.body.style.overflow='auto'; }

    function refreshProjectsDropdown(){
      const sel = document.getElementById('project-overview-select');
      const projects = getAllProjects();
      sel.innerHTML = '<option value="">-- All Projects --</option>' + projects.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    }

    function generateProjectsOverview(){
      const selected = document.getElementById('project-overview-select').value||'';
      const content = document.getElementById('projects-overview-content');
      const projects = getAllProjects();
      if(projects.length===0){ content.innerHTML='<div class="small">No projects found.</div>'; return; }
      let html = '<div style="display:grid; gap:16px">';
      projects.forEach(project=>{
        if(selected && selected!==project) return;
        let section = `<div class="card"><h4 style="margin:0 0 12px 0;">${escapeHtml(project)}</h4><div style="max-height:240px; overflow:auto">`;
        let total=0; let any=false;
        for(const pid in projectAllocations){
          const map = projectAllocations[pid]||{}; const qty = Number(map[project]||0); if(!qty) continue; any=true; total+=qty;
          const prod = productDatabase[pid]; const name = prod? getProductDisplayName(prod): pid;
          section += `<div class="row" style="justify-content:space-between; padding:4px 0; border-bottom:1px solid #1f2a44">
            <div><b>${escapeHtml(name)}</b><div class="small">ID: ${escapeHtml(pid)}</div></div>
            <div><b>${qty}</b> units <button class="btn btn-danger" style="margin-left:8px; padding:2px 6px; font-size:12px" onclick="removeFromProject('${escapeForJs(pid)}','${escapeForJs(project)}', ${qty})">Remove</button></div>
          </div>`;
        }
        if(!any) section += '<div class="small">No items in this project.</div>';
        section += `</div><div style="margin-top:10px; border-top:2px solid #203055; padding-top:8px; font-weight:700">Total allocated: ${total} units</div></div>`;
        html += section;
      });
      html += '</div>';
      content.innerHTML = html;
    }

    async function removeFromProject(productId, projectName, qty) {
      projectAllocations[productId] = projectAllocations[productId] || {};
      const current = Number(projectAllocations[productId][projectName] || 0);
      const take = Math.min(current, Number(qty || 0));
      
      // 1. Update local memory
      projectAllocations[productId][projectName] = current - take;
      if (projectAllocations[productId][projectName] <= 0) delete projectAllocations[productId][projectName];
      
      const p = productDatabase[productId]; 
      if (p) p.currentQuantity = Number(p.currentQuantity || 0) + take;

      const tx = {
        when: new Date().toISOString(), 
        productId, 
        displayName: getProductDisplayName(p || { modelNumber: productId }),
        stockChange: +take, 
        stockAfter: Number(p?.currentQuantity || 0), 
        reason: `Returned ${take} from project: ${projectName}`, 
        ref: projectName
      };

      showStatus("Syncing return to Cloud...");

      try {
        // 2. Parallel Cloud Sync for speed
        await Promise.all([
          p ? InventoryDB.putProduct(productId, p) : Promise.resolve(),
          InventoryDB.saveAllProjects(projectAllocations),
          InventoryDB.addTransaction(tx)
        ]);

        // 3. Update UI
        transactions.unshift(tx);
        generateProjectsOverview(); 
        updateAllProductsView(); 
        updateTransactionHistory();
        
        showStatus("Stock returned to Cloud.");
      } catch (err) {
        showStatus("Cloud Error: Could not return stock.", false);
      }
    }

    function exportSelectedProject(){
      const selected = document.getElementById('project-overview-select').value||'';
      if(!selected){ alert('Please select a project to export.'); return; }
      const header = 'project,productId,displayName,barcode,modelNumber,allocatedQuantity,stockQuantity,category,location,description';
      const rows = [];
      for(const productId in projectAllocations){
        const map = projectAllocations[productId]||{}; const qty = Number(map[selected]||0); if(!qty) continue;
        const p = productDatabase[productId]||{};
        const vals = [selected, productId, getProductDisplayName(p)||productId, p.barcode||'', p.modelNumber||'', qty, Number(p.currentQuantity||0), p.category||'', p.location||'', p.description||'']
          .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
        rows.push(vals);
      }
      if(rows.length===0){ alert('No data for selected project.'); return; }
      downloadCSV(`${selected}-project-report.csv`, [header].concat(rows).join('\n'));
    }

    // ============ Total Stock Modal ============
    function showTotalStockList(){ document.getElementById('total-stock-modal').style.display='flex'; document.body.style.overflow='hidden'; generateTotalStockList(1); updateCategoryOptions(); }
    function hideTotalStockList(){ document.getElementById('total-stock-modal').style.display='none'; document.body.style.overflow='auto'; }

    function generateTotalStockList(page=1){
      const target = document.getElementById('total-stock-content');
      const keys = Object.keys(productDatabase).sort();
      const cat = document.getElementById('total-filter-category').value||'';
      const q = (document.getElementById('total-filter-model').value||'').toLowerCase();

      let filtered = keys.filter(k=>{
        const p = productDatabase[k]; if(!p) return false;
        if(cat && p.category!==cat) return false;
        if(q && !(p.modelNumber||'').toLowerCase().includes(q)) return false;
        return true;
      });

      if(filtered.length===0){ target.innerHTML = '<div class="small">No products match filter.</div>'; return; }

      const PAGE = 50; const total = filtered.length; const pages = Math.max(1, Math.ceil(total/PAGE));
      page = Math.max(1, Math.min(page, pages));
      const start = (page-1)*PAGE; const slice = filtered.slice(start, start+PAGE);

      let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div class="small">Showing ${start+1}-${start+slice.length} of ${total}</div>
        <div class="row" style="gap:6px">
          <span class="pill">Page ${page}/${pages}</span>
          <button class="btn" onclick="generateTotalStockList(1)">First</button>
          <button class="btn" onclick="generateTotalStockList(${page-1})">Prev</button>
          <button class="btn" onclick="generateTotalStockList(${page+1})">Next</button>
          <button class="btn" onclick="generateTotalStockList(${pages})">Last</button>
        </div>
      </div>`;

      html += '<table><thead><tr><th>Model</th><th>Barcode</th><th>In Stock</th><th>Reserved</th><th>Total Physical</th></tr></thead><tbody>';
      slice.forEach(id=>{
        const p = productDatabase[id]; const stock = Number(p.currentQuantity||0); const reserved = getTotalProjectQuantity(id); const totalPhys = stock + reserved;
        html += `<tr><td>${escapeHtml(getProductDisplayName(p))}</td><td>${escapeHtml(p.barcode||'')}</td><td>${fmt(stock)}</td><td>${fmt(reserved)}</td><td><b>${fmt(totalPhys)}</b></td></tr>`;
      });
      html += '</tbody></table>';
      target.innerHTML = html;
    }

    function exportTotalStock(){
      const keys = Object.keys(productDatabase).sort();
      const header = 'productId,modelNumber,barcode,category,stock,reserved,totalPhysical';
      const rows = keys.map(id=>{
        const p = productDatabase[id]; 
        const stock = Number(p.currentQuantity||0); 
        const reserved = getTotalProjectQuantity(id); 
        const total = stock + reserved;
        return [
          id,
          p.modelNumber||'',
          p.barcode||'',
          p.category||'',
          stock,
          reserved,
          total
        ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
      });
      downloadCSV('total-stock-list.csv', [header].concat(rows).join('\n'));
    }


    // ============ Transactions ============
    function updateTransactionHistory(){
      const container = document.getElementById('transactions-list');
      const po = (document.getElementById('tx-filter-po').value||'').toLowerCase();
      const model = (document.getElementById('tx-filter-model').value||'').toLowerCase();
      const list = transactions.filter(tx=>{
        if(po && !(tx.poNumber||'').toLowerCase().includes(po)) return false;
        const name = (tx.displayName||tx.productId||'').toLowerCase();
        if(model && !name.includes(model)) return false; return true;
      });

      if(list.length===0){ container.innerHTML='<div class="small">No transactions found.</div>'; return; }

      let html = '<table><thead><tr><th>Date</th><th>Product</th><th>Change</th><th>After</th><th>Project</th><th>Action</th><th>PO</th><th>Remark</th></tr></thead><tbody>';
      list.forEach(tx=>{
        const dt = new Date(tx.when);
        html += `<tr>
          <td>${dt.toLocaleString()}</td>
          <td>${escapeHtml(tx.displayName||tx.productId)}</td>
          <td>${tx.stockChange>0?'+':''}${tx.stockChange}</td>
          <td>${tx.stockAfter}</td>
          <td>${escapeHtml(tx.project||'')}</td>
          <td>${escapeHtml(tx.projectAction||'')}</td>
          <td>${escapeHtml(tx.poNumber||'')}</td>
          <td>${escapeHtml(tx.reason||'')}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function exportTransactionsCSV(){
      const header = 'date,product,change,after,project,action,po,ProjectCode';
      const rows = transactions.map(tx=>{
        const vals = [new Date(tx.when).toISOString(), tx.displayName||tx.productId, tx.stockChange, tx.stockAfter, tx.project||'', tx.projectAction||'', tx.poNumber||'', tx.reason||''];
        return vals.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
      });
      downloadCSV('transactions.csv', [header].concat(rows).join('\n'));
    }

    // ============ Admin ============
    function showAdmin(){ document.getElementById('admin-modal').style.display='flex'; document.body.style.overflow='hidden'; renderCategoriesList(); }
    function hideAdmin(){ document.getElementById('admin-modal').style.display='none'; document.body.style.overflow='auto'; }

    async function addCategory() {
      const input = document.getElementById('new-category');
      const cat = input.value.trim();
      if (!cat || categories.includes(cat)) return;

      const updatedCategories = [...categories, cat];
      
      try {
        await InventoryDB.saveCategories(updatedCategories); 
        categories = updatedCategories; // Only update local memory on success
        updateCategoryOptions();
        input.value = '';
        showStatus("Category saved to Cloud");
      } catch (e) {
        showStatus("Failed to save category", false);
      }
    }

    async function removeCategory(name){
      if(!confirm(`Delete category "${name}"?`)) return;
      const updatedCategories = categories.filter(c=>c!==name);
      
      try {
        await InventoryDB.saveCategories(updatedCategories);
        categories = updatedCategories;
        updateCategoryOptions();
        renderCategoriesList();
        showStatus('Category removed.');
      } catch (e) {
        showStatus("Failed to remove category", false);
      }
    }
    function renderCategoriesList(){
      const el = document.getElementById('categories-list'); if(!el) return;
      if(categories.length===0){ el.innerHTML='<div class="small">No categories.</div>'; return; }
      el.innerHTML = categories.map(c=>`<div class="row" style="justify-content:space-between; padding:6px 0; border-bottom:1px solid #1f2a44"><div>${escapeHtml(c)}</div><button class="btn btn-danger" onclick="removeCategory('${escapeForJs(c)}')">Delete</button></div>`).join('');
    }

    async function backupAll() {
      showStatus("Preparing Cloud Backup...");

      try {
        // 1. Fetch the absolute latest data from the Cloud
        const latestProducts = await InventoryDB.exportProductsObject();
        const latestTransactions = await InventoryDB.getRecentTransactions(5000); // Get more for backup
        const latestCategories = await InventoryDB.loadCategories();
        const latestProjects = await InventoryDB.loadAllProjects();

        // 2. Create the data object
        const data = {
          products: latestProducts,
          transactions: latestTransactions,
          projectAllocations: latestProjects,
          categories: latestCategories,
          backupDate: new Date().toISOString()
        };

        // 3. Download the file (The rest is your original logic)
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_cloud_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus("Backup Downloaded!");
      } catch (err) {
        console.error(err);
        showStatus("Backup Failed: Cloud connection error", false);
      }
    }
    async function restoreAll() {
      const f = document.getElementById('restore-file').files[0];
      if (!f) { alert('Pick a JSON file first.'); return; }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!confirm("Overwrite ALL Cloud data with this file?")) return;
          
          showStatus("Restoring Cloud Data... please wait.");

          // 1. Sync Primary Data Sets
          await Promise.all([
            InventoryDB.bulkPutProducts(data.products || {}),
            InventoryDB.saveAllProjects(data.projectAllocations || {}),
            InventoryDB.saveCategories(data.categories || ['Default'])
          ]);
          
          // 2. Transaction Log (Sync last 50 for history)
          const txToRestore = (data.transactions || []).slice(0, 50);
          for (const tx of txToRestore) {
            await InventoryDB.addTransaction(tx);
          }

          // 3. Update local state and UI
          productDatabase = data.products || {};
          transactions = data.transactions || [];
          projectAllocations = data.projectAllocations || {};
          categories = data.categories || ['Default'];

          init(); // Re-initialize the UI with the new data
          showStatus('Cloud Restore Complete!');
        } catch (err) {
          showStatus('Restore failed. Check file format.', false);
        }
      };
      reader.readAsText(f);
    }

    // ============ Utilities ============
    function downloadCSV(filename, content){
      const blob = new Blob([content], {type:'text/csv'});
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
    }

    function openRemarkSearch() {
      document.getElementById("remark-search-modal").style.display = "block";
      document.body.style.overflow = "hidden";
    }

    function closeRemarkSearch() {
      document.getElementById("remark-search-modal").style.display = "none";
      document.body.style.overflow = "auto";
    }

    function searchByRemark() {
      const keyword = document.getElementById("remark-search-input").value.trim().toLowerCase();
      const tbody = document.querySelector("#remark-search-results tbody");
      tbody.innerHTML = "";

      if (!keyword) {
        showStatus("Enter a remark to search.", false);
        return;
      }

      const filtered = (transactions || []).filter(tx =>
        (tx.reason || "").toLowerCase().includes(keyword) || 
        (tx.ref || "").toLowerCase().includes(keyword)
      );

      if (filtered.length === 0) {
        showStatus("No transactions found with that remark.", false);
        return;
      }

      filtered.forEach(tx => {
        const p = productDatabase[tx.productId] || {};
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${tx.when ? new Date(tx.when).toLocaleString() : ""}</td>
          <td>${p.modelNumber || tx.productId|| ""}</td>
          <td>${p.category || ""}</td>
          <td>${tx.stockChange > 0 ? '+' + tx.stockChange : tx.stockChange}</td>
          <td>${tx.reason || ""}</td>
          <td>${tx.ref || tx.poNumber || ""}</td>
        `;
        tbody.appendChild(row);
      });
    }
    // ============ Init ============
    function init(){
      updateCategoryOptions();
      updateAllProductsView();
      renderProjectsTab();
      updateTransactionHistory();
    }
    // Add beforeunload event listener (add this in the init function or at the bottom of script)
    window.addEventListener('beforeunload', function(e) {
      if (bulkInHasUnsavedChanges || bulkOutHasUnsavedChanges || productModalHasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    });
    window.addEventListener('load', syncFromCloud);