import React, { useState, useMemo } from 'react';
import { useInventory } from '../InventoryProvider';

export default function TransactionsTab() {
    const { transactions, getProductDisplayName, productDatabase } = useInventory();
    const [poFilter, setPoFilter] = useState('');
    const [modelFilter, setModelFilter] = useState('');

    const filtered = useMemo(() => {
        return transactions.filter(tx => {
            const txPo = (tx.poNumber || tx.ref || '').toLowerCase();
            // Resolve product name from ID if needed, or use displayName
            let txName = (tx.displayName || tx.productId || '').toLowerCase();

            const p = productDatabase[tx.productId];
            if (p) {
                txName += ` ${getProductDisplayName(p).toLowerCase()}`;
            }

            if (poFilter && !txPo.includes(poFilter.toLowerCase())) return false;
            if (modelFilter && !txName.includes(modelFilter.toLowerCase())) return false;
            return true;
        });
    }, [transactions, poFilter, modelFilter, productDatabase, getProductDisplayName]);

    const handleExport = () => {
        import('../utils/exportUtils').then(module => {
            module.exportTransactionsCSV(transactions);
        });
    };

    return (
        <div className="card mt-3">
            <div className="flex flex-wrap gap-2 mb-2">
                <div className="flex-1 min-w-[220px]">
                    <label className="label-text">Filter by PO</label>
                    <input
                        className="input-field"
                        placeholder="Type PO number..."
                        value={poFilter}
                        onChange={e => setPoFilter(e.target.value)}
                    />
                </div>
                <div className="flex-1 min-w-[220px]">
                    <label className="label-text">Filter by model</label>
                    <input
                        className="input-field"
                        placeholder="Type model..."
                        value={modelFilter}
                        onChange={e => setModelFilter(e.target.value)}
                    />
                </div>
                <div className="flex-1 min-w-[160px] flex items-end">
                    <button className="btn w-full" onClick={handleExport}>📤 Export CSV</button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-xs text-[var(--dim)] mt-4">No transactions found.</div>
            ) : (
                <div className="overflow-x-auto mt-4">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Change</th>
                                <th>After</th>
                                <th>Project</th>
                                <th>Action</th>
                                <th>PO</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((tx, idx) => {
                                const dt = new Date(tx.when);
                                const product = tx.displayName || tx.productId || 'Unknown';
                                const change = tx.stockChange || 0;

                                return (
                                    <tr key={idx}>
                                        <td>{dt.toLocaleString()}</td>
                                        <td>{product}</td>
                                        <td>{change > 0 ? '+' : ''}{change}</td>
                                        <td>{tx.stockAfter !== undefined && tx.stockAfter !== null ? tx.stockAfter : '-'}</td>
                                        <td>{tx.project || ''}</td>
                                        <td>{tx.projectAction || ''}</td>
                                        <td>{tx.poNumber || tx.ref || ''}</td>
                                        <td>{tx.reason || ''}</td>
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
