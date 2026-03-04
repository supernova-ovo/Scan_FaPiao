document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const tableBody = document.getElementById('invoiceTableBody');
    const searchInput = document.getElementById('invoiceSearchInput');
    const searchBtn = document.getElementById('invoiceSearchBtn');
    const searchClearBtn = document.getElementById('invoiceSearchClearBtn');
    const pagePrevBtn = document.getElementById('pagePrevBtn');
    const pageNextBtn = document.getElementById('pageNextBtn');
    const pageInfo = document.getElementById('pageInfo');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const closeDrawerBtn = document.getElementById('closeDrawer');
    const scanningTemplate = document.getElementById('scanningRowTemplate');
    const watermarkStamp = document.getElementById('watermarkStamp');
    const drawer = document.querySelector('.drawer');

    const CONFIG = window.APP_CONFIG || {};
    const API_URL = CONFIG.invoiceVerifyUrl || '/api/fapiao/invoice/pdf';
    const UPLOAD_API_URL = CONFIG.uploadUrl || '/api/upload';
    const SCAN_SERVICE_URL = CONFIG.scanServiceUrl || '/api/invoice/scan';
    const JETOP_API_BASE_URL = CONFIG.jetopApiBaseUrl || localStorage.getItem('jetop_api_base_url') || '/jetopcms';
    const JETOP_AUTH_TOKEN = CONFIG.jetopAuthToken || localStorage.getItem('jetop_auth_token') || '';

    const joinUrl = (base, path) => `${String(base).replace(/\/+$/, '')}${path}`;
    const pageSize = 10;
    let currentPage = 1;
    let currentQuery = '';

    if (!window.dataService || typeof window.dataService.query !== 'function') {
        window.dataService = {
            async query(id, options = {}) {
                if (!id) {
                    return { STATUS: 'Error', MESSAGE: '区块ID不能为空', TOTAL: 0, ROWS: [] };
                }
                const where = options.where || {};
                const pageIndex = options.pageIndex || 1;
                const pageSize = options.pageSize || 10;
                const formData = new FormData();
                formData.append('id', id);
                formData.append('mode', 'query');
                formData.append('_pageindex', String(pageIndex));
                formData.append('_pagesize', String(pageSize));
                Object.entries(where).forEach(([key, value]) => {
                    if (value === undefined) return;
                    if (key.startsWith('_p_')) {
                        formData.append(key, String(value));
                    } else if (key.startsWith('where_')) {
                        formData.append(`_p_${key.slice(6)}`, String(value));
                    } else {
                        formData.append(`_p_${key}`, String(value));
                    }
                });
                const headers = {};
                if (JETOP_AUTH_TOKEN) {
                    headers['X-JetopDebug-User'] = JETOP_AUTH_TOKEN;
                }
                const response = await fetch(joinUrl(JETOP_API_BASE_URL, '/ks/sectionHandler.ashx'), {
                    method: 'POST',
                    headers,
                    body: formData,
                    credentials: 'include'
                });
                const raw = await response.json();
                if (raw && raw.STATUS === 'OK') {
                    return { ...raw, STATUS: 'Success', MESSAGE: raw.MSG || '' };
                }
                if (raw && raw.STATUS === 'ERROR') {
                    return { ...raw, STATUS: 'Error', MESSAGE: raw.MSG || '' };
                }
                return raw;
            }
        };
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                if (typeof result !== 'string') {
                    reject(new Error('文件读取失败'));
                    return;
                }
                const base64 = result.split(',')[1] || '';
                resolve({ base64, dataUrl: result });
            };
            reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    function formatDateYMD(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatDateTime(date) {
        const ymd = formatDateYMD(date);
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${ymd} ${hh}:${mm}:${ss}`;
    }

    function parseInvoiceDate(value) {
        if (!value) return '';
        if (value instanceof Date) return formatDateYMD(value);
        if (typeof value === 'number') {
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? '' : formatDateYMD(d);
        }
        const str = String(value).trim();
        if (/^\d{8}$/.test(str)) {
            return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
        }
        const d = new Date(str);
        return Number.isNaN(d.getTime()) ? str : formatDateYMD(d);
    }

    function formatAmount(value) {
        if (value === undefined || value === null || value === '') return '';
        const num = Number(String(value).replace(/,/g, ''));
        if (Number.isFinite(num)) return `¥ ${num.toLocaleString()}`;
        return String(value);
    }

    function extractFileNameFromUrl(url) {
        if (!url) return '历史扫描';
        try {
            const u = new URL(url, window.location.origin);
            const name = u.pathname.split('/').pop();
            return name || '历史扫描';
        } catch (e) {
            const parts = String(url).split('/');
            const last = parts.pop();
            return last || '历史扫描';
        }
    }

    function normalizeInvoiceData(raw, file) {
        const now = new Date();
        const code = raw && raw.fpdm ? String(raw.fpdm) : '';
        const number = raw && raw.fphm ? String(raw.fphm) : '';
        const invoiceDate = raw ? parseInvoiceDate(raw.kprq || raw.kpsj || raw.date) : '';
        const amount = raw ? formatAmount(raw.sumamount || raw.goodsamount || raw.taxamount) : '';
        const buyer = raw ? (raw.gfMc || raw.gfmc || raw.company || '') : '';
        const seller = raw ? (raw.xfMc || raw.xfmc || '') : '';
        const type = raw ? (raw.fplxName || raw.fplx || raw.fpzlmc || raw.fpzl || raw.invoiceType || '') : '';
        return {
            code: code || '—',
            id: number || '—',
            uploadTime: formatDateTime(now),
            invoiceDate: invoiceDate || '—',
            amount: amount || '—',
            buyer: buyer || '—',
            seller: seller || '—',
            type: type || '—',
            fileName: file.name,
            raw: raw || {}
        };
    }

    function updateStatsFromLogs(rows, totalCount) {
        const totalEl = document.getElementById('statTotal');
        const successEl = document.getElementById('statSuccess');
        const failEl = document.getElementById('statFail');
        if (!totalEl || !successEl || !failEl) return;
        let total = typeof totalCount === 'number' ? totalCount : 0;
        let success = 0;
        rows.forEach(log => {
            const ok = log && (log.success === 1 || log.success === true || String(log.success).toLowerCase() === 'true');
            if (ok) {
                success += 1;
            }
        });
        const fail = Math.max(total - success, 0);
        totalEl.textContent = total.toLocaleString();
        successEl.textContent = success.toLocaleString();
        failEl.textContent = fail.toLocaleString();
    }

    function clearTable() {
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.firstChild);
        }
    }

    function buildWhereFromQuery(query) {
        const trimmed = String(query || '').trim();
        if (!trimmed) return {};
        return { FaPiaoHM: trimmed };
    }

    function updatePagination(totalCount) {
        const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        if (pageInfo) {
            pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
        }
        if (pagePrevBtn) {
            pagePrevBtn.disabled = currentPage <= 1;
        }
        if (pageNextBtn) {
            pageNextBtn.disabled = currentPage >= totalPages;
        }
    }

    async function fetchStats(where) {
        if (!window.dataService || typeof window.dataService.query !== 'function') {
            return { total: 0, success: 0 };
        }
        const sectionId = 'd0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5';
        const statsPageSize = 200;
        let pageIndex = 1;
        let total = 0;
        let success = 0;
        while (true) {
            const result = await window.dataService.query(sectionId, {
                where,
                pageIndex,
                pageSize: statsPageSize
            });
            if (!result || result.STATUS !== 'Success') {
                break;
            }
            const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
            if (pageIndex === 1) {
                total = Number(result.TOTAL || rows.length || 0);
            }
            rows.forEach(log => {
                const ok = log && (log.success === 1 || log.success === true || String(log.success).toLowerCase() === 'true');
                if (ok) success += 1;
            });
            const totalPages = Math.max(1, Math.ceil((total || 0) / statsPageSize));
            if (pageIndex >= totalPages) break;
            pageIndex += 1;
        }
        return { total, success };
    }

    async function fetchScanLogsAndRender(page = 1, query = '') {
        if (!window.dataService || typeof window.dataService.query !== 'function') {
            return;
        }
        const sectionId = 'd0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5';
        const where = buildWhereFromQuery(query);
        let result;
        try {
            result = await window.dataService.query(sectionId, {
                where,
                pageIndex: page,
                pageSize
            });
        } catch (e) {
            return;
        }
        if (!result || result.STATUS !== 'Success') {
            return;
        }
        const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
        const totalCount = Number(result.TOTAL || rows.length || 0);
        updatePagination(totalCount);
        clearTable();
        rows.forEach(log => {
            try {
                const payload = log.json ? JSON.parse(log.json) : {};
                const fileName = extractFileNameFromUrl(log.Url);
                const data = normalizeInvoiceData(payload, { name: fileName });
                if (log.SaoMiaoSJ) {
                    const d = new Date(log.SaoMiaoSJ);
                    if (!Number.isNaN(d.getTime())) {
                        data.uploadTime = formatDateTime(d);
                    } else {
                        data.uploadTime = String(log.SaoMiaoSJ);
                    }
                }
                const row = document.createElement('tr');
                tableBody.appendChild(row);
                const preview = {
                    isImage: false,
                    dataUrl: '',
                    fileUrl: log.Url || ''
                };
                const success = log.success === 1 || log.success === true;
                if (success) {
                    updateRowToSuccess(row, data, preview);
                } else {
                    updateRowToFailure(row, data, preview, '查验失败');
                }
            } catch (e) {
            }
        });
        const stats = await fetchStats(where);
        updateStatsFromLogs(new Array(stats.success).fill({ success: true }), stats.total);
    }

    async function verifyInvoice(file) {
        const { base64, dataUrl } = await readFileAsBase64(file);
        let useBackend = true;
        let backendJson = null;
        try {
            const backendResponse = await fetch(SCAN_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pdfBase64: base64
                })
            });
            if (backendResponse.ok) {
                backendJson = await backendResponse.json();
            } else {
                useBackend = false;
            }
        } catch (e) {
            useBackend = false;
        }
        if (useBackend && backendJson) {
            return { json: backendJson, dataUrl, isImage: file.type.startsWith('image/') };
        }
        const body = new URLSearchParams();
        body.append('pdfBase64', base64);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body
        });
        const json = await response.json();
        return { json, dataUrl, isImage: file.type.startsWith('image/') };
    }

    async function uploadFileToServer(file) {
        const formData = new FormData();
        formData.append('imgFile', file);
        const response = await fetch(UPLOAD_API_URL, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            return '';
        }
        const text = await response.text();
        let realRes;
        try {
            realRes = typeof text === 'string' ? JSON.parse(text) : text;
        } catch (e) {
            realRes = {};
        }
        if (!realRes || !realRes.url) {
            return '';
        }
        return realRes.url;
    }

    async function verifyInvoiceWithUpload(file, options = {}) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const shouldUpload = options.upload !== false && isPdf;
        let fileUrl = '';
        let verifyResult;
        if (shouldUpload) {
            const [vResult, url] = await Promise.all([
                verifyInvoice(file),
                uploadFileToServer(file)
            ]);
            verifyResult = vResult;
            fileUrl = url;
        } else {
            verifyResult = await verifyInvoice(file);
        }
        const { json, dataUrl, isImage } = verifyResult;
        const success = json && json.success === true;
        const payload = json && json.data ? json.data : {};
        const data = normalizeInvoiceData(payload, file);
        return {
            success,
            data,
            payload,
            preview: { dataUrl, isImage, fileUrl },
            raw: json || {}
        };
    }

    window.verifyInvoiceWithUpload = verifyInvoiceWithUpload;

    // --- Drag & Drop Handling ---
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('drag-over');
    }

    function unhighlight(e) {
        dropZone.classList.remove('drag-over');
    }

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFiles);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files: files } });
    }

    function handleFiles(e) {
        const files = [...e.target.files];
        files.forEach(processFile);
    }

    // --- File Processing & UI Updates ---

    async function processFile(file) {
        const row = scanningTemplate.content.cloneNode(true).querySelector('tr');
        tableBody.insertBefore(row, tableBody.firstChild);
        try {
            const result = await verifyInvoiceWithUpload(file);
            if (result.success) {
                updateRowToSuccess(row, result.data, result.preview);
            } else {
                const message = result.raw && result.raw.message ? result.raw.message : '查验失败';
                updateRowToFailure(row, result.data, result.preview, message);
            }
        } catch (error) {
            const data = normalizeInvoiceData({}, file);
            updateRowToFailure(row, data, { dataUrl: '', isImage: false, fileUrl: '' }, error && error.message ? error.message : '查验失败');
        }
    }

    function updateRowToSuccess(row, data, preview) {
        const thumbStyle = preview.isImage && preview.dataUrl ? `style="background-image: url('${preview.dataUrl}');"` : '';
        row.innerHTML = `
            <td>
                <div class="thumb-preview" ${thumbStyle}></div>
            </td>
            <td>
                <span class="invoice-id">${data.code}</span>
                <span class="invoice-code">${data.id}</span>
            </td>
            <td>
                <span class="tag tag-date">${data.uploadTime}</span>
            </td>
            <td>
                <span class="tag tag-date">${data.invoiceDate}</span>
            </td>
            <td>
                <span class="tag tag-amount">${data.amount}</span>
            </td>
            <td>
                <span class="tag tag-company">${data.seller}</span>
            </td>
            <td>
                <span class="tag tag-date">${data.type}</span>
            </td>
            <td>
                <span class="status-badge verified">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    查验完成
                </span>
            </td>
            <td>
                <button class="btn-view">查看</button>
            </td>
        `;
        const btn = row.querySelector('.btn-view');
        btn.onclick = () => openPreview({ data, preview, verified: true });
    }

    function updateRowToFailure(row, data, preview, message) {
        const thumbStyle = preview.isImage && preview.dataUrl ? `style="background-image: url('${preview.dataUrl}');"` : '';
        row.innerHTML = `
            <td>
                <div class="thumb-preview" ${thumbStyle}></div>
            </td>
            <td>
                <span class="invoice-id">${data.code}</span>
                <span class="invoice-code">${data.id}</span>
            </td>
            <td>
                <span class="tag tag-date">${data.uploadTime}</span>
            </td>
            <td>
                <span class="tag tag-date">${data.invoiceDate}</span>
            </td>
            <td>
                <span class="tag tag-amount">${data.amount}</span>
            </td>
            <td>
                <span class="tag tag-company">${data.seller}</span>
            </td>
            <td>
                <span class="tag tag-date">${data.type}</span>
            </td>
            <td>
                <span class="status-badge pending">查验失败</span>
            </td>
            <td>
                <button class="btn-view">查看</button>
            </td>
        `;
        const btn = row.querySelector('.btn-view');
        btn.onclick = () => openPreview({ data, preview, verified: false, message });
    }

    window.openPreview = ({ data, preview, verified, message }) => {
        const drawerContent = document.querySelector('.drawer-content');
        const metaValues = drawerContent.querySelectorAll('.invoice-meta .meta-value');
        if (metaValues[0]) metaValues[0].textContent = data.code;
        if (metaValues[1]) metaValues[1].textContent = data.id;
        if (metaValues[2]) metaValues[2].textContent = data.invoiceDate;

        const amountTag = drawerContent.querySelector('.tag-amount');
        if (amountTag) amountTag.textContent = data.amount;

        const companyTag = drawerContent.querySelector('.tag-company');
        if (companyTag) companyTag.textContent = data.seller || data.buyer;

        const typeTag = drawerContent.querySelector('.tag-date');
        if (typeTag) typeTag.textContent = data.type;

        const previewBox = document.getElementById('invoicePreview');
        const placeholder = document.getElementById('previewPlaceholder');
        if (previewBox && preview && preview.isImage && preview.dataUrl) {
            previewBox.style.backgroundImage = `url('${preview.dataUrl}')`;
            previewBox.style.backgroundSize = 'cover';
            previewBox.style.backgroundPosition = 'center';
            if (placeholder) {
                placeholder.innerHTML = '';
            }
        } else if (previewBox) {
            previewBox.style.backgroundImage = 'none';
            if (placeholder) {
                if (preview && preview.fileUrl) {
                    const safeUrl = preview.fileUrl;
                    placeholder.innerHTML = `<iframe src="${safeUrl}" class="preview-iframe"></iframe><div style="margin-top:8px;font-size:12px;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">在新窗口中打开 PDF</a></div>`;
                } else {
                    placeholder.textContent = '当前为 PDF 文件，暂未获取预览地址，已展示查验结果信息';
                }
            }
        }

        const stampText = watermarkStamp.querySelector('span');
        if (stampText) stampText.textContent = verified ? '查验通过' : '查验失败';

        drawerOverlay.classList.add('active');
        watermarkStamp.classList.remove('show');
        if (verified) {
            setTimeout(() => {
                watermarkStamp.classList.add('show');
            }, 600);
        }

        if (!verified && message) {
            const amountTagCurrent = drawerContent.querySelector('.tag-amount');
            if (amountTagCurrent) amountTagCurrent.textContent = message;
        }
    };

    function closeDrawer() {
        drawerOverlay.classList.remove('active');
        watermarkStamp.classList.remove('show');
    }

    drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) {
            closeDrawer();
        }
    });

    closeDrawerBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerOverlay.classList.contains('active')) {
            closeDrawer();
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentQuery = searchInput ? searchInput.value : '';
            currentPage = 1;
            fetchScanLogsAndRender(currentPage, currentQuery);
        });
    }
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            currentQuery = '';
            currentPage = 1;
            fetchScanLogsAndRender(currentPage, currentQuery);
        });
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                currentQuery = searchInput.value;
                currentPage = 1;
                fetchScanLogsAndRender(currentPage, currentQuery);
            }
        });
    }
    if (pagePrevBtn) {
        pagePrevBtn.addEventListener('click', () => {
            if (currentPage <= 1) return;
            currentPage -= 1;
            fetchScanLogsAndRender(currentPage, currentQuery);
        });
    }
    if (pageNextBtn) {
        pageNextBtn.addEventListener('click', () => {
            currentPage += 1;
            fetchScanLogsAndRender(currentPage, currentQuery);
        });
    }

    fetchScanLogsAndRender(currentPage, currentQuery);

});
