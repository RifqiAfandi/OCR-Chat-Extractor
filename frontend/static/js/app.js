/**
 * OCR Chat Extractor - Main Application
 * SECURITY HARDENED VERSION
 * 
 * This file works in conjunction with security.js
 * All sensitive operations are delegated to the Security module
 */

'use strict';

// API Configuration
const API_BASE_URL = '';
const STORAGE_KEY = 'ocr_chat_data';

// State Management
let currentFiles = [];
let isProcessing = false;
let ocrData = [];

// DOM Elements
const elements = {
    // API Key Modal
    apiKeyModal: document.getElementById('apiKeyModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    apiKeyError: document.getElementById('apiKeyError'),
    btnSaveApiKey: document.getElementById('btnSaveApiKey'),
    btnChangeApiKey: document.getElementById('btnChangeApiKey'),
    
    // Upload elements
    uploadArea: document.getElementById('uploadArea'),
    uploadPlaceholder: document.getElementById('uploadPlaceholder'),
    filesPreview: document.getElementById('filesPreview'),
    filesList: document.getElementById('filesList'),
    fileInput: document.getElementById('fileInput'),
    btnClearAll: document.getElementById('btnClearAll'),
    btnProcess: document.getElementById('btnProcess'),
    btnProcessText: document.getElementById('btnProcessText'),
    dateInput: document.getElementById('dateInput'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    notification: document.getElementById('notification'),
    rateLimitValue: document.getElementById('rateLimitValue'),
    rateLimitProgress: document.getElementById('rateLimitProgress'),
    rateLimitReset: document.getElementById('rateLimitReset'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnRefreshTable: document.getElementById('btnRefreshTable'),
    tableBody: document.getElementById('tableBody'),
    bulkProgress: document.getElementById('bulkProgress'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressFill: document.getElementById('progressFill'),
    
    // New elements
    btnDeleteAll: document.getElementById('btnDeleteAll'),
    btnExport: document.getElementById('btnExport')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setTodayDate();
    loadDataFromLocalStorage();
    
    // Wait for security module to initialize
    setTimeout(function() {
        checkApiKey();
    }, 100);
});

// Check if API key exists (uses Security module)
function checkApiKey() {
    if (typeof Security !== 'undefined' && Security.hasApiKey()) {
        hideApiKeyModal();
    } else {
        showApiKeyModal();
    }
}

// Show API Key Modal
function showApiKeyModal() {
    if (elements.apiKeyModal) {
        elements.apiKeyModal.classList.add('show');
        
        // Clear input for security
        if (elements.apiKeyInput) {
            elements.apiKeyInput.value = '';
        }
    }
}

// Hide API Key Modal
function hideApiKeyModal() {
    if (elements.apiKeyModal) {
        elements.apiKeyModal.classList.remove('show');
    }
    if (elements.apiKeyError) {
        elements.apiKeyError.style.display = 'none';
    }
    
    // Clear input for security
    if (elements.apiKeyInput) {
        elements.apiKeyInput.value = '';
        elements.apiKeyInput.blur();
    }
}

// Get API Key (secured via Security module)
function getApiKey() {
    if (typeof Security !== 'undefined') {
        return Security.getApiKey() || '';
    }
    return '';
}

// Validate and Save API Key
async function validateAndSaveApiKey() {
    const apiKeyValue = elements.apiKeyInput ? elements.apiKeyInput.value.trim() : '';
    
    if (!apiKeyValue) {
        showApiKeyError('API key tidak boleh kosong');
        return;
    }
    
    // Check rate limiting
    if (typeof Security !== 'undefined' && !Security.canAttempt()) {
        const status = Security.getStatus();
        const minutes = Math.ceil(status.lockoutRemaining / 60000);
        showApiKeyError('Terlalu banyak percobaan. Coba lagi dalam ' + minutes + ' menit.');
        return;
    }
    
    elements.btnSaveApiKey.disabled = true;
    elements.btnSaveApiKey.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memvalidasi...';
    
    try {
        const response = await fetch(API_BASE_URL + '/api/validate-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ api_key: apiKeyValue })
        });
        
        const result = await response.json();
        
        if (result.valid) {
            // Use Security module to store the key securely
            if (typeof Security !== 'undefined') {
                Security.setApiKey(apiKeyValue);
            }
            
            // Clear input immediately after saving
            if (elements.apiKeyInput) {
                elements.apiKeyInput.value = '';
            }
            
            hideApiKeyModal();
            showNotification('API key berhasil disimpan!', 'success');
        } else {
            // Record failed attempt
            if (typeof Security !== 'undefined') {
                Security.recordAttempt();
            }
            showApiKeyError(result.message || 'API key tidak valid');
        }
    } catch (e) {
        showApiKeyError('Gagal memvalidasi API key. Pastikan server berjalan.');
    } finally {
        elements.btnSaveApiKey.disabled = false;
        elements.btnSaveApiKey.innerHTML = '<i class="fas fa-check"></i> <span>Simpan & Lanjutkan</span>';
    }
}

// Show API Key Error
function showApiKeyError(message) {
    elements.apiKeyError.textContent = message;
    elements.apiKeyError.style.display = 'block';
}

// Set today's date as default
function setTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    elements.dateInput.value = `${year}-${month}-${day}`;
}

// Event Listeners
function initializeEventListeners() {
    // API Key Modal
    elements.btnSaveApiKey.addEventListener('click', validateAndSaveApiKey);
    elements.apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') validateAndSaveApiKey();
    });
    elements.btnChangeApiKey.addEventListener('click', () => {
        showApiKeyModal();
    });
    
    // Upload area click
    elements.uploadPlaceholder.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // File input change
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.uploadPlaceholder.addEventListener('dragover', handleDragOver);
    elements.uploadPlaceholder.addEventListener('dragleave', handleDragLeave);
    elements.uploadPlaceholder.addEventListener('drop', handleDrop);

    // Clear all files
    if (elements.btnClearAll) {
        elements.btnClearAll.addEventListener('click', clearAllFiles);
    }

    // Process button
    elements.btnProcess.addEventListener('click', processImages);

    // Refresh table
    if (elements.btnRefreshTable) {
        elements.btnRefreshTable.addEventListener('click', loadDataFromLocalStorage);
    }
    
    // Delete all button
    if (elements.btnDeleteAll) {
        elements.btnDeleteAll.addEventListener('click', deleteAllData);
    }
    
    // Export button
    if (elements.btnExport) {
        elements.btnExport.addEventListener('click', exportToCSV);
    }
    
    // Table cell accordion click handler (delegated)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('cell-text') || e.target.closest('.cell-text')) {
            const cellText = e.target.classList.contains('cell-text') ? e.target : e.target.closest('.cell-text');
            cellText.classList.toggle('expanded');
        }
    });
}

