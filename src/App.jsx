import React, { useState } from 'react';
import ProductsTab from './components/ProductsTab';
import ProjectsTab from './components/ProjectsTab';
import TransactionsTab from './components/TransactionsTab';
import BulkModal from './components/BulkModal';
import SearchProjectCodeModal from './components/SearchProjectCodeModal';
import AddEditProductModal from './components/AddEditProductModal';
import AdminTab from './components/AdminTab';
import { useInventory } from './InventoryProvider';

function App() {
    const [activeTab, setActiveTab] = useState('stock');
    const [modalOpen, setModalOpen] = useState(null); // 'bulkIn', 'bulkOut', 'search', 'addEditProduct'
    const [editProductData, setEditProductData] = useState(null);
    const [targetProjectProduct, setTargetProjectProduct] = useState(null);

    // We have more modals like PO, Projects Overview, Total Stock but we can add them later
    // Focus on logic-preserving refactoring

    return (
        <div className="max-w-[1200px] mx-auto p-4 min-h-screen">
            <header className="flex justify-between items-center gap-3 mb-6 flex-wrap">
                <h1 className="text-2xl m-0 tracking-[0.3px] font-bold">Inventory Management</h1>
                <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" onClick={() => { setEditProductData(null); setModalOpen('addEditProduct'); }}>+ Add Product</button>
                    <button className="btn btn-secondary" onClick={() => setModalOpen('bulkIn')}>➕ Bulk In Stock</button>
                    <button className="btn btn-danger" onClick={() => setModalOpen('bulkOut')}>➖ Bulk Out Stock</button>
                    <button className="btn btn-secondary" onClick={() => setModalOpen('search')}>🔍 Search by ProjectCode</button>
                </div>
            </header>

            <div className="flex gap-1.5 mt-4" role="tablist">
                <div
                    className={`px-3 py-2 rounded-[10px] cursor-pointer font-bold ${activeTab === 'stock' ? 'bg-[var(--muted)] text-[var(--text)]' : 'bg-[var(--card)] text-[var(--dim)]'}`}
                    onClick={() => setActiveTab('stock')}
                >
                    Stock
                </div>
                <div
                    className={`px-3 py-2 rounded-[10px] cursor-pointer font-bold ${activeTab === 'projects' ? 'bg-[var(--muted)] text-[var(--text)]' : 'bg-[var(--card)] text-[var(--dim)]'}`}
                    onClick={() => setActiveTab('projects')}
                >
                    Projects
                </div>
                <div
                    className={`px-3 py-2 rounded-[10px] cursor-pointer font-bold ${activeTab === 'transactions' ? 'bg-[var(--muted)] text-[var(--text)]' : 'bg-[var(--card)] text-[var(--dim)]'}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    Transactions
                </div>
                <div
                    className={`px-3 py-2 rounded-[10px] cursor-pointer font-bold ${activeTab === 'admin' ? 'bg-[var(--muted)] text-[var(--text)]' : 'bg-[var(--card)] text-[var(--dim)]'}`}
                    onClick={() => setActiveTab('admin')}
                >
                    Admin
                </div>
            </div>

            <main className="mt-3">
                {activeTab === 'stock' && <ProductsTab
                    onEditProduct={(p) => { setEditProductData(p); setModalOpen('addEditProduct'); }}
                    onProjectAction={(id) => { setTargetProjectProduct(id); setActiveTab('projects'); }}
                />}
                {activeTab === 'projects' && <ProjectsTab targetProductId={targetProjectProduct} />}
                {activeTab === 'transactions' && <TransactionsTab />}
                {activeTab === 'admin' && <AdminTab />}
            </main>

            {/* Modals */}
            {modalOpen === 'bulkIn' && <BulkModal type="in" onClose={() => setModalOpen(null)} />}
            {modalOpen === 'bulkOut' && <BulkModal type="out" onClose={() => setModalOpen(null)} />}
            {modalOpen === 'search' && <SearchProjectCodeModal onClose={() => setModalOpen(null)} />}
            {modalOpen === 'addEditProduct' && <AddEditProductModal initialData={editProductData} onClose={() => setModalOpen(null)} />}
        </div>
    );
}

export default App;
