import React, { useState, useMemo } from 'react';
import { useInventory } from '../InventoryProvider';
import { exportProductsCSV } from '../utils/exportUtils';

export default function ProductsTab({ onEditProduct, onProjectAction }) {
    const { productDatabase, categories, projectAllocations, getProductDisplayName } = useInventory();
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const itemsPerPage = 50;

    // Derive products list
    const filteredProducts = useMemo(() => {
        const keys = Object.keys(productDatabase).sort();
        return keys.filter(k => {
            const p = productDatabase[k];
            if (!p) return false;
            if (filterCategory && p.category !== filterCategory) return false;
            const text = `${p.modelNumber || ''} ${p.suffix || ''} ${p.barcode || ''}`.toLowerCase();
            if (searchQuery && !text.includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [productDatabase, filterCategory, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    const getTotalProjectQuantity = (productId) => {
        const map = projectAllocations[productId] || {};
        let sum = 0;
        for (const k in map) sum += Number(map[k] || 0);
        return sum;
    };

    const getPhysicalStock = (id) => {
        const p = productDatabase[id] || {};
        return Number(p.currentQuantity || 0) + getTotalProjectQuantity(id);
    };

    const handleExport = () => {
        // Export all data, not just filtered
        exportProductsCSV(productDatabase, projectAllocations);
    };

    return (
        <div className="card mt-3">
            <div className="flex flex-wrap gap-2 mb-2">
                <div className="flex-1 min-w-[160px]">
                    <label className="label-text">Category</label>
                    <select
                        className="input-field"
                        value={filterCategory}
                        onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                    >
                        <option value="">All</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex-[2] min-w-[240px]">
                    <label className="label-text">Search (model / barcode)</label>
                    <input
                        className="input-field"
                        placeholder="Type to search..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="flex-1 min-w-[120px] flex items-end">
                    <button className="btn w-full" onClick={handleExport}>📤 Export CSV</button>
                </div>
            </div>

            {filteredProducts.length === 0 ? (
                <div className="text-xs text-[var(--dim)] mt-4">No products found.</div>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-2 mt-4">
                        <div className="text-xs text-[var(--dim)]">
                            Showing {startIndex + 1}-{startIndex + paginated.length} of {filteredProducts.length}
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className="pill">Page {currentPage}/{totalPages}</span>
                            <button className="btn text-xs py-1" onClick={() => setPage(1)}>First</button>
                            <button className="btn text-xs py-1" onClick={() => setPage(currentPage - 1)}>Prev</button>
                            <button className="btn text-xs py-1" onClick={() => setPage(currentPage + 1)}>Next</button>
                            <button className="btn text-xs py-1" onClick={() => setPage(totalPages)}>Last</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-base">
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th>Barcode</th>
                                    <th>Category</th>
                                    <th>Location</th>
                                    <th>In Stock</th>
                                    <th>Reserved For Projects</th>
                                    <th>Total Physical Stock</th>
                                    <th className="w-[180px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(id => {
                                    const p = productDatabase[id];
                                    const stock = Number(p.currentQuantity || 0);
                                    const reserved = getTotalProjectQuantity(id);
                                    const totalPhys = getPhysicalStock(id);
                                    return (
                                        <tr key={id}>
                                            <td>{getProductDisplayName(p)}</td>
                                            <td>{p.barcode || ''}</td>
                                            <td>{p.category || ''}</td>
                                            <td>{p.location || ''}</td>
                                            <td>{stock.toLocaleString()}</td>
                                            <td>{reserved.toLocaleString()}</td>
                                            <td><b>{totalPhys.toLocaleString()}</b></td>
                                            <td>
                                                <button className="btn text-xs py-1 mr-2" onClick={() => onEditProduct(p)}>Edit</button>
                                                <button className="btn text-xs py-1" onClick={() => onProjectAction(id)}>Project…</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
