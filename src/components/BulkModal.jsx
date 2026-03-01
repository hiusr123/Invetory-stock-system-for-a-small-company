import React, { useState } from 'react';
import { useInventory } from '../InventoryProvider';
import { exportBulkTableCSV } from '../utils/exportUtils';

export default function BulkModal({ type, onClose }) {
    const { categories, productDatabase, getProductDisplayName, saveProduct, addTransaction, refreshTransactions } = useInventory();

    const [rows, setRows] = useState([{
        id: Date.now(),
        category: '',
        model: '',
        modelInput: '',
        suffix: '',
        qty: 0,
        location: '',
        barcode: '',
        reason: '',
        poNumber: '',
        date: '',
        isNew: false
    }]);

    const [statusMsg, setStatusMsg] = useState('');
    const [errors, setErrors] = useState({});

    const addRow = () => {
        setRows([...rows, {
            id: Date.now(),
            category: '',
            model: '',
            modelInput: '',
            suffix: '',
            qty: 0,
            location: '',
            barcode: '',
            reason: '',
            poNumber: '',
            date: '',
            isNew: false
        }]);
    };

    const removeRow = (id) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const updateRow = (id, field, value) => {
        setRows(rows.map(r => {
            if (r.id !== id) return r;
            const updated = { ...r, [field]: value };

            // Auto-fill logic when model changes
            if (field === 'model' && value !== '_new' && value !== '') {
                let product = Object.values(productDatabase).find(p => getProductDisplayName(p) === value);
                if (!product) {
                    const baseModel = value.split('-')[0];
                    product = Object.values(productDatabase).find(p => p.modelNumber === baseModel && (!p.suffix || p.suffix === ''));
                }
                if (product) {
                    updated.location = product.location || '';
                    updated.barcode = product.barcode || '';
                } else {
                    updated.location = '';
                    updated.barcode = '';
                }
                updated.isNew = false;
            } else if (field === 'model' && value === '_new') {
                updated.isNew = true;
                updated.model = ''; // Reset select value if handled dynamically below
                updated.location = '';
                updated.barcode = '';
                updated.suffix = '';
            }

            return updated;
        }));
        setErrors(prev => ({ ...prev, [id]: null })); // clear error for row
    };

    const validateAndSave = async () => {
        if (rows.length === 0) {
            alert('Add at least one row.');
            return;
        }

        let hasErrors = false;
        const newErrors = {};

        rows.forEach(r => {
            const actualModel = r.isNew ? r.modelInput.trim() : r.model.trim();
            if (!actualModel || r.qty <= 0) {
                newErrors[r.id] = {
                    model: !actualModel ? 'Required' : null,
                    qty: r.qty <= 0 ? 'Must be > 0' : null
                };
                hasErrors = true;
            }

            if (type === 'out') {
                const id = r.suffix ? `${actualModel}-${r.suffix}` : actualModel;
                const p = productDatabase[id];
                const stockQty = Number(p?.currentQuantity || 0);
                if (r.qty > stockQty) {
                    newErrors[r.id] = { ...newErrors[r.id], qty: `Only ${stockQty} available` };
                    hasErrors = true;
                }
            }
        });

        if (hasErrors) {
            setErrors(newErrors);
            setStatusMsg('Please fix errors or check stock.');
            return;
        }

        // Save
        setStatusMsg(`Saving ${rows.length} rows to Cloud...`);
        try {
            let count = 0;
            const txBatch = [];

            for (const r of rows) {
                const actualModel = r.isNew ? r.modelInput.trim() : r.model.trim();
                const id = r.suffix ? `${actualModel}-${r.suffix}` : actualModel;

                let p = { ...productDatabase[id] };
                if (!p || Object.keys(p).length === 0) {
                    p = {
                        modelNumber: actualModel,
                        suffix: r.suffix,
                        category: r.category,
                        location: r.location,
                        barcode: r.barcode || id,
                        currentQuantity: 0
                    };
                }

                const qty = Number(r.qty);
                if (type === 'in') p.currentQuantity = (Number(p.currentQuantity) || 0) + qty;
                else p.currentQuantity = (Number(p.currentQuantity) || 0) - qty;

                // Upsert Product
                await saveProduct(id, p);

                // Prep Transaction
                txBatch.push({
                    productId: id,
                    displayName: `${p.modelNumber}${p.suffix ? '-' + p.suffix : ''}`,
                    stockChange: type === 'in' ? qty : -qty,
                    stockAfter: p.currentQuantity,
                    reason: r.reason || `Bulk ${type}`,
                    poNumber: r.poNumber || '',
                    project: '',
                    projectAction: type.toUpperCase(),
                    when: r.date ? new Date(r.date).toISOString() : new Date().toISOString()
                });

                count++;
            }

            // Process Transactions
            for (const tx of txBatch) {
                await addTransaction(tx);
            }

            await refreshTransactions();

            setStatusMsg(`Cloud Synced: Saved ${count} rows.`);
            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (err) {
            console.error(err);
            setStatusMsg('Error saving to cloud');
        }
    };

    const handleExport = () => {
        exportBulkTableCSV(rows, type);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] border border-[#263659] rounded-2xl p-4 w-full max-w-[1200px] max-h-[90vh] overflow-auto flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold m-0">Bulk {type === 'in' ? 'In' : 'Out'} Stock</h3>
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>

                {statusMsg && <div className="mb-4 text-yellow-400 font-bold">{statusMsg}</div>}

                <div className="overflow-x-auto mb-4 flex-grow">
                    <table className="table-base w-full whitespace-nowrap">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th className="min-w-[150px]">Model</th>
                                <th>Suffix</th>
                                <th>Qty</th>
                                <th>Location</th>
                                <th>Barcode</th>
                                <th>ProjectCode</th>
                                <th>PO Number</th>
                                <th>Date</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => {
                                const modelOptions = Object.values(productDatabase)
                                    .filter(p => !r.category || p.category === r.category)
                                    .map(p => getProductDisplayName(p))
                                    .sort();
                                const err = errors[r.id] || {};

                                return (
                                    <tr key={r.id}>
                                        <td>
                                            <select className="input-field p-1" value={r.category} onChange={e => updateRow(r.id, 'category', e.target.value)}>
                                                <option value="">-- Select --</option>
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            {!r.isNew ? (
                                                <select className={`input-field p-1 ${err.model ? 'border-red-500' : ''}`} value={r.model} onChange={e => updateRow(r.id, 'model', e.target.value)}>
                                                    <option value="">-- Select Model --</option>
                                                    <option value="_new">➕ Create New</option>
                                                    {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <input className={`input-field p-1 ${err.model ? 'border-red-500' : ''}`} placeholder="Model" value={r.modelInput} onChange={e => updateRow(r.id, 'modelInput', e.target.value)} />
                                                    <button className="text-xs px-1 hover:text-red-400" onClick={() => updateRow(r.id, 'isNew', false)} title="Cancel">✖</button>
                                                </div>
                                            )}
                                        </td>
                                        <td><input className="input-field p-1 w-[80px]" placeholder="Suffix" value={r.suffix} onChange={e => updateRow(r.id, 'suffix', e.target.value)} /></td>
                                        <td><input type="number" className={`input-field p-1 w-[80px] ${err.qty ? 'border-red-500' : ''}`} title={err.qty} min="0" value={r.qty} onChange={e => updateRow(r.id, 'qty', e.target.value)} /></td>
                                        <td><input className="input-field p-1 w-[120px]" placeholder="Location" value={r.location} onChange={e => updateRow(r.id, 'location', e.target.value)} /></td>
                                        <td><input className="input-field p-1 w-[120px]" placeholder="Barcode" value={r.barcode} onChange={e => updateRow(r.id, 'barcode', e.target.value)} /></td>
                                        <td><input className="input-field p-1 w-[120px]" placeholder="ProjectCode" value={r.reason} onChange={e => updateRow(r.id, 'reason', e.target.value)} /></td>
                                        <td><input className="input-field p-1 w-[120px]" placeholder="PO" value={r.poNumber} onChange={e => updateRow(r.id, 'poNumber', e.target.value)} /></td>
                                        <td><input type="date" className="input-field p-1" value={r.date} onChange={e => updateRow(r.id, 'date', e.target.value)} /></td>
                                        <td>
                                            <button className="btn btn-secondary text-xs px-2" onClick={() => removeRow(r.id)}>✖</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={addRow}>+ Add Row</button>
                    <button className="btn" onClick={handleExport}>📤 Export to CSV</button>
                    <button className={`btn ${type === 'in' ? 'btn-primary' : 'btn-danger'} font-bold px-6`} onClick={validateAndSave}>Save All</button>
                </div>
            </div>
        </div>
    );
}
