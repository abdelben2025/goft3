
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Page, Operation, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import { useLanguage } from '../context/LanguageContext';
import PageWrapper from '../components/PageWrapper';
import Card from '../components/Card';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddOperationForm from '../components/forms/AddOperationForm';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';
import ExcelJS from 'exceljs';
import { Search, X } from 'lucide-react';
import OperationRow from '../components/OperationRow';

interface OperationsPageProps {
    navigate: (page: Page, operationId?: number) => void;
    onGoBack?: () => void;
    onUpdateUser: (user: User) => void;
    currentUser: User;
}

const OperationsPage: React.FC<OperationsPageProps> = ({ navigate, onGoBack, onUpdateUser, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteOperation, runInTransaction } = useData();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOperation, setEditingOperation] = useState<Operation | undefined>(undefined);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [selectedOperationId, setSelectedOperationId] = useState<number | null>(null);
    const [formKey, setFormKey] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isViewer = currentUser.ROLE === 'viewer';

    const availableYears = useMemo(() => {
        const years = new Set(db.T_CP.map(cp => cp.ANNEE));
        const currentYearStr = new Date().getFullYear().toString();
        if (!years.has(currentYearStr)) {
            years.add(currentYearStr);
        }
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [db.T_CP]);

    const [selectedYear, setSelectedYear] = useState<string>(() => sessionStorage.getItem('goft3_selectedYear') || availableYears[0] || new Date().getFullYear().toString());
    const [selectedActivity, setSelectedActivity] = useState<string>(() => sessionStorage.getItem('goft3_selectedActivity') || '');
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('goft3_searchQuery') || '');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
    const [showSearchQuery, setShowSearchQuery] = useState(() => !!sessionStorage.getItem('goft3_searchQuery'));

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const [visibleCount, setVisibleCount] = useState(200);
    const [selectedStatus, setSelectedStatus] = useState<string>(() => sessionStorage.getItem('goft3_selectedStatus') || 'all');
    const [selectedTypeOp, setSelectedTypeOp] = useState<string>(() => sessionStorage.getItem('goft3_selectedTypeOp') || 'all');

    useEffect(() => {
        sessionStorage.setItem('goft3_selectedYear', selectedYear);
        sessionStorage.setItem('goft3_selectedActivity', selectedActivity);
        sessionStorage.setItem('goft3_searchQuery', searchQuery);
        sessionStorage.setItem('goft3_selectedStatus', selectedStatus);
        sessionStorage.setItem('goft3_selectedTypeOp', selectedTypeOp);
    }, [selectedYear, selectedActivity, searchQuery, selectedStatus, selectedTypeOp]);

    const activities = useMemo(() => {
        const activityMap = new Map<string, string>();
        db.T_DIRECTION.forEach(d => {
            if (d.ACTION && d.INT_ACTION && !activityMap.has(d.ACTION)) {
                activityMap.set(d.ACTION, d.INT_ACTION);
            }
        });
        const operationActivityCodes = [...new Set(db.T_OPERATION.map(op => op.N_OPERATION.split('.')[5]).filter(Boolean))];
        return operationActivityCodes.map((code: string) => {
            const name = activityMap.get(code) || `(${code})`;
            return {
                code,
                name,
                value: code,
                label: `${code} - ${name}`
            };
        }).sort((a, b) => a.code.localeCompare(b.code));
    }, [db.T_DIRECTION, db.T_OPERATION]);

    const uniqueTypeOps = useMemo(() => {
        const types = new Set<string>();
        db.T_OPERATION.forEach(op => {
            if (op.TYPE_OP) {
                types.add(op.TYPE_OP);
            }
        });
        
        const stored = localStorage.getItem('goft3_operation_types');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as string[];
                parsed.forEach(t => types.add(t));
            } catch (e) {
                console.error("Error parsing stored operation types", e);
            }
        }
        
        return Array.from(types).sort();
    }, [db.T_OPERATION]);

    const summary = useMemo(() => {
        if (loading) return { totalAE: 0, totalEngagements: 0, totalPaiements: 0, totalCPCurrentYear: 0, activitySummary: '---', programSummary: '---', sprogramSummary: '---' };
        
        const openOperations = db.T_OPERATION.filter(op => {
            // Authorization Check
            if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
                try {
                    const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                    if (allowedOps.length > 0 && !allowedOps.includes(op.ID_OPERATION)) {
                        return false;
                    }
                } catch (e) {
                    console.error("Auth check error:", e);
                }
            }

            if (op.status !== 'جارية') return false;
            if (selectedActivity) {
                if (op.N_OPERATION.split('.')[5] !== selectedActivity) return false;
            }
            if (debouncedSearchQuery) {
                const query = debouncedSearchQuery.toLowerCase();
                if (!op.N_OPERATION.toLowerCase().includes(query) && !op.INT_OPERATION.toLowerCase().includes(query)) return false;
            }
            return true;
        });
        const openOperationIds = new Set(openOperations.map(op => op.ID_OPERATION));

        const totalAE = db.T_RUBRIQUE_OP.filter(item => openOperationIds.has(item.ID_OPERATION)).reduce((sum, item) => sum + (item.MONTANT_FINALE ?? item.MONTANT_INITIALE), 0);
        const totalEngagements = db.T_ENGAGEMENT.filter(eng => openOperationIds.has(eng.ID_OPERATION) && (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'سحب') && parseInt(eng.ANNEE) <= parseInt(selectedYear)).reduce((sum, item) => sum + item.MONTANT_ENG, 0);
        const totalPaiements = db.T_PAIEMENT.filter(pai => openOperationIds.has(pai.ID_OPERATION) && parseInt(pai.ANNEE) <= parseInt(selectedYear)).reduce((sum, item) => sum + item.MONTANT_PAI, 0);
        const totalCPCurrentYear = db.T_CP.filter(cp => openOperationIds.has(cp.ID_OPERATION) && cp.ANNEE === selectedYear).reduce((sum, item) => sum + item.MONTANT_FINALE_CP, 0);

        // Advanced Logic for counts based on mask: N.1.2.3.4.5... (parts index 3=Prog, 4=SProg, 5=Activity)
        const actGroups: Record<string, number> = {};
        const prgGroups: Record<string, number> = {};
        const sprGroups: Record<string, number> = {};

        openOperations.forEach(op => {
            const parts = op.N_OPERATION.split('.');
            const prg = parts[3] || '---';
            const spr = parts[4] || '---';
            const act = parts[5] || '---';

            actGroups[act] = (actGroups[act] || 0) + 1;
            prgGroups[prg] = (prgGroups[prg] || 0) + 1;
            sprGroups[spr] = (sprGroups[spr] || 0) + 1;
        });

        // 1. Activity Text
        let activitySummary = '';
        if (selectedActivity) {
            activitySummary = `النشاط ${selectedActivity}: ${actGroups[selectedActivity] || 0} عملية`;
        } else {
            // Find activity with most operations for preview or generic total
            const topAct = Object.entries(actGroups).sort((a,b) => b[1] - a[1])[0];
            activitySummary = topAct ? `النشاط ${topAct[0]}: ${topAct[1]} عملية` : '0 عمليات';
        }

        // 2. Program Text
        const topPrg = Object.entries(prgGroups).sort((a,b) => b[1] - a[1])[0];
        const programSummary = topPrg ? `البرنامج ${topPrg[0]}: ${topPrg[1]} عملية` : '0 عمليات';

        // 3. Sub-Program Text (List top 3 if multiple exist)
        const spEntries = Object.entries(sprGroups).sort((a,b) => a[0].localeCompare(b[0])).slice(0, 3);
        const sprogramSummary = spEntries.length > 0 
            ? spEntries.map(e => `${e[0]} به ${e[1]}`).join(' | ') 
            : '0 عمليات';

        return { 
            totalAE, 
            totalEngagements, 
            totalPaiements, 
            totalCPCurrentYear,
            activitySummary,
            programSummary,
            sprogramSummary
        };
    }, [db, loading, selectedYear, selectedActivity, debouncedSearchQuery, currentUser.ROLE, currentUser.ALLOWED_OPERATIONS]);

    const engGroups = useMemo(() => {
        const map = new Map<number, typeof db.T_ENGAGEMENT>();
        db.T_ENGAGEMENT.forEach(eng => {
            const list = map.get(eng.ID_OPERATION) || [];
            list.push(eng);
            map.set(eng.ID_OPERATION, list);
        });
        return map;
    }, [db.T_ENGAGEMENT]);

    const paiGroups = useMemo(() => {
        const map = new Map<number, typeof db.T_PAIEMENT>();
        db.T_PAIEMENT.forEach(pai => {
            const list = map.get(pai.ID_OPERATION) || [];
            list.push(pai);
            map.set(pai.ID_OPERATION, list);
        });
        return map;
    }, [db.T_PAIEMENT]);

    const cpGroups = useMemo(() => {
        const map = new Map<number, typeof db.T_CP>();
        db.T_CP.forEach(cp => {
            const list = map.get(cp.ID_OPERATION) || [];
            list.push(cp);
            map.set(cp.ID_OPERATION, list);
        });
        return map;
    }, [db.T_CP]);

    const rubOpGroups = useMemo(() => {
        const map = new Map<number, typeof db.T_RUBRIQUE_OP>();
        db.T_RUBRIQUE_OP.forEach(rop => {
            const list = map.get(rop.ID_OPERATION) || [];
            list.push(rop);
            map.set(rop.ID_OPERATION, list);
        });
        return map;
    }, [db.T_RUBRIQUE_OP]);

    const scatOpGroups = useMemo(() => {
        const map = new Map<number, typeof db.T_SCATEGORIE_OP>();
        db.T_SCATEGORIE_OP.forEach(sop => {
            const list = map.get(sop.ID_OPERATION) || [];
            list.push(sop);
            map.set(sop.ID_OPERATION, list);
        });
        return map;
    }, [db.T_SCATEGORIE_OP]);

    const operationStartYears = useMemo(() => {
        const map = new Map<number, number>();
        db.T_ENGAGEMENT.forEach(item => {
            const year = parseInt(item.ANNEE);
            if (!isNaN(year)) {
                const existingMinYear = map.get(item.ID_OPERATION);
                if (!existingMinYear || year < existingMinYear) map.set(item.ID_OPERATION, year);
            }
        });
        db.T_CP.forEach(item => {
            const year = parseInt(item.ANNEE);
            if (!isNaN(year)) {
                const existingMinYear = map.get(item.ID_OPERATION);
                if (!existingMinYear || year < existingMinYear) map.set(item.ID_OPERATION, year);
            }
        });
        return map;
    }, [db.T_ENGAGEMENT, db.T_CP]);

    const calculatedOperations = useMemo(() => {
        const selYearInt = parseInt(selectedYear);

        return db.T_OPERATION.filter(op => {
            const startYear = operationStartYears.get(op.ID_OPERATION);
            if (startYear && startYear > selYearInt) return false;

            // Authorization
            if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
                try {
                    const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                    if (allowedOps.length > 0 && !allowedOps.includes(op.ID_OPERATION)) return false;
                } catch (e) {
                    console.error("Error parsing allowed operations", e);
                }
            }
            
            if (debouncedSearchQuery) {
                const query = debouncedSearchQuery.toLowerCase();
                if (!op.N_OPERATION.toLowerCase().includes(query) && !op.INT_OPERATION.toLowerCase().includes(query)) return false;
            }
            
            if (selectedStatus !== 'all' && op.status !== selectedStatus) {
                return false;
            }
            
            if (selectedTypeOp !== 'all' && op.TYPE_OP !== selectedTypeOp) {
                return false;
            }
            
            return true;
        }).map(op => {
            const opEngs = engGroups.get(op.ID_OPERATION) || [];
            const opPais = paiGroups.get(op.ID_OPERATION) || [];
            const opCps = cpGroups.get(op.ID_OPERATION) || [];
            const opRops = rubOpGroups.get(op.ID_OPERATION) || [];
            const opScatOps = scatOpGroups.get(op.ID_OPERATION) || [];

            const aeFinale = opRops.reduce((sum, item) => sum + (item.MONTANT_FINALE ?? item.MONTANT_INITIALE), 0);
            
            const totalEngagements = opEngs
                .filter(eng => (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'سحب') && parseInt(eng.ANNEE) <= selYearInt)
                .reduce((sum, item) => sum + item.MONTANT_ENG, 0);
            
            const totalEngagementsCurrentYear = opEngs
                .filter(eng => (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'سحب') && eng.ANNEE === selectedYear)
                .reduce((sum, item) => sum + item.MONTANT_ENG, 0);
            
            const totalPaiements = opPais
                .filter(pai => parseInt(pai.ANNEE) <= selYearInt)
                .reduce((sum, item) => sum + item.MONTANT_PAI, 0);
            
            const cpFinaleCurrentYear = opCps
                .filter(cp => cp.ANNEE === selectedYear)
                .reduce((sum, item) => sum + item.MONTANT_FINALE_CP, 0);
            
            const paiementsCurrentYear = opPais
                .filter(pai => pai.ANNEE === selectedYear)
                .reduce((sum, item) => sum + item.MONTANT_PAI, 0);

            const remainingAE = aeFinale - totalEngagements;
            const remainingCP = cpFinaleCurrentYear - paiementsCurrentYear;
            const opStartYear = operationStartYears.get(op.ID_OPERATION) || 9999;

            const cat = db.T_CATEGORIE.find(c => c.ID_CATEGORIE === op.ID_CATEGORIE);
            const scatId = op.ID_SCATEGORIE || opScatOps[0]?.ID_SCATEGORIE; // Use ScatOps as fallback if op.ID_SCATEGORIE is missing
            const scat = scatId ? db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === scatId) : null;

            return { 
                ...op, 
                aeFinale, totalEngagements, totalEngagementsCurrentYear, remainingAE, 
                totalPaiements, cpFinaleCurrentYear, paiementsCurrentYear, remainingCP, 
                opStartYear, 
                catCode: cat?.C_CATEGORIE || 'NO_CAT', catInt: cat?.INT_CATEGORIE || 'بدون صنف',
                scatCode: scat?.C_SCATEGORIE || 'NO_SCAT', scatInt: scat?.INT_SCATEGORIE || 'غير موزع'
            };
        }).sort((a, b) => {
            const partsA = a.N_OPERATION.split('.');
            const partsB = b.N_OPERATION.split('.');
            let cmp = a.catCode.localeCompare(b.catCode, undefined, { numeric: true });
            if (cmp !== 0) return cmp;
            cmp = a.scatCode.localeCompare(b.scatCode, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            // Sort by operation type (TYPE_OP) - non-empty first, then alphabetically in Arabic
            const typeA = a.TYPE_OP || '';
            const typeB = b.TYPE_OP || '';
            if (typeA && !typeB) return -1;
            if (!typeA && typeB) return 1;
            cmp = typeA.localeCompare(typeB, 'ar', { numeric: true });
            if (cmp !== 0) return cmp;

            for (let i of [5, 3, 4, 8, 9]) {
                const valA = partsA[i] || '';
                const valB = partsB[i] || '';
                let cmp = valA.localeCompare(valB, undefined, { numeric: true });
                if (cmp !== 0) return cmp;
            }
            return 0;
        });
    }, [db, selectedYear, debouncedSearchQuery, selectedStatus, selectedTypeOp, currentUser.ROLE, currentUser.ALLOWED_OPERATIONS]);


    const displayData = useMemo(() => {
        const filteredOps = calculatedOperations.filter(op => !selectedActivity || op.N_OPERATION.split('.')[5] === selectedActivity);
        if (!filteredOps.length) return { rows: [], grandTotal: null };

        // Group by Category -> Sub-category -> Program -> Sub-program
        const grouped = filteredOps.reduce((acc, op) => {
            const parts = op.N_OPERATION.split('.');
            const catCode = op.catCode || 'NO_CAT';
            const scatCode = op.scatCode || 'NO_SCAT';
            const prgCode = parts[3] || '---';
            const sprgCode = parts[4] || '---';

            if (!acc[catCode]) acc[catCode] = {};
            if (!acc[catCode][scatCode]) acc[catCode][scatCode] = {};
            if (!acc[catCode][scatCode][prgCode]) acc[catCode][scatCode][prgCode] = {};
            if (!acc[catCode][scatCode][prgCode][sprgCode]) acc[catCode][scatCode][prgCode][sprgCode] = [];
            
            acc[catCode][scatCode][prgCode][sprgCode].push(op);
            return acc;
        }, {} as Record<string, Record<string, Record<string, Record<string, typeof calculatedOperations>>>>);

        const tableRows: (any)[] = [];

        Object.keys(grouped).sort().forEach(catCode => {
            const scatsInCat = grouped[catCode];
            const catName = scatsInCat[Object.keys(scatsInCat)[0]][Object.keys(scatsInCat[Object.keys(scatsInCat)[0]])[0]][Object.keys(scatsInCat[Object.keys(scatsInCat)[0]][Object.keys(scatsInCat[Object.keys(scatsInCat)[0]])[0]])[0]][0].catInt || catCode;
            
            tableRows.push({ type: 'catHeader', id: `cat-${catCode}`, catCode, catName });

            Object.keys(scatsInCat).sort().forEach(scatCode => {
                const programsInScat = scatsInCat[scatCode];
                const scatName = scatCode === 'NO_SCAT' ? 'مبالغ غير موزعة' : (programsInScat[Object.keys(programsInScat)[0]][Object.keys(programsInScat[Object.keys(programsInScat)[0]])[0]][0].scatInt || scatCode);
                
                tableRows.push({ type: 'scatHeader', id: `scat-${catCode}-${scatCode}`, scatCode, scatName });

                Object.keys(programsInScat).sort().forEach(prgCode => {
                    const sprogramsInPrg = programsInScat[prgCode];

                    Object.keys(sprogramsInPrg).sort().forEach(sprgCode => {
                        const opsInSprg = sprogramsInPrg[sprgCode];
                        
                        // Optional: Sub-program Header
                        tableRows.push({ type: 'sprgHeader', id: `sprg-${catCode}-${scatCode}-${prgCode}-${sprgCode}`, prgCode, sprgCode });

                        tableRows.push(...opsInSprg);
                        
                        const sprgSubtotal = opsInSprg.reduce((acc, op) => {
                            acc.aeFinale += op.aeFinale;
                            acc.totalEngagements += op.totalEngagements;
                            acc.totalEngagementsCurrentYear += op.totalEngagementsCurrentYear;
                            acc.remainingAE += op.remainingAE;
                            acc.totalPaiements += op.totalPaiements;
                            acc.cpFinaleCurrentYear += op.cpFinaleCurrentYear;
                            acc.paiementsCurrentYear += op.paiementsCurrentYear;
                            acc.remainingCP += op.remainingCP;
                            return acc;
                        }, { aeFinale: 0, totalEngagements: 0, totalEngagementsCurrentYear: 0, remainingAE: 0, totalPaiements: 0, cpFinaleCurrentYear: 0, paiementsCurrentYear: 0, remainingCP: 0 });
                        
                        tableRows.push({ 
                            type: 'sprgSubtotal', 
                            id: `subtotal-sprg-${catCode}-${scatCode}-${prgCode}-${sprgCode}`, 
                            label: `مجموع البرنامج الفرعي: ${sprgCode}`, 
                            ...sprgSubtotal 
                        });
                    });
                });

                // Overall Category Subtotal in this Category/Sub-category group
                const scatOps = Object.values(programsInScat).flatMap(prg => Object.values(prg).flat());
                const scatSubtotal = scatOps.reduce((acc, op) => {
                    acc.aeFinale += op.aeFinale;
                    acc.totalEngagements += op.totalEngagements;
                    acc.totalEngagementsCurrentYear += op.totalEngagementsCurrentYear;
                    acc.remainingAE += op.remainingAE;
                    acc.totalPaiements += op.totalPaiements;
                    acc.cpFinaleCurrentYear += op.cpFinaleCurrentYear;
                    acc.paiementsCurrentYear += op.paiementsCurrentYear;
                    acc.remainingCP += op.remainingCP;
                    return acc;
                }, { aeFinale: 0, totalEngagements: 0, totalEngagementsCurrentYear: 0, remainingAE: 0, totalPaiements: 0, cpFinaleCurrentYear: 0, paiementsCurrentYear: 0, remainingCP: 0 });

                tableRows.push({ 
                    type: 'subtotal', 
                    id: `subtotal-scat-${catCode}-${scatCode}`, 
                    label: `مجموع ${scatName}`, 
                    ...scatSubtotal 
                });
            });
        });
        
        const grandTotal = filteredOps.reduce((acc, op) => {
             acc.aeFinale += op.aeFinale;
             acc.totalEngagements += op.totalEngagements;
             acc.totalEngagementsCurrentYear += op.totalEngagementsCurrentYear;
             acc.remainingAE += op.remainingAE;
             acc.totalPaiements += op.totalPaiements;
             acc.cpFinaleCurrentYear += op.cpFinaleCurrentYear;
             acc.paiementsCurrentYear += op.paiementsCurrentYear;
             acc.remainingCP += op.remainingCP;
             return acc;
        }, { aeFinale: 0, totalEngagements: 0, totalEngagementsCurrentYear: 0, remainingAE: 0, totalPaiements: 0, cpFinaleCurrentYear: 0, paiementsCurrentYear: 0, remainingCP: 0 });

        return { rows: tableRows, grandTotal };
    }, [calculatedOperations, selectedActivity]);

    useEffect(() => {
        setVisibleCount(200);
    }, [displayData]);

    const handleSaveOperation = async (data: { 
        operationData: Omit<Operation, 'ID_OPERATION'> | Operation; 
        scategorieOpData?: { idScat: number; montant: number }[];
        rubriqueOps?: { idRubrique: number; montant: number }[];
    }) => {
        const { operationData, scategorieOpData, rubriqueOps } = data;

        try {
            await runInTransaction(async () => {
                let operationId: number;
                if ('ID_OPERATION' in operationData) {
                    operationId = operationData.ID_OPERATION;
                    await updateItem('T_OPERATION', operationId, operationData);
                    showToast('تم تعديل العملية بنجاح', 'success');
                } else {
                    const newOperationData = {
                        ...operationData,
                        CREATED_BY: currentUser.ID_USER
                    };
                    const newOperation = await addItem('T_OPERATION', newOperationData);
                    operationId = newOperation.ID_OPERATION;

                    // Select the newly created operation
                    setSelectedOperationId(operationId);

                    // Auto-assign to user if not admin
                    // If ALLOWED_OPERATIONS is null/undefined, it means they see everything.
                    // Usually we only auto-assign if they are already in a restricted list mode
                    // OR if the system wants to enforce starting a list when they add one.
                    // Given the user request: "Automatic permissions when adding an operation", we will ensure it's added.
                    if (currentUser.ROLE !== 'admin') {
                        try {
                            const currentAllowed = currentUser.ALLOWED_OPERATIONS ? JSON.parse(currentUser.ALLOWED_OPERATIONS) : null;
                            
                            // If it's already a list (even empty []), add to it.
                            // If it's null, it depends. But user said "Automatic", so let's ensure it's there.
                            const allowedOps = currentAllowed || [];
                            if (!allowedOps.includes(operationId)) {
                                const newAllowed = [...allowedOps, operationId];
                                const updatedAllowedString = JSON.stringify(newAllowed);
                                await updateItem('T_USER', currentUser.ID_USER, { ALLOWED_OPERATIONS: updatedAllowedString });
                                onUpdateUser({ ...currentUser, ALLOWED_OPERATIONS: updatedAllowedString });
                            }
                        } catch (e) {
                            console.error("Error updating user permissions", e);
                        }
                    }
                    
                    if (scategorieOpData && scategorieOpData.length > 0) {
                        for (const scatOp of scategorieOpData) {
                            const newScategorieOp = {
                                ID_OPERATION: operationId,
                                ID_SCATEGORIE: scatOp.idScat,
                                MONTANT_INITIALE: scatOp.montant,
                                MONTANT_FINALE: null
                            };
                            await addItem('T_SCATEGORIE_OP', newScategorieOp);
                        }
                    }

                    if (rubriqueOps && rubriqueOps.length > 0) {
                        for (const rop of rubriqueOps) {
                            await addItem('T_RUBRIQUE_OP', {
                                ID_OPERATION: operationId,
                                ID_RUBRIQUE: rop.idRubrique,
                                MONTANT_INITIALE: rop.montant,
                                MONTANT_FINALE: null
                            });
                        }
                    }

                    showToast('تمت إضافة العملية بنجاح', 'success');
                }
            });
            
            setIsModalOpen(false);
            setEditingOperation(undefined);
        } catch (error) {
            showToast(`حدث خطأ أثناء حفظ العملية — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteOperation = () => {
        if (selectedOperationId === null) return;
        const op = db.T_OPERATION.find(o => o.ID_OPERATION === selectedOperationId);

        if (op) {
            if (op.CREATED_BY !== currentUser.ID_USER && currentUser.ROLE === 'admin') {
                alert('ليس لديك صلاحية حذف هذه العملية. فقط المستخدم الذي أضافها يمكنه حذفها.');
                return;
            }
        }
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteOperation = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedOperationId === null) return;
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteOperation(selectedOperationId);
            showToast('تم حذف العملية بنجاح', 'success');
            setSelectedOperationId(null);
        } catch (error) {
            console.error("Delete operation failed", error);
            showToast(`حدث خطأ أثناء حذف العملية — السبب: ${errorMessage(error)}`, 'error');
        }
    };
    
    const openAddModal = () => { 
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
            return;
        }
        setEditingOperation(undefined); 
        setFormKey(prev => prev + 1);
        setIsModalOpen(true); 
    };
    
    const openEditModal = () => { 
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
            return;
        }
        if (selectedOperationId === null) return; 
        const op = db.T_OPERATION.find(o => o.ID_OPERATION === selectedOperationId); 
        if (op) { 
            if (op.CREATED_BY !== currentUser.ID_USER && currentUser.ROLE !== 'admin') {
                alert('ليس لديك صلاحية تعديل هذه العملية. فقط المستخدم الذي أضافها يمكنه تعديلها.');
                return;
            }
            setEditingOperation(op); 
            setFormKey(prev => prev + 1);
            setIsModalOpen(true); 
        } 
    };

    const handleExportOperations = () => {
        if (displayData.rows.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }
    
        const headers = [
            t('col.status'),
            t('col.operation_info'), 
            t('col.ae'), 
            t('col.total_engagements'), 
            t('col.engagements_year', {year: selectedYear}), 
            t('col.remaining_ae'), 
            t('col.total_payments'), 
            t('col.cp_year', {year: selectedYear}), 
            "دفع السنة", 
            "باقي اعتماد الدفع"
        ];
    
        const styles = `
            <style>
                table, th, td {
                    border: 1px solid black;
                    border-collapse: collapse;
                    text-sm;
                    text-align: center;
                    padding: 5px;
                    font-family: Arial, sans-serif;
                    vertical-align: middle;
                }
                th {
                    background-color: #b3cee6;
                    font-light; text-align: center;
                }
                .subtotal {
                    background-color: #F8CBAD;
                    font-light: bold;
                }
                .grandtotal {
                    background-color: #A9D08E;
                    font-light: bold;
                }
                td {
                     mso-number-format:"\\#\\,##0\\.00";
                }
            </style>
        `;
    
        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    
        displayData.rows.forEach(item => {
            if (item.type === 'catHeader') {
                tableHtml += `<tr style="background-color: #1e3a8a; color: white; font-weight: bold;">
                    <td colspan="10">الصنف: ${item.catName} (${item.catCode})</td>
                </tr>`;
            } else if (item.type === 'activityHeader') {
                tableHtml += `<tr style="background-color: #1e40af; color: white; font-weight: bold;">
                    <td colspan="10">النشاط: ${item.activityName}</td>
                </tr>`;
            } else if (item.type === 'scatHeader') {
                tableHtml += `<tr style="background-color: #bbd7fc; font-weight: bold;">
                    <td colspan="10">الصنف الفرعي: ${item.scatName} ${item.scatCode !== 'NO_SCAT' ? `(${item.scatCode})` : ''}</td>
                </tr>`;
            } else if (item.type === 'sprgHeader') {
                tableHtml += `<tr style="background-color: #9ba7de; font-weight: bold;">
                    <td colspan="10">البرنامج: ${item.prgCode} | البرنامج الفرعي: ${item.sprgCode}</td>
                </tr>`;
            } else if (item.type === 'sprgSubtotal') {
                tableHtml += `<tr class="subtotal" style="font-weight: bold;">
                    <td colspan="2">${item.label}</td>
                    <td>${formatCurrency(item.aeFinale)}</td>
                    <td>${formatCurrency(item.totalEngagements)}</td>
                    <td>${formatCurrency(item.totalEngagementsCurrentYear)}</td>
                    <td>${formatCurrency(item.remainingAE)}</td>
                    <td>${formatCurrency(item.totalPaiements)}</td>
                    <td>${formatCurrency(item.cpFinaleCurrentYear)}</td>
                    <td>${formatCurrency(item.paiementsCurrentYear)}</td>
                    <td>${formatCurrency(item.remainingCP)}</td>
                </tr>`;
            } else if (item.type === 'subtotal') {
                tableHtml += `<tr style="background-color: #e2e8f0; font-weight: bold;">
                    <td colspan="2">${item.label}</td>
                    <td>${formatCurrency(item.aeFinale)}</td>
                    <td>${formatCurrency(item.totalEngagements)}</td>
                    <td>${formatCurrency(item.totalEngagementsCurrentYear)}</td>
                    <td>${formatCurrency(item.remainingAE)}</td>
                    <td>${formatCurrency(item.totalPaiements)}</td>
                    <td>${formatCurrency(item.cpFinaleCurrentYear)}</td>
                    <td>${formatCurrency(item.paiementsCurrentYear)}</td>
                    <td>${formatCurrency(item.remainingCP)}</td>
                </tr>`;
            } else {
                const op = item;
                tableHtml += `<tr>
                    <td>${op.status || 'جارية'}</td>
                    <td style="text-align:right; text-xs;"><b>${op.N_OPERATION}</b><br/>${op.INT_OPERATION}</td>
                    <td>${formatCurrency(op.aeFinale)}</td>
                    <td>${formatCurrency(op.totalEngagements)}</td>
                    <td>${formatCurrency(op.totalEngagementsCurrentYear)}</td>
                    <td>${formatCurrency(op.remainingAE)}</td>
                    <td>${formatCurrency(op.totalPaiements)}</td>
                    <td>${formatCurrency(op.cpFinaleCurrentYear)}</td>
                    <td>${formatCurrency(op.paiementsCurrentYear)}</td>
                    <td>${formatCurrency(op.remainingCP)}</td>
                </tr>`;
            }
        });
        
        tableHtml += `</tbody>`;
    
        if (displayData.grandTotal) {
            const total = displayData.grandTotal;
            tableHtml += `<tfoot><tr class="grandtotal">
                <td colspan="2">${t('lbl.total_general')}</td>
                <td>${formatCurrency(total.aeFinale)}</td>
                <td>${formatCurrency(total.totalEngagements)}</td>
                <td>${formatCurrency(total.totalEngagementsCurrentYear)}</td>
                <td>${formatCurrency(total.remainingAE)}</td>
                <td>${formatCurrency(total.totalPaiements)}</td>
                <td>${formatCurrency(total.cpFinaleCurrentYear)}</td>
                <td>${formatCurrency(total.paiementsCurrentYear)}</td>
                <td>${formatCurrency(total.remainingCP)}</td>
            </tr></tfoot>`;
        }
        tableHtml += `</table>`;
        exportToFormattedExcel(tableHtml, `operations_${selectedYear}_${selectedActivity || 'all'}.xls`);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                showToast('جاري استيراد البيانات...', 'loading');
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                
                const worksheet = workbook.getWorksheet(1);
                if (!worksheet) {
                    showToast("الملف فارغ أو بصيغة غير صحيحة", 'error');
                    return;
                }

                const json: any[] = [];
                const headers: string[] = [];
                
                worksheet.getRow(1).eachCell((cell, colNumber) => {
                    headers[colNumber] = String(cell.value || '');
                });

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const rowData: any = {};
                    row.eachCell((cell, colNumber) => {
                        const header = headers[colNumber];
                        if (header) {
                            rowData[header] = cell.value;
                        }
                    });
                    json.push(rowData);
                });

                if (json.length === 0) {
                    showToast("الملف فارغ أو بصيغة غير صحيحة", 'error');
                    return;
                }

                let successCount = 0;
                let errorCount = 0;
                const errors: string[] = [];
                const newOperationIds: number[] = [];

                await runInTransaction(async () => {
                    for (const [index, row] of (json as any[]).entries()) {
                        try {
                            const nOperation = String(row['رقم العملية'] || '').trim();
                            const intOperation = String(row['عنوان العملية'] || '').trim();
                            const cCategorie = String(row['رمز الصنف'] || '').trim();
                            const status: 'جارية' | 'مغلقة' = String(row['الحالة'] || 'جارية').trim() === 'مغلقة' ? 'مغلقة' : 'جارية';
                            const cScategorie = String(row['رمز الصنف الفرعي الأولي'] || '').trim();
                            const montantInitiale = parseFloat(row['المبلغ الأولي']);

                            if (!nOperation || !intOperation || !cCategorie || !cScategorie || isNaN(montantInitiale)) {
                                errors.push(`السطر ${index + 2}: الحقول الأساسية مفقودة أو غير صالحة.`);
                                errorCount++; continue;
                            }
                            
                            const categorie = db.T_CATEGORIE.find(c => c.C_CATEGORIE === cCategorie);
                            if (!categorie) {
                                errors.push(`السطر ${index + 2}: لم يتم العثور على الصنف بالرمز '${cCategorie}'.`);
                                errorCount++; continue;
                            }
                            
                            const scategorie = db.T_SCATEGORIE.find(sc => sc.C_SCATEGORIE === cScategorie && sc.ID_CATEGORIE === categorie.ID_CATEGORIE);
                            if (!scategorie) {
                                errors.push(`السطر ${index + 2}: لم يتم العثور على الصنف الفرعي بالرمز '${cScategorie}' ضمن الصنف '${cCategorie}'.`);
                                errorCount++; continue;
                            }

                            const operationData = {
                                N_OPERATION: nOperation,
                                N_OPERATION_ANCIEN: String(row['رقم العملية القديم'] || '').trim() || null,
                                INT_OPERATION: intOperation,
                                ID_CATEGORIE: categorie.ID_CATEGORIE,
                                status: status,
                                CREATED_BY: currentUser.ID_USER // Assign current user as creator
                            };

                            const scategorieOpData = {
                                idScat: scategorie.ID_SCATEGORIE,
                                montant: montantInitiale,
                            };

                            // Replicating handleSaveOperation logic manually to avoid state updates during transaction
                            const newOperation = await addItem('T_OPERATION', operationData);
                            newOperationIds.push(newOperation.ID_OPERATION);

                            const newScategorieOp = {
                                ID_OPERATION: newOperation.ID_OPERATION,
                                ID_SCATEGORIE: scategorieOpData.idScat,
                                MONTANT_INITIALE: scategorieOpData.montant,
                                MONTANT_FINALE: null
                            };
                            await addItem('T_SCATEGORIE_OP', newScategorieOp);
                            
                            successCount++;

                        } catch (innerError) {
                            console.error("Error processing row:", row, innerError);
                            errors.push(`السطر ${index + 2}: خطأ غير متوقع أثناء المعالجة.`);
                            errorCount++;
                        }
                    }

                    // Update user permissions after all imports
                    if (currentUser.ROLE !== 'admin' && newOperationIds.length > 0) {
                        try {
                            const currentAllowed = currentUser.ALLOWED_OPERATIONS ? JSON.parse(currentUser.ALLOWED_OPERATIONS) : [];
                            const updatedAllowed = Array.from(new Set([...currentAllowed, ...newOperationIds]));
                            const updatedAllowedString = JSON.stringify(updatedAllowed);
                            await updateItem('T_USER', currentUser.ID_USER, { ALLOWED_OPERATIONS: updatedAllowedString });
                            onUpdateUser({ ...currentUser, ALLOWED_OPERATIONS: updatedAllowedString });
                        } catch (e) {
                            console.error("Error updating user permissions after import", e);
                        }
                    }
                });
                
                let summaryMessage = `اكتمل الاستيراد.\nتمت إضافة ${successCount} عمليات بنجاح.\nفشلت إضافة ${errorCount} من السجلات.`;
                if (errors.length > 0) {
                    summaryMessage += "\n\nالأخطاء:\n" + errors.slice(0, 5).join('\n');
                    if (errors.length > 5) summaryMessage += `\n... و ${errors.length - 5} أخطاء أخرى.`
                }
                
                if (successCount > 0) showToast(`تم استيراد ${successCount} عمليات بنجاح`, 'success');
                else if (errorCount > 0) showToast('فشل الاستيراد، راجع التفاصيل', 'error');
                
                alert(summaryMessage);

            } catch (error) {
                alert('فشل استيراد البيانات. يرجى التحقق من أن الملف بصيغة Excel صحيحة وأن الأعمدة مطابقة للنموذج المطلوب.');
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    
    return (
        <PageWrapper title={t('page.operations')} navigate={navigate} onGoBack={onGoBack} currentUser={currentUser} breadcrumb={[]}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
            <div className="sticky top-0 z-40 bg-[#f8fafc] pb-4">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-4">
                    <div className="flex flex-col xl:flex-row gap-2 py-0">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="year-filter" className="flex items-center text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                                    {t('filter.year')}
                                    
                                </label>
                                <CustomDropdown
                                    options={availableYears.map(year => ({ value: year, label: year }))}
                                    value={selectedYear}
                                    onChange={setSelectedYear}
                                    placeholder={t('filter.select_year')}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label htmlFor="activity-filter" className="flex items-center text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                                    {t('filter.activity')}
                                    
                                </label>
                                <CustomDropdown
                                    options={[{ value: '', label: t('filter.all_activities') }, ...activities]}
                                    value={selectedActivity}
                                    onChange={setSelectedActivity}
                                    placeholder={t('filter.select_activity')}
                                    className="h-9 w-full"
                                />
                            </div>
                            <div>
                                <label htmlFor="typeop-filter" className="flex items-center text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                                    نوع العملية
                                </label>
                                <CustomDropdown
                                    options={[
                                        { value: 'all', label: 'كل الأنواع' },
                                        ...uniqueTypeOps.map(t => ({ value: t, label: t }))
                                    ]}
                                    value={selectedTypeOp}
                                    onChange={setSelectedTypeOp}
                                    placeholder="اختر نوع العملية"
                                    className="h-9 w-full"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-none flex flex-wrap gap-2 items-start py-5">
                            <button onClick={() => navigate('PRINT_OPERATIONS_TABLE')} className=" bg-blue-50 text-blue-600 border border-blue-400 px-3 py-1.5 rounded-[20px] shadow-sm hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-[20px] shadow-sm transition-all flex items-center justify-center text-xs font-bold h-8">
                                <i className="bi bi-printer ml-2"></i> {t('btn.print')}
                            </button>
                            <button onClick={handleExportOperations} className="bg-teal-50 text-teal-600 border border-teal-400 px-3 py-1.5 rounded-[20px] shadow-sm hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-[20px] shadow-sm transition-all flex items-center justify-center text-xs font-bold h-8">
                                <i className="bi bi-file-earmark-excel ml-2"></i> {t('btn.export')}
                            </button>
                            
                            {!isViewer && (
                                <div className="flex gap-2">
                                    <button onClick={handleImportClick} className="bg-purple-50 text-purple-600 border border-purple-400 px-3 py-1.5 rounded-[20px] shadow-sm hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-[20px] shadow-md transition-all flex items-center justify-center text-xs font-bold h-8">
                                        <i className="bi bi-file-earmark-excel ml-2"></i> {t('btn.import')}
                                    </button>
                                    <div className="h-8 w-px bg-gray-200 mx-1 self-center"></div>
                                    <button onClick={openAddModal} className="bg-sky-50 text-blue-600 px-3 py-1.5 border border-blue-400 rounded-[20px] shadow-md hover:bg-sky-100 transition-all flex items-center justify-center text-xs font-bold h-8">
                                        <i className="bi bi-plus-circle ml-2"></i> {t('btn.add')}
                                    </button>
                                    <button onClick={openEditModal} disabled={selectedOperationId === null} className="bg-amber-50 text-amber-800 border border-amber-400 px-3 py-1.5 rounded-[20px] border border-amber-200 shadow-sm hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-[20px] shadow-md transition-all flex items-center justify-center text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed h-8">
                                        <i className="bi bi-pencil-fill ml-2"></i> {t('btn.edit')}
                                    </button>
                                    <button onClick={handleDeleteOperation} disabled={selectedOperationId === null} className="bg-red-50 text-red-800 border border-red-400 px-3 py-1.5 rounded-[20px] shadow-sm hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-[20px] shadow-md transition-all flex items-center justify-center text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed h-8">
                                        <i className="bi bi-trash-fill ml-2"></i> {t('btn.delete')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                    <Card title={t('card.final_ae')} value={formatCurrency(summary.totalAE)} icon="bi-journal-check" color="bg-blue-600" compact />
                    <Card title={t('card.total_eng')} value={formatCurrency(summary.totalEngagements)} icon="bi-pen" color="bg-amber-600" compact />
                    <Card title={t('card.total_pay')} value={formatCurrency(summary.totalPaiements)} icon="bi-cash-coin" color="bg-emerald-600" compact />
                    <Card title={`إعتماد الدفع ${selectedYear}`} value={formatCurrency(summary.totalCPCurrentYear)} icon="bi-calendar-check" color="bg-indigo-600" compact />
                    
                    <div className="bg-white p-1.5 h-11 rounded-lg shadow-sm border border-gray-100 flex items-center overflow-hidden">
                        <div className="p-1 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                            <i className="bi bi-bar-chart-steps text-xs"></i>
                        </div>
                        <div className="mr-1 overflow-hidden min-w-0">
                            <p className="text-[8px] text-gray-500 font-bold uppercase truncate">الأنشطة</p>
                            <p className="text-[10px] font-bold text-gray-800 truncate">{summary.activitySummary}</p>
                        </div>
                    </div>

                    <div className="bg-white p-1.5 h-11 rounded-lg shadow-sm border border-gray-100 flex items-center overflow-hidden">
                        <div className="p-1 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <i className="bi bi-collection-play text-xs"></i>
                        </div>
                        <div className="mr-1 overflow-hidden min-w-0">
                            <p className="text-[8px] text-gray-500 font-bold uppercase truncate">البرامج</p>
                            <p className="text-[10px] font-bold text-gray-800 truncate">{summary.programSummary}</p>
                        </div>
                    </div>

                    <div className="bg-white p-1.5 h-11 rounded-lg shadow-sm border border-gray-100 flex items-center overflow-hidden">
                        <div className="p-1 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
                            <i className="bi bi-diagram-3-fill text-xs"></i>
                        </div>
                        <div className="mr-1 overflow-hidden min-w-0">
                            <p className="text-[8px] text-gray-500 font-bold uppercase truncate">البرامج الفرعية</p>
                            <p className="text-[10px] font-bold text-gray-800 truncate">{summary.sprogramSummary}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mt-2">
                <div className="overflow-auto max-h-[calc(100vh-420px)] custom-scrollbar">
                    <table className="w-full text-center min-w-[1200px] border-collapse relative">
                        <thead className="bg-sky-100 text-gray-600 sticky top-0 z-20 shadow-sm">
                            <tr className="border-b border-gray-200">
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider text-center w-24 sticky top-0 bg-sky-100 z-20">{t('col.details')}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider text-center w-36 sticky top-0 bg-sky-100 z-20">
                                    <div className="flex flex-col gap-1 items-center justify-center">
                                        <span>{t('col.status')}</span>
                                        <select
                                            className="text-[10px] bg-white border border-blue-200 rounded-[20px] px-2 py-0.5 font-bold outline-none cursor-pointer focus:border-blue-400 focus:ring-1 focus:ring-blue-100 w-full h-6 text-center normal-case shadow-sm"
                                            value={selectedStatus}
                                            onChange={(e) => setSelectedStatus(e.target.value)}
                                        >
                                            <option value="all">الكل</option>
                                            <option value="جارية">جارية</option>
                                            <option value="مغلقة">مغلقة</option>
                                        </select>
                                    </div>
                                </th>
                                 <th className="p-3 text-[11px] font-bold uppercase tracking-wider min-w-[280px] sticky top-0 bg-sky-100 z-20">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between text-center">
                                            <span>{t('col.operation_info')}</span>
                                            <div className="flex gap-1 rounded-[20px] bg-blue-100">
                                                <button 
                                                    onClick={() => setShowSearchQuery(!showSearchQuery)}
                                                    className={`p-1 rounded-[20px] transition-colors ${showSearchQuery || searchQuery ? 'bg-blue-300 text-blue-600' : 'hover:bg-blue-200 text-gray-400'}`}
                                                    title="بحث برقم أو عنوان العملية"
                                                >
                                                    <Search size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {(showSearchQuery || searchQuery) && (
                                            <div className="relative animate-in slide-in-from-top-1 duration-200">
                                                <input
                                                    type="text"
                                                    placeholder="رقم أو عنوان العملية..."
                                                    className="w-full h-7 px-2 py-1 bg-white border border-blue-200 rounded-[20px] text-[10px] font-medium normal-case focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    autoFocus
                                                />
                                                {searchQuery && (
                                                    <button onClick={() => setSearchQuery('')} className="absolute left-1.5 top-1.5 text-gray-400 hover:text-red-500">
                                                        <X size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.ae')}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.total_engagements')}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.engagements_year', {year: selectedYear})}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.remaining_ae')}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.total_payments')}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.cp_year', {year: selectedYear})}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">{t('col.payments_year', {year: selectedYear})}</th>
                                <th className="p-3 text-[11px] font-bold uppercase tracking-wider sticky top-0 bg-sky-100 z-20">باقي اعتماد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayData.rows.slice(0, visibleCount).map(item => {
                                if (item.type === 'catHeader') {
                                    return (
                                        <tr key={item.id} className="bg-blue-600 text-white font-bold text-sm">
                                            <td colSpan={11} className="p-2.5 px-4 text-right shadow-inner">
                                                <div className="flex items-center gap-2">
                                                    <i className="bi bi-folder-fill"></i>
                                                    <span>الصنف: {item.catName}</span>
                                                    <span className="opacity-70 text-xs px-2 py-0.5 bg-blue-500 rounded ml-2">{item.catCode}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }
                                if (item.type === 'scatHeader') {
                                    return (
                                        <tr key={item.id} className="bg-blue-50 text-blue-800 font-bold text-xs border-y border-blue-100 italic">
                                            <td colSpan={11} className="p-2 px-8 text-right underline decoration-blue-200 decoration-2 underline-offset-2">
                                                <i className="bi bi-arrow-return-left ml-2 text-blue-400"></i>
                                                الصنف الفرعي: {item.scatName} {item.scatCode !== 'NO_SCAT' ? `(${item.scatCode})` : ''}
                                            </td>
                                        </tr>
                                    );
                                }
                                if (item.type === 'sprgHeader') {
                                    return (
                                        <tr key={item.id} className="bg-gray-50/50 text-gray-500 font-medium text-[10px] uppercase tracking-widest border-b border-gray-100">
                                            <td colSpan={11} className="p-1 px-12 text-right">
                                                <span className="inline-flex items-center">
                                                    <span className="w-2 h-2 rounded-full bg-gray-300 ml-2"></span>
                                                    البرنامج: {item.prgCode} <i className="bi bi-dot mx-1"></i> البرنامج الفرعي: {item.sprgCode}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }
                                if (item.type === 'sprgSubtotal' || item.type === 'subtotal') {
                                    const isScat = item.type === 'subtotal';
                                    return (
                                        <tr key={item.id} className={`${isScat ? 'bg-gray-100' : 'bg-gray-50'} font-bold text-xs border-b border-gray-200`}>
                                            <td colSpan={3} className="p-3 text-left pl-6">{item.label}</td>
                                            <td className="p-3">{formatCurrency(item.aeFinale)}</td>
                                            <td className="p-3">{formatCurrency(item.totalEngagements)}</td>
                                            <td className="p-3 text-amber-700">{formatCurrency(item.totalEngagementsCurrentYear)}</td>
                                            <td className="p-3 text-rose-600 font-bold">{formatCurrency(item.remainingAE)}</td>
                                            <td className="p-3">{formatCurrency(item.totalPaiements)}</td>
                                            <td className="p-3 text-indigo-700">{formatCurrency(item.cpFinaleCurrentYear)}</td>
                                            <td className="p-3 text-emerald-600 font-bold">{formatCurrency(item.paiementsCurrentYear)}</td>
                                            <td className="p-3 text-rose-600 font-bold">{formatCurrency(item.remainingCP)}</td>
                                        </tr>
                                    );
                                }

                                return (
                                    <OperationRow 
                                        key={item.ID_OPERATION}
                                        op={item}
                                        isSelected={selectedOperationId === item.ID_OPERATION}
                                        onSelect={setSelectedOperationId}
                                        navigate={navigate}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {visibleCount < displayData.rows.length && (
                    <div className="flex items-center justify-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-200">
                        <span className="text-xs text-gray-500">عرض {Math.min(visibleCount, displayData.rows.length)} من {displayData.rows.length} صف</span>
                        <button
                            onClick={() => setVisibleCount(c => c + 500)}
                            className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                            عرض المزيد
                        </button>
                    </div>
                )}

                {displayData.grandTotal && (
                    <div className="p-4 bg-gray-900 text-white flex flex-wrap justify-between items-center gap-6 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] relative z-10">
                        <div className="flex items-center gap-3">
                            <i className="bi bi-info-circle text-blue-400"></i>
                            <span className="font-bold text-sm">{t('lbl.total_general')}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-8 gap-y-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">إجمالي AE</span>
                                <span className="text-sm font-bold text-blue-400">{formatCurrency(displayData.grandTotal.aeFinale)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">إجمالي الإلتزامات</span>
                                <span className="text-sm font-bold text-amber-400">{formatCurrency(displayData.grandTotal.totalEngagements)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">رخصة AE المتبقية</span>
                                <span className="text-sm font-bold text-rose-400">{formatCurrency(displayData.grandTotal.remainingAE)}</span>
                            </div>
                            <div className="flex flex-col border-r border-gray-700 pr-8">
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">إجمالي CP السنة</span>
                                <span className="text-sm font-bold text-indigo-400">{formatCurrency(displayData.grandTotal.cpFinaleCurrentYear)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">إجمالي الدفع السنة</span>
                                <span className="text-sm font-bold text-emerald-400">{formatCurrency(displayData.grandTotal.paiementsCurrentYear)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">متبقي CP السنة</span>
                                <span className="text-sm font-bold text-rose-400">{formatCurrency(displayData.grandTotal.remainingCP)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
             <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingOperation(undefined); }} title={editingOperation ? "تعديل عملية" : "إضافة عملية جديدة"} maxWidth="lg">
                <AddOperationForm 
                    key={formKey}
                    onClose={() => { setIsModalOpen(false); setEditingOperation(undefined); }} 
                    onSave={handleSaveOperation}
                    categories={db.T_CATEGORIE}
                    scategories={db.T_SCATEGORIE}
                    rubriques={db.T_RUBRIQUE}
                    initialData={editingOperation}
                />
            </Modal>
            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title="تأكيد حذف العملية"
                message="هل أنت متأكد أنك تريد حذف هذه العملية وجميع البيانات المرتبطة بها؟ لا يمكن التراجع عن هذا الإجراء."
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteOperation}
            />
        </PageWrapper>
    );
};

export default OperationsPage;
