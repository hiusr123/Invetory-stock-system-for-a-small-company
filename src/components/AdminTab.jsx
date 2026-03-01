import React, { useState } from 'react';
import { useInventory } from '../InventoryProvider';
import { exportProductsCSV, exportTransactionsCSV, exportProjectsCSV } from '../utils/exportUtils';

export default function AdminTab() {
    const { categories, saveCategories, resetKeys, productDatabase, transactions, projectAllocations } = useInventory();
    const [newCategory, setNewCategory] = useState('');
    const [statusMsg, setStatusMsg] = useState('');

    const handleAddCategory = async () => {
        const cat = newCategory.trim();
        if (!cat) return;
        if (categories.includes(cat)) {
            setStatusMsg('Category already exists');
            return;
        }

        setStatusMsg('Saving...');
        try {
            await saveCategories([...categories, cat]);
            setNewCategory('');
            setStatusMsg('Category added!');
            setTimeout(() => setStatusMsg(''), 2000);
        } catch (err) {
            console.error(err);
            setStatusMsg('Failed to save category');
        }
    };

    const handleRemoveCategory = async (catToRemove) => {
        if (!window.confirm(`Remove category "${catToRemove}"?`)) return;
        setStatusMsg('Updating...');
        try {
            await saveCategories(categories.filter(c => c !== catToRemove));
            setStatusMsg('Category removed!');
            setTimeout(() => setStatusMsg(''), 2000);
        } catch (err) {
            console.error(err);
            setStatusMsg('Failed to update category');
        }
    };

    const handleExportBackup = () => {
        const backupData = {
            timestamp: new Date().toISOString(),
            products: productDatabase,
            transactions: transactions,
            projectAllocations: projectAllocations,
            settings: { categories }
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="card mt-3">
            <h2 className="text-xl font-bold mb-4">Admin settings</h2>

            {statusMsg && <div className="mb-4 text-yellow-400 font-bold">{statusMsg}</div>}

            <div className="mb-8">
                <h3 className="text-lg font-bold mb-2">Category Management</h3>
                <div className="flex gap-2 mb-4">
                    <input
                        className="input-field max-w-[300px]"
                        placeholder="New category name..."
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                    />
                    <button className="btn btn-primary px-6" onClick={handleAddCategory}>Add Category</button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {categories.map(c => (
                        <div key={c} className="flex items-center gap-2 bg-[#2c3e50] px-3 py-1.5 rounded-full border border-[#34495e]">
                            <span>{c}</span>
                            <button
                                className="text-red-400 hover:text-red-300 font-bold ml-1"
                                onClick={() => handleRemoveCategory(c)}
                                title="Remove category"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <hr className="border-[#2c3e50] my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-bold mb-2">Export Data (CSV)</h3>
                    <p className="text-sm text-[var(--dim)] mb-3">Download individual tables for spreadsheet analysis.</p>
                    <div className="flex flex-col gap-2 items-start">
                        <button className="btn w-full max-w-[200px]" onClick={() => exportProductsCSV(productDatabase, projectAllocations)}>📤 Export Stock List</button>
                        <button className="btn w-full max-w-[200px]" onClick={() => exportTransactionsCSV(transactions, productDatabase)}>📤 Export Transactions</button>
                        <button className="btn w-full max-w-[200px]" onClick={() => exportProjectsCSV(projectAllocations)}>📤 Export Projects</button>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold mb-2 text-yellow-500">System Backup & Reset</h3>
                    <p className="text-sm text-[var(--dim)] mb-3">Create a full JSON backup of all Data, or reset local Supabase connection keys.</p>
                    <div className="flex flex-col gap-2 items-start">
                        <button className="btn btn-primary w-full max-w-[200px]" onClick={handleExportBackup}>💾 Full JSON Backup</button>
                        <button className="btn btn-danger w-full max-w-[200px] mt-2" onClick={() => {
                            if (window.confirm('This will wipe local Supabase keys and force a reload. Continue?')) {
                                resetKeys();
                            }
                        }}>⚠️ Reset API Connection</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