// File Handling - Multiple Files
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
}

function handleDragOver(e) {
    e.preventDefault();
    elements.uploadPlaceholder.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadPlaceholder.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadPlaceholder.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
        addFiles(files);
    } else {
        showNotification('Silakan pilih file gambar yang valid', 'error');
    }
}

function addFiles(files) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'];
    
    files.forEach(file => {
        if (!allowedTypes.includes(file.type)) {
            showNotification(`${file.name}: Tipe file tidak didukung`, 'error');
            return;
        }
        if (file.size > 16 * 1024 * 1024) {
            showNotification(`${file.name}: Ukuran file terlalu besar (Max 16MB)`, 'error');
            return;
        }
        // Avoid duplicates
        if (!currentFiles.find(f => f.name === file.name && f.size === file.size)) {
            currentFiles.push(file);
        }
    });

    updateFilesPreview();
}

function updateFilesPreview() {
    if (currentFiles.length === 0) {
        elements.uploadPlaceholder.style.display = 'block';
        elements.filesPreview.style.display = 'none';
        elements.btnProcess.disabled = true;
        elements.btnProcessText.textContent = 'Proses OCR';
        return;
    }

    elements.uploadPlaceholder.style.display = 'none';
    elements.filesPreview.style.display = 'block';
    elements.btnProcess.disabled = false;
    elements.btnProcessText.textContent = `Proses ${currentFiles.length} Gambar`;

    elements.filesList.innerHTML = currentFiles.map((file, index) => `
        <div class="file-item" data-index="${index}">
            <i class="fas fa-image"></i>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="btn-remove-file" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeFile(index) {
    currentFiles.splice(index, 1);
    updateFilesPreview();
}

function clearAllFiles() {
    currentFiles = [];
    elements.fileInput.value = '';
    updateFilesPreview();
    elements.bulkProgress.style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// OCR Processing - Bulk
async function processImages() {
    if (currentFiles.length === 0) {
        showNotification('Silakan pilih gambar terlebih dahulu', 'warning');
        return;
    }
    
    const apiKey = getApiKey();
    if (!apiKey) {
        showApiKeyModal();
        return;
    }

    if (isProcessing) return;
    isProcessing = true;

    const totalFiles = currentFiles.length;
    let processed = 0;
    let successCount = 0;

    // Show progress
    elements.bulkProgress.style.display = 'block';
    elements.btnProcess.disabled = true;
    updateProgress(0, totalFiles);

    // Get date value
    const dateValue = elements.dateInput.value;
    let formattedDate = null;
    if (dateValue) {
        const [year, month, day] = dateValue.split('-');
        formattedDate = `${day}/${month}/${year}`;
    }

    // Process files sequentially
    for (const file of currentFiles) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            if (formattedDate) {
                formData.append('tanggal', formattedDate);
            }

            const response = await fetch(API_BASE_URL + '/api/ocr', {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                successCount++;
                // Save to localStorage and get the ID
                const savedId = saveToLocalStorage(result.data);
                // Add row to table with the same ID
                addRowToTable(result.data, savedId);
            } else if (response.status === 429) {
                showNotification('Limit API tercapai. Coba lagi nanti. (' + successCount + '/' + totalFiles + ' berhasil)', 'warning');
                break;
            } else if (response.status === 401) {
                showNotification('API key tidak valid. Silakan masukkan ulang.', 'error');
                if (typeof Security !== 'undefined') {
                    Security.removeApiKey();
                }
                showApiKeyModal();
                break;
            } else {
                // Show error from Gemini API
                const errorMsg = result.message || result.error || 'Gagal memproses gambar';
                showNotification(file.name + ': ' + errorMsg, 'error');
            }
        } catch (e) {
            showNotification('Error: Koneksi ke server gagal', 'error');
        }

        processed++;
        updateProgress(processed, totalFiles);
    }

    // Complete
    isProcessing = false;
    elements.btnProcess.disabled = false;
    updateButtonStates();

    if (successCount === totalFiles) {
        showNotification(`Semua ${totalFiles} gambar berhasil diproses!`, 'success');
    } else if (successCount > 0) {
        showNotification(`${successCount}/${totalFiles} gambar berhasil diproses.`, 'warning');
    } else if (totalFiles > 0) {
        showNotification('Gagal memproses gambar. Periksa API key atau coba lagi.', 'error');
    }

    // Clear files after processing
    setTimeout(() => {
        clearAllFiles();
    }, 1500);
}

function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    elements.progressText.textContent = `Memproses ${current}/${total}`;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
}

// Add single row to table with animation
function addRowToTable(data, rowId = null) {
    if (!elements.tableBody) return;

    // Remove empty row if exists
    const emptyRow = elements.tableBody.querySelector('.empty-row');
    if (emptyRow) {
        emptyRow.remove();
    }

    // Use provided ID or generate a new one
    const id = rowId || (Date.now() + Math.random().toString(36).substr(2, 9));
    const pesanText = data.isi_chat || data.pesan || '-';

    // Create new row with new column order: Pesan | Nomor | Tanggal | Aksi
    const tr = document.createElement('tr');
    tr.className = 'new-row';
    tr.setAttribute('data-id', id);
    tr.innerHTML = `
        <td class="cell-pesan">
            <div class="cell-content">
                <span class="cell-text" title="Klik untuk expand/collapse">${escapeHtml(pesanText)}</span>
            </div>
        </td>
        <td>${escapeHtml(data.nomor_telepon || data.nomor || '-')}</td>
        <td>${escapeHtml(data.tanggal || '-')}</td>
        <td>
            <button class="btn-delete-row" onclick="deleteRow('${id}')" title="Hapus data ini">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    // Insert at top
    elements.tableBody.insertBefore(tr, elements.tableBody.firstChild);

    // Trigger animation
    requestAnimationFrame(() => {
        tr.classList.add('row-enter');
    });
    
    updateButtonStates();
}

// LocalStorage Functions
function saveToLocalStorage(data) {
    var storedData = [];
    try {
        storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
        storedData = [];
    }
    
    var newItem = {
        id: String(Date.now()) + Math.random().toString(36).substr(2, 9),
        pesan: data.isi_chat || '',
        nomor: data.nomor_telepon || '',
        tanggal: data.tanggal || '',
        created_at: new Date().toISOString()
    };
    
    storedData.unshift(newItem); // Add to beginning
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
    ocrData = storedData;
    
    return newItem.id;
}

function loadDataFromLocalStorage() {
    var storedData = [];
    try {
        storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
        storedData = [];
    }
    
    ocrData = storedData;
    renderTable(storedData);
    updateButtonStates();
}

function deleteFromLocalStorage(id) {
    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filteredData = storedData.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredData));
    ocrData = filteredData;
}

