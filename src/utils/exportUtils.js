/** Native browser file save */
const saveAs = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Ensures a valid CSV string even if there are quotes or commas
 */
export const escapeCSV = (value) => {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Export products to CSV
 * uses modelNumber heavily
 */
export const exportProductsCSV = (productDatabase, projectAllocations) => {
    const keys = Object.keys(productDatabase).sort();
    const header = 'productId,modelNumber,suffix,category,location,barcode,stock,reserved,totalPhysical,description\n';

    const rows = keys.map(id => {
        const p = productDatabase[id];
        const stock = Number(p.currentQuantity || 0);
        // Calc reserved
        let reserved = 0;
        const map = projectAllocations[id] || {};
        for (const k in map) reserved += Number(map[k] || 0);

        const total = stock + reserved;

        return [
            id,
            p.modelNumber || '',
            p.suffix || '',
            p.category || '',
            p.location || '',
            p.barcode || '',
            stock,
            reserved,
            total,
            p.description || ''
        ].map(escapeCSV).join(',');
    });

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'products.csv');
};

/**
 * Export transactions to CSV
 */
export const exportTransactionsCSV = (transactions) => {
    const header = 'date,product,change,after,project,action,po,ProjectCode\n';
    const rows = transactions.map(tx => {
        return [
            new Date(tx.when).toISOString(),
            tx.displayName || tx.productId,
            tx.stockChange,
            tx.stockAfter,
            tx.project || '',
            tx.projectAction || '',
            tx.poNumber || '',
            tx.reason || ''
        ].map(escapeCSV).join(',');
    });

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'transactions.csv');
};

/**
 * Export PO Overview
 */
export const exportPOOverviewCSV = (transactions, searchPO) => {
    const list = transactions.filter(tx => (tx.poNumber || tx.po_number || tx.ref || '').toLowerCase().includes(searchPO.toLowerCase()));
    const header = 'poNumber,date,product,qty,stockAfter,ProjectCode\n';
    const rows = list.map(tx => {
        return [
            tx.poNumber || tx.po_number || tx.ref || '',
            new Date(tx.when || tx.created_at).toISOString(),
            tx.displayName || tx.productId,
            (tx.stock_change !== undefined) ? tx.stock_change : (tx.stockChange || 0),
            tx.stockAfter,
            tx.reason || ''
        ].map(escapeCSV).join(',');
    });

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'po-overview.csv');
};

/**
 * Export selected project
 */
export const exportSelectedProjectCSV = (projectAllocations, productDatabase, selectedProject) => {
    if (!selectedProject) return;
    const header = 'project,productId,displayName,barcode,modelNumber,allocatedQuantity,stockQuantity,category,location,description\n';
    const rows = [];

    for (const productId in projectAllocations) {
        const map = projectAllocations[productId] || {};
        const qty = Number(map[selectedProject] || 0);
        if (!qty) continue;

        const p = productDatabase[productId] || {};
        const displayName = p.modelNumber ? `${p.modelNumber}${p.suffix ? '-' + p.suffix : ''}` : productId;

        rows.push([
            selectedProject,
            productId,
            displayName,
            p.barcode || '',
            p.modelNumber || '',
            qty,
            Number(p.currentQuantity || 0),
            p.category || '',
            p.location || '',
            p.description || ''
        ].map(escapeCSV).join(','));
    }

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${selectedProject}-project-report.csv`);
};

/**
 * Export all projects and their allocations to CSV
 */
export const exportProjectsCSV = (projectAllocations) => {
    const header = 'productId,project,allocatedQuantity\n';
    const rows = [];

    const productIds = Object.keys(projectAllocations).sort();
    for (const productId of productIds) {
        const map = projectAllocations[productId] || {};
        for (const project in map) {
            const qty = Number(map[project] || 0);
            if (qty > 0) {
                rows.push([
                    productId,
                    project,
                    qty
                ].map(escapeCSV).join(','));
            }
        }
    }

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'all-project-allocations.csv');
};

export const exportTotalStockCSV = (productDatabase, projectAllocations) => {
    const keys = Object.keys(productDatabase).sort();
    const header = 'productId,modelNumber,barcode,category,stock,reserved,totalPhysical\n';

    const rows = keys.map(id => {
        const p = productDatabase[id];
        const stock = Number(p.currentQuantity || 0);
        // Calc reserved
        let reserved = 0;
        const map = projectAllocations[id] || {};
        for (const k in map) reserved += Number(map[k] || 0);

        const total = stock + reserved;

        return [
            id,
            p.modelNumber || '',
            p.barcode || '',
            p.category || '',
            stock,
            reserved,
            total
        ].map(escapeCSV).join(',');
    });

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'total-stock-list.csv');
};

export const exportBulkTableCSV = (rows, type) => {
    const header = 'model,category,suffix,qty,location,barcode,remark,poNumber,date\n';
    const lines = rows.map(r => {
        return [
            r.model,
            r.category,
            r.suffix,
            r.qty,
            r.location,
            r.barcode,
            r.reason,
            r.poNumber,
            r.date
        ].map(escapeCSV).join(',');
    });
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `bulk-${type}-preview.csv`);
};
