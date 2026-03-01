import React, { useState } from 'react';
import { useInventory } from '../InventoryProvider';

export default function SearchProjectCodeModal({ onClose }) {
    const { transactions, productDatabase, getProductDisplayName } = useInventory();
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState(null);

    const handleSearch = () => {
        const kw = keyword.trim().toLowerCase();
        if (!kw) {
            alert("Enter a remark or project code to search");
            return;
        }

        const filtered = transactions.filter(tx =>
            (tx.reason || '').toLowerCase().includes(kw) ||
            (tx.ref || '').toLowerCase().includes(kw) ||
            (tx.project || '').toLowerCase().includes(kw) ||
            (tx.poNumber || '').toLowerCase().includes(kw)
        );

        setResults(filtered);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--card)] border border-[#263659] rounded-2xl p-4 w-full max-w-[800px] max-h-[90vh] overflow-auto flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold m-0">Search Transactions by ProjectCode</h3>
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        className="input-field flex-grow"
                        placeholder="Enter remark, PO, ProjectCode keyword..."
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <button className="btn btn-primary px-6" onClick={handleSearch}>Search</button>
                </div>

                {results && results.length === 0 && (
                    <div className="text-yellow-400">No transactions found with that remark.</div>
                )}

                {results && results.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="table-base w-full">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Model</th>
                                    <th>Category</th>
                                    <th>Qty</th>
                                    <th>ProjectCode/Remark</th>
                                    <th>Ref/PO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((tx, idx) => {
                                    const p = productDatabase[tx.productId];
                                    return (
                                        <tr key={idx}>
                                            <td>{tx.when ? new Date(tx.when).toLocaleString() : ''}</td>
                                            <td>{tx.displayName || (p?.modelNumber ? getProductDisplayName(p) : tx.productId)}</td>
                                            <td>{p?.category || ''}</td>
                                            <td>{tx.stockChange > 0 ? '+' + tx.stockChange : tx.stockChange}</td>
                                            <td>{tx.reason || tx.project || ''}</td>
                                            <td>{tx.ref || tx.poNumber || ''}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