function clearLocalStorage() {
    localStorage.removeItem(STORAGE_KEY);
    ocrData = [];
}

// Delete single row
function deleteRow(id) {
    // Convert id to string for comparison
    const idStr = String(id);
    
    // Find row with matching data-id
    const rows = elements.tableBody.querySelectorAll('tr[data-id]');
    rows.forEach(row => {
        if (row.getAttribute('data-id') === idStr) {
            row.classList.add('row-exit');
            setTimeout(() => {
                row.remove();
                deleteFromLocalStorage(idStr);
                updateButtonStates();
                
                // Check if table is empty
                if (elements.tableBody.querySelectorAll('tr:not(.empty-row)').length === 0) {
                    renderTable([]);
                }
            }, 300);
        }
    });
}

// Delete from localStorage - ensure string comparison
function deleteFromLocalStorage(id) {
    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const idStr = String(id);
    const filteredData = storedData.filter(item => String(item.id) !== idStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredData));
    ocrData = filteredData;
}

// Delete all data
function deleteAllData() {
    if (!confirm('Apakah Anda yakin ingin menghapus semua data?')) return;
    
    clearLocalStorage();
    renderTable([]);
    showNotification('Semua data berhasil dihapus', 'success');
    updateButtonStates();
}

// Export to CSV
function exportToCSV() {
    const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    if (storedData.length === 0) {
        showNotification('Tidak ada data untuk diexport', 'warning');
        return;
    }
    
    // Create CSV content with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const headers = ['Pesan', 'Nomor', 'Tanggal'];
    const csvRows = [headers.join(',')];
    
    storedData.forEach(item => {
        const row = [
            `"${(item.pesan || '').replace(/"/g, '""')}"`,
            `"${(item.nomor || '').replace(/"/g, '""')}"`,
            `"${(item.tanggal || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const today = new Date();
    const filename = `ocr_export_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}.csv`;
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Data berhasil diexport ke ${filename}`, 'success');
}

// Update button states based on data
function updateButtonStates() {
    var storedData = [];
    try {
        storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
        storedData = [];
    }
    
    var hasData = storedData.length > 0;
    
    if (elements.btnDeleteAll) {
        elements.btnDeleteAll.disabled = !hasData;
    }
    if (elements.btnExport) {
        elements.btnExport.disabled = !hasData;
    }
}

// Render table with data (full reload)
function renderTable(data) {
    if (!elements.tableBody) {
        return;
    }

    if (data.length === 0) {
        elements.tableBody.innerHTML = 
            '<tr class="empty-row">' +
                '<td colspan="4">' +
                    '<i class="fas fa-inbox"></i>' +
                    '<p>Belum ada data</p>' +
                '</td>' +
            '</tr>';
        return;
    }

    // Data already in correct order (newest first from localStorage)
    elements.tableBody.innerHTML = data.map(function(row) {
        var pesanText = row.pesan || '-';
        return '<tr data-id="' + row.id + '">' +
            '<td class="cell-pesan">' +
                '<div class="cell-content">' +
                    '<span class="cell-text" title="Klik untuk expand/collapse">' + escapeHtml(pesanText) + '</span>' +
                '</div>' +
            '</td>' +
            '<td>' + escapeHtml(row.nomor || '-') + '</td>' +
            '<td>' + escapeHtml(row.tanggal || '-') + '</td>' +
            '<td>' +
                '<button class="btn-delete-row" onclick="deleteRow(\'' + row.id + '\')" title="Hapus data ini">' +
                    '<i class="fas fa-trash"></i>' +
                '</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Notification System
function showNotification(message, type) {
    type = type || 'success';
    
    if (!elements.notification) return;
    
    // Sanitize message for display
    var safeMessage = message;
    if (typeof Security !== 'undefined' && Security.sanitize) {
        safeMessage = Security.sanitize(message);
    }
    
    elements.notification.textContent = safeMessage;
    elements.notification.className = 'notification ' + type;
    elements.notification.classList.add('show');

    setTimeout(function() {
        elements.notification.classList.remove('show');
    }, 4000);
}
