import React, { useState, useEffect } from 'react';
import { useInventory } from '../InventoryProvider';

export default function AddEditProductModal({ initialData, onClose }) {
    const { categories, saveProduct, productDatabase } = useInventory();

    // Determine the actual barcode/id if editing
    const existingId = initialData ? (initialData.suffix ? `${initialData.modelNumber}-${initialData.suffix}` : initialData.modelNumber) : '';

    const [formData, setFormData] = useState({
        modelNumber: '',
        suffix: '',
        category: categories.length > 0 ? categories[0] : '',
        location: '',
        barcode: '',
        currentQuantity: 0
    });

    const [errorMsg, setErrorMsg] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                modelNumber: initialData.modelNumber || '',
                suffix: initialData.suffix || '',
                category: initialData.category || categories[0] || '',
                location: initialData.location || '',
                barcode: initialData.barcode || '',
                currentQuantity: initialData.currentQuantity || 0
            });
        }
    }, [initialData, categories]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrorMsg('');
    };

    const handleSave = async () => {
        const { modelNumber, suffix, category, location, barcode, currentQuantity } = formData;

        if (!modelNumber.trim()) {
            setErrorMsg('Model Number is required.');
            return;
        }

        const id = suffix.trim() ? `${modelNumber.trim()}-${suffix.trim()}` : modelNumber.trim();

        // If adding new, check if ID already exists
        if (!initialData && productDatabase[id]) {
            setErrorMsg(`Product with ID ${id} already exists.`);
            return;
        }

        setIsSaving(true);
        try {
            const productToSave = {
                modelNumber: modelNumber.trim(),
                suffix: suffix.trim(),
                category: category || categories[0],
                location: location.trim(),
                barcode: barcode.trim(),
                currentQuantity: Number(currentQuantity) || 0
            };

            await saveProduct(id, productToSave);
            onClose();
        } catch (err) {
            console.error(err);
            setErrorMsg('Failed to save product. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] border border-[#263659] rounded-2xl p-6 w-full max-w-md flex flex-col shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-[#263659] pb-4">
                    <h3 className="text-xl font-bold m-0 text-white">
                        {initialData ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <button className="text-[var(--dim)] hover:text-white transition-colors" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                {errorMsg && <div className="mb-4 text-red-400 font-bold bg-red-400/10 p-2 rounded">{errorMsg}</div>}

                <div className="space-y-4">
                    <div>
                        <label className="label-text block mb-1">Category</label>
                        <select
                            name="category"
                            className="input-field w-full"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            <option value="">-- Select Category --</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label-text block mb-1">Model Number *</label>
                            <input
                                name="modelNumber"
                                className="input-field w-full"
                                placeholder="e.g. ipc-123"
                                value={formData.modelNumber}
                                onChange={handleChange}
                                disabled={!!initialData} // Usually best not to change base ID to avoid orphan records, but optional
                            />
                        </div>
                        <div>
                            <label className="label-text block mb-1">Suffix</label>
                            <input
                                name="suffix"
                                className="input-field w-full"
                                placeholder="e.g. v2"
                                value={formData.suffix}
                                onChange={handleChange}
                                disabled={!!initialData}
                            />
                        </div>
                    </div>
                    {initialData && <p className="text-xs text-[var(--dim)] mt-1">Model and suffix cannot be changed after creation.</p>}

                    <div>
                        <label className="label-text block mb-1">Location</label>
                        <input
                            name="location"
                            className="input-field w-full"
                            placeholder="e.g. Shelf A, Bin 3"
                            value={formData.location}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="label-text block mb-1">Barcode</label>
                        <input
                            name="barcode"
                            className="input-field w-full"
                            placeholder="e.g. 123456789"
                            value={formData.barcode}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="label-text block mb-1">Current Stock Quantity</label>
                        <input
                            name="currentQuantity"
                            type="number"
                            className="input-field w-full opacity-60 bg-gray-800 cursor-not-allowed"
                            value={formData.currentQuantity}
                            disabled={true}
                            title="Stock quantity cannot be edited directly."
                        />
                        <p className="text-xs text-yellow-500/80 mt-1">Note: Stock must be managed via the "Bulk In/Out" tools to maintain transaction history.</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#263659]">
                    <button className="btn btn-secondary px-5" onClick={onClose} disabled={isSaving}>Cancel</button>
                    <button className="btn btn-primary px-5 font-bold" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </div>
        </div>
    );
}
