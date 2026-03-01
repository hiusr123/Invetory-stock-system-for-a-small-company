import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, initSupabase } from './supabaseClient';

const InventoryContext = createContext(null);

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
    const [productDatabase, setProductDatabase] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [projectAllocations, setProjectAllocations] = useState({});
    const [categories, setCategories] = useState(['Default']);
    const [isReady, setIsReady] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('Initializing...');
    const [errorMsg, setErrorMsg] = useState('');

    // Setup prompt logic
    useEffect(() => {
        if (!supabase) {
            const url = prompt('Setup: Paste your Supabase URL');
            const key = prompt('Setup: Paste your Supabase Anon Key');
            if (url && key) {
                localStorage.setItem('MY_PRIVATE_URL', url.replace(/\/$/, ""));
                localStorage.setItem('MY_PRIVATE_KEY', key);
                initSupabase(url.replace(/\/$/, ""), key);
                window.location.reload();
            } else {
                setErrorMsg('Supabase URL and Key are required. Please refresh and try again.');
            }
        }
    }, []);

    const getProductId = (p) => {
        const model = (p.modelNumber || '').trim();
        const suffix = (p.suffix || '').trim();
        return suffix ? `${model}-${suffix}` : model;
    };

    const getProductDisplayName = (p) => {
        const model = p?.modelNumber || 'Unknown';
        const suffix = p?.suffix ? `-${p.suffix}` : '';
        return model + suffix;
    };

    const fetchCloudData = async () => {
        if (!supabase) return;
        try {
            setLoadingMsg('Full Cloud Sync...');

            const { data: prods, error: prodErr } = await supabase.from('products').select('*');
            if (prodErr) throw prodErr;
            const pObj = {};
            if (Array.isArray(prods)) {
                prods.forEach(p => {
                    const id = p.suffix ? `${p.modelNumber}-${p.suffix}` : p.modelNumber;
                    pObj[id || p.barcode] = p;
                });
            }

            const { data: txs, error: txErr } = await supabase.from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);
            if (txErr) throw txErr;

            const { data: sets, error: setErr } = await supabase.from('settings').select('*');
            if (setErr) throw setErr;

            let cats = ['Default'];
            let projs = {};
            sets?.forEach(s => {
                if (s.key === 'categories') cats = s.value || ['Default'];
                if (s.key === 'project_allocations') projs = s.value || {};
            });

            setProductDatabase(pObj);
            setTransactions(
                txs.map(t => ({
                    productId: t.modelNumber, // Maps legacy columns if needed, though supabase structure might prefer standard
                    stockChange: t.stock_change,
                    reason: t.reason,
                    when: t.created_at,
                    ref: t.ref,
                    displayName: t.displayName,
                    stockAfter: t.stockAfter !== undefined ? t.stockAfter : t.stock_after,
                    project: t.project,
                    projectAction: t.projectAction,
                    poNumber: t.poNumber || t.po_number
                }))
            );
            setCategories(cats);
            setProjectAllocations(projs);

            setLoadingMsg('');
            setIsReady(true);
        } catch (err) {
            console.error('Initial Fetch Error:', err);
            setErrorMsg('Failed to fetch from Cloud');
        }
    };

    useEffect(() => {
        fetchCloudData();
    }, []);

    const refreshTransactions = async () => {
        const { data: txs } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(1000);
        if (txs) {
            setTransactions(
                txs.map(t => ({
                    productId: t.modelNumber,
                    stockChange: t.stock_change,
                    reason: t.reason,
                    when: t.created_at,
                    ref: t.ref,
                    displayName: t.displayName,
                    stockAfter: t.stockAfter !== undefined ? t.stockAfter : t.stock_after,
                    project: t.project,
                    projectAction: t.projectAction,
                    poNumber: t.poNumber || t.po_number
                }))
            );
        }
    };

    const saveProduct = async (id, product) => {
        // using onConflict logic matching isUpsert
        const { error } = await supabase.from('products').upsert({ barcode: id, ...product }, { onConflict: 'barcode' });
        if (error) throw error;
        setProductDatabase(prev => ({ ...prev, [id]: product }));
    };

    const deleteProductByModel = async (modelNum) => {
        const { error } = await supabase.from('products').delete().eq('modelNumber', modelNum);
        if (error) throw error;
    };

    const addTransaction = async (tx) => {
        const dbTx = {
            barcode: tx.productId,
            stock_change: tx.stockChange,
            reason: tx.reason,
            ref: tx.ref || tx.poNumber || "",
            created_at: tx.when || new Date().toISOString(),
            displayName: tx.displayName || "",
            stockAfter: Number(tx.stockAfter) || 0,
            project: tx.project || "",
            projectAction: tx.projectAction || "",
            poNumber: tx.poNumber || ""
        };
        const { error } = await supabase.from('transactions').insert(dbTx);
        if (error) throw error;
    };

    const saveAllProjects = async (projectsObj) => {
        const { error } = await supabase.from('settings').upsert({ key: 'project_allocations', value: projectsObj }, { onConflict: 'key' });
        if (error) throw error;
        setProjectAllocations(projectsObj);
    };

    const saveCategories = async (catArray) => {
        const { error } = await supabase.from('settings').upsert({ key: 'categories', value: catArray }, { onConflict: 'key' });
        if (error) throw error;
        setCategories(catArray);
    };

    const resetKeys = () => {
        localStorage.clear();
        window.location.reload();
    };

    const value = {
        productDatabase,
        transactions,
        projectAllocations,
        categories,
        getProductId,
        getProductDisplayName,
        saveProduct,
        deleteProductByModel,
        addTransaction,
        saveAllProjects,
        saveCategories,
        resetKeys,
        refreshTransactions,
        setProductDatabase,
        setTransactions,
        fetchCloudData
    };

    if (errorMsg) {
        return <div className="p-4 text-red-500 card m-4">{errorMsg} <button className="btn ml-4" onClick={() => window.location.reload()}>Retry</button></div>;
    }

    if (!isReady) {
        return <div className="p-4 card m-4 text-white animate-pulse">{loadingMsg}</div>;
    }

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
};
