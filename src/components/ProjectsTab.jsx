import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../InventoryProvider';

export default function ProjectsTab({ targetProductId }) {
    const { productDatabase, projectAllocations, getProductDisplayName, getProductId, saveProduct, saveAllProjects, addTransaction, refreshTransactions } = useInventory();

    const [searchQuery, setSearchQuery] = useState('');
    const [projectName, setProjectName] = useState('');
    const [action, setAction] = useState('add');
    const [quantity, setQuantity] = useState(1);
    const [poNumber, setPoNumber] = useState('');
    const [stockDate, setStockDate] = useState('');
    const [reason, setReason] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        if (targetProductId) {
            setSelectedId(targetProductId);
        }
    }, [targetProductId]);

    const keys = Object.keys(productDatabase).sort();
    const filteredProducts = useMemo(() => {
        return keys.filter(id => {
            const p = productDatabase[id];
            if (!p) return false;
            const text = `${p.modelNumber || ''} ${p.barcode || ''}`.toLowerCase();
            if (searchQuery && !text.includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [keys, productDatabase, searchQuery]);

    const getTotalProjectQuantity = (productId) => {
        const map = projectAllocations[productId] || {};
        let sum = 0;
        for (const k in map) sum += Number(map[k] || 0);
        return sum;
    };

    const handleApply = async () => {
        if (!selectedId) { setStatusMsg('Please select a product below first.'); return; }
        const p = productDatabase[selectedId];
        if (!p) return;

        const qty = Math.max(0, Number(quantity) || 0);
        const proj = projectName.trim();
        if (qty <= 0 || !proj) { setStatusMsg('Qty and Project Name required.'); return; }

        let stockChange = 0;
        let actionDesc = "";

        const newAllocations = { ...projectAllocations };
        if (!newAllocations[selectedId]) newAllocations[selectedId] = {};
        const newProduct = { ...p };

        if (action === 'add') {
            if (qty > (newProduct.currentQuantity || 0)) { setStatusMsg('Not enough stock.'); return; }
            newProduct.currentQuantity -= qty;
            newAllocations[selectedId][proj] = (newAllocations[selectedId][proj] || 0) + qty;
            stockChange = -qty;
            actionDesc = `Reserved for ${proj}`;
        } else if (action === 'removeproject') {
            const currentAlloc = newAllocations[selectedId][proj] || 0;
            if (qty > currentAlloc) { setStatusMsg('Not enough in project.'); return; }
            newProduct.currentQuantity = (newProduct.currentQuantity || 0) + qty;
            newAllocations[selectedId][proj] -= qty;
            if (newAllocations[selectedId][proj] <= 0) delete newAllocations[selectedId][proj];
            stockChange = qty;
            actionDesc = `Returned from ${proj}`;
        } else if (action === 'addstock') {
            // just adding to physical stock
            newProduct.currentQuantity += qty;
            stockChange = qty;
            actionDesc = 'Added to Stock';
        } else if (action === 'removestock') {
            if (qty > (newProduct.currentQuantity || 0)) { setStatusMsg('Not enough stock to remove.'); return; }
            newProduct.currentQuantity -= qty;
            stockChange = -qty;
            actionDesc = 'Removed from Stock';
        }

        try {
            setStatusMsg('Updating Cloud...');
            // Run updates in parallel
            await Promise.all([
                saveProduct(selectedId, newProduct),
                saveAllProjects(newAllocations),
                addTransaction({
                    productId: selectedId,
                    displayName: `${newProduct.modelNumber}${newProduct.suffix ? '-' + newProduct.suffix : ''}`,
                    stockChange: stockChange,
                    stockAfter: newProduct.currentQuantity,
                    reason: reason || actionDesc,
                    poNumber: poNumber || '',
                    project: proj,
                    projectAction: action === 'add' ? 'RESERVE' : (action === 'removeproject' ? 'RETURN' : action.toUpperCase()),
                    when: stockDate ? new Date(stockDate).toISOString() : new Date().toISOString()
                })
            ]);
            await refreshTransactions();

            setStatusMsg(`Success: ${actionDesc}`);
            setQuantity(1);
            setReason('');
        } catch (err) {
            console.error(err);
            setStatusMsg('Cloud Sync Failed');
        }
    };

    return (
        <div className="card mt-3">
            {statusMsg && <div className="mb-4 text-yellow-400 font-bold">{statusMsg}</div>}

            <div className="flex flex-wrap gap-2 mb-2">
                <div className="flex-[2] min-w-[240px]">
                    <label className="label-text">Search (model / barcode)</label>
                    <input className="input-field" placeholder="Type to search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex-[2] min-w-[260px]">
                    <label className="label-text">Project name</label>
                    <input className="input-field" placeholder="Enter project name" value={projectName} onChange={e => setProjectName(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[180px]">
                    <label className="label-text">Action</label>
                    <select className="input-field" value={action} onChange={e => setAction(e.target.value)}>
                        <option value="add">Add to Project (reserve)</option>
                        <option value="removeproject">Remove from Project</option>
                        <option value="addstock">Add to Stock</option>
                        <option value="removestock">Remove from Stock</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                    <label className="label-text">Quantity</label>
                    <input type="number" className="input-field" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>

                {(action === 'addstock') && (
                    <div className="flex-1 min-w-[160px]">
                        <label className="label-text">PO Number</label>
                        <input className="input-field" placeholder="Enter PO" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                    </div>
                )}

                {(action === 'addstock' || action === 'removestock') && (
                    <div className="flex-1 min-w-[180px]">
                        <label className="label-text">Stock In/Out Date</label>
                        <input type="date" className="input-field" value={stockDate} onChange={e => setStockDate(e.target.value)} />
                    </div>
                )}

                <div className="flex-[2] min-w-[260px]">
                    <label className="label-text">Note</label>
                    <input className="input-field" placeholder="Optional reason..." value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[160px] flex items-end">
                    <button className="btn btn-primary w-full py-2.5" onClick={handleApply}>Apply</button>
                </div>
            </div>

            <div className="text-xs text-[var(--dim)] mb-2 mt-4">Tip: Selecting a product below sets the target for the action.</div>

            {selectedId && (
                <div className="mb-4 p-2 bg-[#1f2a44] rounded text-white font-bold">
                    Selected Target: {getProductDisplayName(productDatabase[selectedId])}
                </div>
            )}

            {filteredProducts.length === 0 ? (
                <div className="text-xs text-[var(--dim)] mt-2">No products found.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>In Stock</th>
                                <th>Reserved for Projects</th>
                                <th>Total Physical Stocks</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(id => {
                                const p = productDatabase[id];
                                const stock = Number(p.currentQuantity || 0);
                                const reserved = getTotalProjectQuantity(id);
                                const total = stock + reserved;
                                return (
                                    <tr key={id} className={selectedId === id ? 'bg-[rgba(59,130,246,0.1)]' : ''}>
                                        <td>{getProductDisplayName(p)}</td>
                                        <td>{stock.toLocaleString()}</td>
                                        <td>{reserved.toLocaleString()}</td>
                                        <td><b>{total.toLocaleString()}</b></td>
                                        <td>
                                            <button className="btn text-xs py-1" onClick={() => { setSelectedId(id); setStatusMsg(''); }}>Select</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
