// API Configuration
const API_BASE_URL = 'http://localhost:5000';

// State Management
let currentFiles = [];
let rateLimitInterval = null;
let isProcessing = false;

// DOM Elements
const elements = {
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
    progressFill: document.getElementById('progressFill')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    setTodayDate();
    updateRateLimitStatus();
    startRateLimitMonitoring();
    loadTableData();
});

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

    // Refresh rate limit
    elements.btnRefresh.addEventListener('click', updateRateLimitStatus);

    // Refresh table
    if (elements.btnRefreshTable) {
        elements.btnRefreshTable.addEventListener('click', loadTableData);
    }
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

            const response = await fetch(`${API_BASE_URL}/api/ocr`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                successCount++;
                // Add row to table with animation
                addRowToTable(result.data);
            } else if (response.status === 429) {
                showNotification(`Rate limit tercapai. ${successCount}/${totalFiles} berhasil.`, 'warning');
                break;
            }
        } catch (error) {
            console.error('Error processing file:', file.name, error);
        }

        processed++;
        updateProgress(processed, totalFiles);
    }

    // Complete
    isProcessing = false;
    elements.btnProcess.disabled = false;
    updateRateLimitStatus();

    if (successCount === totalFiles) {
        showNotification(`Semua ${totalFiles} gambar berhasil diproses!`, 'success');
    } else if (successCount > 0) {
        showNotification(`${successCount}/${totalFiles} gambar berhasil diproses.`, 'warning');
    } else {
        showNotification('Gagal memproses gambar', 'error');
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
function addRowToTable(data) {
    if (!elements.tableBody) return;

    // Remove empty row if exists
    const emptyRow = elements.tableBody.querySelector('.empty-row');
    if (emptyRow) {
        emptyRow.remove();
    }

    // Create new row
    const tr = document.createElement('tr');
    tr.className = 'new-row';
    tr.innerHTML = `
        <td>${escapeHtml(data.tanggal || '-')}</td>
        <td>${escapeHtml(data.nomor_telepon || '-')}</td>
        <td>${escapeHtml(data.isi_chat || '-')}</td>
    `;

    // Insert at top
    elements.tableBody.insertBefore(tr, elements.tableBody.firstChild);

    // Trigger animation
    requestAnimationFrame(() => {
        tr.classList.add('row-enter');
    });
}

// Load table data from backend
async function loadTableData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data`);
        const result = await response.json();

        if (result.success && result.data) {
            renderTable(result.data);
        }
    } catch (error) {
        console.error('Error loading table data:', error);
    }
}

// Render table with data (full reload)
function renderTable(data) {
    if (!elements.tableBody) return;

    if (data.length === 0) {
        elements.tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="3">
                    <i class="fas fa-inbox"></i>
                    <p>Belum ada data</p>
                </td>
            </tr>
        `;
        return;
    }

    // Reverse data to show newest first
    const reversedData = [...data].reverse();

    elements.tableBody.innerHTML = reversedData.map(row => `
        <tr>
            <td>${escapeHtml(row.tanggal || '-')}</td>
            <td>${escapeHtml(row.nomor || '-')}</td>
            <td>${escapeHtml(row.pesan || '-')}</td>
        </tr>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Rate Limit Management
async function updateRateLimitStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rate-limit-status`);
        const data = await response.json();

        // Update UI
        elements.rateLimitValue.textContent = `${data.remaining}/${data.limit}`;
        
        // Update progress bar (if exists)
        if (elements.rateLimitProgress) {
            const percentage = (data.remaining / data.limit) * 100;
            elements.rateLimitProgress.style.width = `${percentage}%`;
        }

        // Change color based on remaining
        if (data.remaining > 5) {
            elements.rateLimitValue.style.color = 'var(--accent-primary)';
        } else if (data.remaining > 2) {
            elements.rateLimitValue.style.color = 'var(--accent-warning)';
        } else {
            elements.rateLimitValue.style.color = 'var(--accent-error)';
        }

        // Update reset time (if exists)
        if (elements.rateLimitReset && data.reset_in_seconds > 0) {
            const minutes = Math.floor(data.reset_in_seconds / 60);
            const seconds = data.reset_in_seconds % 60;
            elements.rateLimitReset.textContent = `Reset dalam: ${minutes}m ${seconds}s`;
        }

    } catch (error) {
        console.error('Error fetching rate limit status:', error);
    }
}

function startRateLimitMonitoring() {
    // Update every 10 seconds
    rateLimitInterval = setInterval(updateRateLimitStatus, 10000);
}

// Notification System
function showNotification(message, type = 'success') {
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type}`;
    elements.notification.classList.add('show');

    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 4000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (rateLimitInterval) {
        clearInterval(rateLimitInterval);
    }
});
