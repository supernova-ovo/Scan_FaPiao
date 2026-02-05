document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const tableBody = document.getElementById('invoiceTableBody');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const closeDrawerBtn = document.getElementById('closeDrawer');
    const scanningTemplate = document.getElementById('scanningRowTemplate');
    const watermarkStamp = document.getElementById('watermarkStamp');
    const drawer = document.querySelector('.drawer');
    const toastContainer = document.getElementById('toastContainer');

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'error' 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
        `;

        toastContainer.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

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

    function processFile(file) {
        // 1. Add Loading Row
        const row = scanningTemplate.content.cloneNode(true).querySelector('tr');
        tableBody.insertBefore(row, tableBody.firstChild);

        // 2. Read File as Base64 for API
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64Full = e.target.result;
            // Most APIs expect the base64 string without the Data URI scheme prefix
            const base64Content = base64Full.split(',')[1];
            
            uploadInvoice(file, base64Content, row);
        };

        reader.onerror = function(e) {
            console.error("File reading error", e);
            updateRowToError(row, "读取文件失败");
            showToast("读取文件失败", "error");
        };

        reader.readAsDataURL(file);
    }

    function uploadInvoice(file, pdfBase64, row) {
        // API Configuration
        // Use relative path to leverage Vite Proxy (avoids CORS)
        const API_URL = "/thirdpartservice/fapiao/invoice/pdf";
        
        const formData = new URLSearchParams();
        formData.append('pdfBase64', pdfBase64);

        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Logic based on User's YanZhengFP function
            // Structure: data.success (bool), data.data (object)
            
            if (data.success === true) {
                const fpData = data.data;
                
                // Extract relevant fields
                // Note: Using common field names based on standard invoice API responses
                // fpdm: Code, fphm: Number, kprq: Date, je: Amount (sometimes hjje or jshj), xfMc: Seller Name
                
                const formattedDate = fpData.kprq ? formatInvoiceDate(fpData.kprq) : 'Unknown Date';
                const amount = fpData.je || fpData.hjje || fpData.jshj || '0.00';
                
                const invoiceModel = {
                    id: fpData.fphm || "N/A",
                    code: fpData.fpdm || "",
                    amount: `¥ ${Number(amount).toLocaleString()}`,
                    company: fpData.xfMc || fpData.xhfMc || "未知销方",
                    date: formattedDate,
                    fileName: file.name,
                    raw: fpData
                };

                // Success
                updateRowToSuccess(row, invoiceModel);
                saveToLocalStorage(invoiceModel);
                
            } else {
                // API returned success=false
                throw new Error(data.message || "发票验真失败");
            }
        })
        .catch(error => {
            console.error("Verification Error:", error);
            updateRowToError(row, "查验失败");
            showToast("发票验真失败: " + (error.message || "未知错误"), "error");
        });
    }

    function formatInvoiceDate(dateStr) {
        // Simple formatter, assuming YYYYMMDD or YYYY-MM-DD
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            // Try parsing YYYYMMDD manually if needed, or return as is
            if (dateStr.length === 8 && !isNaN(dateStr)) {
                return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
            }
            return dateStr;
        }
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function saveToLocalStorage(invoice) {
        const STORAGE_KEY = 'verified_invoices';
        try {
            const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            // Add new invoice to top
            current.unshift(invoice);
            // Limit to last 50
            if (current.length > 50) current.length = 50;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch (e) {
            console.error("Failed to save to local storage", e);
        }
    }

    function updateRowToSuccess(row, data) {
        row.innerHTML = `
            <td>
                <div class="thumb-preview" style="background-image: url('https://via.placeholder.com/48x32/e5e7eb/9ca3af?text=PDF');"></div>
            </td>
            <td>
                <span class="invoice-id">${data.id}</span>
                <span class="invoice-code">${data.code}</span>
            </td>
            <td>
                <div class="tags-container">
                    <span class="tag tag-amount">${data.amount}</span>
                    <span class="tag tag-date">${data.date}</span>
                    <div class="mt-1">
                        <span class="tag tag-company">${data.company}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="status-badge verified">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    已查验
                </span>
            </td>
            <td>
                <button class="btn-view">查看</button>
            </td>
        `;
        
        // Add event listener to the new button
        const btn = row.querySelector('.btn-view');
        btn.onclick = () => openPreview(data);
    }

    function updateRowToError(row, message) {
        row.innerHTML = `
            <td>
                <div class="thumb-preview" style="background-color: #fee2e2;"></div>
            </td>
            <td colspan="2">
                <span style="color: var(--danger); font-size: 13px; font-weight: 500;">${message}</span>
            </td>
            <td>
                <span class="status-badge error">
                    失败
                </span>
            </td>
            <td>
                <button class="btn-text" onclick="this.closest('tr').remove()">清除</button>
            </td>
        `;
    }

    // --- Drawer & Preview Logic ---

    window.openPreview = (data) => {
        // Populate Drawer Data
        const drawerContent = document.querySelector('.drawer-content');
        
        // Update Meta using IDs
        const metaCode = document.getElementById('metaCode');
        const metaNumber = document.getElementById('metaNumber');
        const metaDate = document.getElementById('metaDate');
        
        if(metaCode) metaCode.textContent = data.code;
        if(metaNumber) metaNumber.textContent = data.id;
        if(metaDate) metaDate.textContent = data.date;
        
        const amountTag = drawerContent.querySelector('.tag-amount');
        if(amountTag) amountTag.textContent = data.amount;
        
        const companyTag = drawerContent.querySelector('.tag-company');
        if(companyTag) companyTag.textContent = data.company;

        // Show Drawer
        drawerOverlay.classList.add('active');
        watermarkStamp.classList.remove('show');

        // Verified stamp animation
        setTimeout(() => {
            watermarkStamp.classList.add('show');
        }, 600);
    };

    function closeDrawer() {
        drawerOverlay.classList.remove('active');
        watermarkStamp.classList.remove('show');
    }

    // Close on overlay click or button
    drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) {
            closeDrawer();
        }
    });

    closeDrawerBtn.addEventListener('click', closeDrawer);
    
    // Add escape key listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerOverlay.classList.contains('active')) {
            closeDrawer();
        }
    });
});
