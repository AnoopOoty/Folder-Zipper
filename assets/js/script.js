/**
 * Folder Zipper Application
 * Optimized with ES6 features for better readability and maintainability
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

/**
 * Supported file extensions for file detection
 * @type {string[]}
 */
const SUPPORTED_FILE_EXTENSIONS = [
    '.html', '.htm', '.css', '.js', '.json', '.xml', '.txt', '.md',
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp', '.ico',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.pdf', '.doc', '.docx',
    '.xls', '.xlsx', '.ppt', '.pptx', '.mp3', '.mp4', '.avi', '.mov',
    '.wmv', '.csv', '.log', '.ini', '.conf', '.config'
];

/**
 * ZIP compression configuration
 * @type {Object}
 */
const ZIP_CONFIG = {
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
};

/**
 * Animation timing constants
 * @type {Object}
 */
const ANIMATION_DELAYS = {
    REMOVE_FOLDER: 400,
    ZIP_PROCESSING: 30
};

/**
 * Folder status types
 * @type {Object}
 */
const FOLDER_STATUS = {
    PENDING: 'pending',
    ZIPPING: 'zipping',
    COMPLETE: 'complete'
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

/**
 * Cached DOM elements for better performance
 * @type {Object}
 */
const elements = {
    folderInput: document.getElementById('folderInput'),
    browseBtn: document.getElementById('browseBtn'),
    foldersList: document.getElementById('foldersList'),
    emptyState: document.getElementById('emptyState'),
    zipAllBtn: document.getElementById('zipAllBtn'),
    stopBtn: document.getElementById('stopBtn'),
    cleanupBtn: document.getElementById('cleanupBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    clearAllBtn: document.getElementById('clearAllBtn')
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Application state
 * @type {Object}
 */
const state = {
    folders: [],
    shouldStopZipping: false
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a given name is a file (not a folder)
 * @param {string} name - The name to check
 * @returns {boolean} - True if it's a file, false if it's a folder
 */
const isFile = (name) => {
    const lowerName = name.toLowerCase();
    const hasExtension = SUPPORTED_FILE_EXTENSIONS.some(ext => 
        lowerName.endsWith(ext)
    );
    const hasGenericExtension = /\.\w{1,5}$/.test(lowerName);
    
    return hasExtension || hasGenericExtension;
};

/**
 * Get DOM element by ID with folder ID suffix
 * @param {string} prefix - Element ID prefix
 * @param {number} folderId - Folder ID
 * @returns {HTMLElement|null} - The DOM element or null
 */
const getElementById = (prefix, folderId) => 
    document.getElementById(`${prefix}-${folderId}`);

/**
 * Create a download link and trigger download
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    Object.assign(link, {
        href: url,
        download: filename
    });
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

/**
 * Wait for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// ERROR TOOLTIP MANAGEMENT
// ============================================================================

/**
 * Show error tooltip on an element
 * @param {HTMLElement} element - The element to show tooltip on
 * @param {string} message - Error message to display
 */
const showErrorTooltip = (element, message) => {
    if (element.querySelector('.error-tooltip')) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'error-tooltip';
    tooltip.textContent = message;
    element.style.position = 'relative';
    element.appendChild(tooltip);
};

/**
 * Hide error tooltip from an element
 * @param {HTMLElement} element - The element to remove tooltip from
 */
const hideErrorTooltip = (element) => {
    const tooltip = element.querySelector('.error-tooltip');
    if (tooltip) tooltip.remove();
};

/**
 * Highlight error tooltips with animation
 * @param {HTMLElement} tooltip - The tooltip element to highlight
 */
const highlightTooltip = (tooltip) => {
    tooltip.style.opacity = '1';
    tooltip.style.display = 'block';
    tooltip.classList.remove('highlight');
    
    // Force reflow for smooth animation
    void tooltip.offsetHeight;
    
    requestAnimationFrame(() => {
        tooltip.classList.add('highlight');
    });
};

// ============================================================================
// FOLDER VALIDATION
// ============================================================================

/**
 * Check all folders for file validation and update UI accordingly
 */
const validateFolders = () => {
    state.folders.forEach(folder => {
        const folderElement = getElementById('folder', folder.id);
        if (!folderElement) return;
        
        folderElement.classList.toggle('has-error', folder.isFile);
        
        if (folder.isFile) {
            showErrorTooltip(folderElement, 'Only folders are allowed to zip');
        } else {
            hideErrorTooltip(folderElement);
        }
    });
};

/**
 * Validate and highlight all unwanted files
 * @returns {boolean} - True if there are unwanted files
 */
const validateAndHighlightFiles = () => {
    const unwantedFiles = state.folders.filter(folder => folder.isFile);
    
    if (unwantedFiles.length === 0) return false;
    
    // Scroll to first unwanted file
    const firstFile = unwantedFiles[0];
    const firstFileElement = getElementById('folder', firstFile.id);
    if (firstFileElement) {
        firstFileElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
    
    // Highlight all unwanted files
    unwantedFiles.forEach(file => {
        const folderElement = getElementById('folder', file.id);
        if (!folderElement) return;
        
        let tooltip = folderElement.querySelector('.error-tooltip');
        if (!tooltip) {
            showErrorTooltip(folderElement, 'Only folders are allowed to zip');
            tooltip = folderElement.querySelector('.error-tooltip');
        }
        
        if (tooltip) {
            highlightTooltip(tooltip);
        }
    });
    
    return true;
};

// ============================================================================
// FILE HANDLING
// ============================================================================

/**
 * Extract common root folder from file paths
 * @param {Array<Array<string>>} pathParts - Array of path part arrays
 * @returns {string|null} - Common root folder name or null
 */
const extractCommonRoot = (pathParts) => {
    const uniqueRoots = new Set(pathParts.map(parts => parts[0]));
    return uniqueRoots.size === 1 ? pathParts[0][0] : null;
};

/**
 * Extract folder name from file path
 * @param {Array<string>} pathParts - File path parts
 * @param {string|null} commonRoot - Common root folder name
 * @param {Array<Array<string>>} allPathParts - All path parts for context
 * @returns {string} - Extracted folder name
 */
const extractFolderName = (pathParts, commonRoot, allPathParts) => {
    const hasNestedFolders = allPathParts.some(parts => parts.length > 1);
    const isNested = pathParts.length > 1;
    
    if (commonRoot && hasNestedFolders && isNested) {
        return pathParts[1];
    }
    
    return pathParts[0];
};

/**
 * Process uploaded files and organize them by folder
 * @param {FileList} files - The uploaded files
 */
const processUploadedFiles = (files) => {
    const fileArray = Array.from(files);
    const pathParts = fileArray.map(file => file.webkitRelativePath.split('/'));
    const commonRoot = extractCommonRoot(pathParts);
    const folderMap = new Map();
    
    // Group files by folder name
    fileArray.forEach(file => {
        const pathParts = file.webkitRelativePath.split('/');
        const folderName = extractFolderName(pathParts, commonRoot, pathParts);
        
        if (!folderMap.has(folderName)) {
            folderMap.set(folderName, []);
        }
        
        folderMap.get(folderName).push(file);
    });
    
    // Add each folder to the application
    const initialRowCount = state.folders.length;
    folderMap.forEach((files, name) => addFolder(name, files));
    updateUI();
    
    // Log folder rows added
    const rowsAdded = state.folders.length - initialRowCount;
    const unwantedFileRows = state.folders.filter(f => f.isFile).length;
    console.log(`Folder rows added: ${rowsAdded}`);
    console.log(`Folder rows with files (other than folders): ${unwantedFileRows}`);
};

/**
 * Generate unique folder ID
 * @returns {number} - Unique folder ID
 */
const generateFolderId = () => Date.now() + Math.random();

/**
 * Create folder object
 * @param {string} name - Folder name
 * @param {File[]} files - Files in the folder
 * @returns {Object} - Folder object
 */
const createFolderObject = (name, files) => ({
    id: generateFolderId(),
    name,
    files,
    status: FOLDER_STATUS.PENDING,
    progress: 0,
    zipBlob: null,
    isFile: isFile(name)
});

/**
 * Add a new folder to the application
 * @param {string} name - Folder name
 * @param {File[]} files - Files in the folder
 */
const addFolder = (name, files) => {
    // Check if folder already exists
    if (state.folders.some(folder => folder.name === name)) return;
    
    const folder = createFolderObject(name, files);
    state.folders.push(folder);
    renderFolder(folder);
    validateFolders();
};

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Get status badge text based on folder status
 * @param {string} status - Folder status
 * @returns {string} - Status text
 */
const getStatusText = (status) => {
    const statusMap = {
        [FOLDER_STATUS.PENDING]: 'Pending',
        [FOLDER_STATUS.ZIPPING]: 'Zipping...',
        [FOLDER_STATUS.COMPLETE]: 'Complete'
    };
    return statusMap[status] || 'Pending';
};

/**
 * Render folder item in the UI
 * @param {Object} folder - Folder object to render
 */
const renderFolder = (folder) => {
    const folderItem = document.createElement('div');
    folderItem.className = 'folder-item';
    folderItem.id = `folder-${folder.id}`;
    
    const fileCount = folder.files.length;
    const fileCountText = `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    const isZipping = folder.status === FOLDER_STATUS.ZIPPING;
    
    folderItem.innerHTML = `
        <div class="folder-header">
            <div class="folder-info">
                <div class="folder-icon">📁</div>
                <div class="folder-details">
                    <h3>${folder.name}</h3>
                    <p class="file-count">${fileCountText}</p>
                </div>
            </div>
            <div class="status-box">
                <span class="status-badge status-${folder.status}" id="status-${folder.id}">
                    ${getStatusText(folder.status)}
                </span>
                <button class="download-btn" id="download-${folder.id}">Download</button>
                <button 
                    class="remove-folder-btn" 
                    id="remove-${folder.id}" 
                    title="Remove folder" 
                    ${isZipping ? 'disabled' : ''}
                >
                    ×
                </button>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progress-${folder.id}" style="width: ${folder.progress}%"></div>
            </div>
            <div class="progress-text" id="progress-text-${folder.id}">${folder.progress}%</div>
        </div>
    `;
    
    elements.foldersList.appendChild(folderItem);
    
    // Attach event listeners
    getElementById('download', folder.id)?.addEventListener('click', () => 
        downloadZip(folder)
    );
    getElementById('remove', folder.id)?.addEventListener('click', () => 
        removeFolder(folder)
    );
};

/**
 * Update folder status display in UI
 * @param {Object} folder - Folder object
 */
const updateFolderStatus = (folder) => {
    const statusBadge = getElementById('status', folder.id);
    const downloadBtn = getElementById('download', folder.id);
    const progressText = getElementById('progress-text', folder.id);
    const removeBtn = getElementById('remove', folder.id);
    
    // Update remove button state
    if (removeBtn) {
        removeBtn.disabled = folder.status === FOLDER_STATUS.ZIPPING;
    }
    
    // Handle completed state
    if (folder.status === FOLDER_STATUS.COMPLETE) {
        statusBadge?.remove();
        downloadBtn?.classList.add('visible');
        if (progressText) progressText.style.display = 'none';
        return;
    }
    
    // Update status badge
    if (statusBadge) {
        statusBadge.className = `status-badge status-${folder.status}`;
        statusBadge.textContent = getStatusText(folder.status);
    }
    
    // Update progress text visibility
    if (progressText) {
        progressText.style.display = folder.status === FOLDER_STATUS.ZIPPING 
            ? 'block' 
            : 'none';
    }
};

/**
 * Update folder progress display in UI
 * @param {Object} folder - Folder object
 */
const updateFolderProgress = (folder) => {
    const progressFill = getElementById('progress', folder.id);
    const progressText = getElementById('progress-text', folder.id);
    
    if (progressFill) {
        progressFill.style.width = `${folder.progress}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${folder.progress}%`;
        if (folder.status === FOLDER_STATUS.ZIPPING) {
            progressText.style.display = 'block';
        }
    }
};

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

/**
 * Calculate UI state based on folders
 * @returns {Object} - UI state object
 */
const calculateUIState = () => {
    const folders = state.folders;
    const validFolders = folders.filter(f => !f.isFile);
    
    return {
        hasFolders: folders.length > 0,
        hasUnwantedFiles: folders.some(f => f.isFile),
        hasPendingFolders: validFolders.some(f => f.status === FOLDER_STATUS.PENDING),
        hasZippingFolders: validFolders.some(f => f.status === FOLDER_STATUS.ZIPPING),
        hasCompletedFolders: folders.some(f => f.status === FOLDER_STATUS.COMPLETE),
        allZippingComplete: folders.some(f => f.status === FOLDER_STATUS.COMPLETE) && 
                           !validFolders.some(f => f.status === FOLDER_STATUS.ZIPPING) &&
                           !validFolders.some(f => f.status === FOLDER_STATUS.PENDING)
    };
};

/**
 * Update UI elements based on current state
 */
const updateUI = () => {
    const uiState = calculateUIState();
    
    // Update empty state
    elements.emptyState.style.display = uiState.hasFolders ? 'none' : 'block';
    
    // Update Zip All button
    if (uiState.hasPendingFolders && !uiState.hasZippingFolders) {
        elements.zipAllBtn.style.display = 'inline-block';
        elements.zipAllBtn.disabled = false;
    } else {
        elements.zipAllBtn.style.display = 'none';
    }
    
    // Update Cleanup button
    if (uiState.hasUnwantedFiles) {
        elements.cleanupBtn.style.display = 'inline-block';
        elements.cleanupBtn.disabled = false;
    } else {
        elements.cleanupBtn.style.display = 'none';
    }
    
    // Update Download All button
    if (uiState.allZippingComplete) {
        elements.downloadAllBtn.style.display = 'inline-block';
        elements.downloadAllBtn.disabled = false;
    } else {
        elements.downloadAllBtn.style.display = 'none';
    }
    
    // Update Clear All button
    if (uiState.hasFolders) {
        elements.clearAllBtn.style.display = 'inline-block';
        elements.clearAllBtn.disabled = false;
    } else {
        elements.clearAllBtn.style.display = 'none';
    }
};

// ============================================================================
// FOLDER MANAGEMENT
// ============================================================================

/**
 * Remove folder from the application
 * @param {Object} folder - Folder object to remove
 */
const removeFolder = (folder) => {
    if (folder.status === FOLDER_STATUS.ZIPPING) return;
    
    const folderElement = getElementById('folder', folder.id);
    if (!folderElement) return;
    
    // Remove from state
    state.folders = state.folders.filter(f => f.id !== folder.id);
    
    // Log remaining folder rows
    const remainingRows = state.folders.length;
    const remainingUnwantedFileRows = state.folders.filter(f => f.isFile).length;
    console.log(`Removed folder row. Remaining folder rows: ${remainingRows}`);
    console.log(`Folder rows with files (other than folders): ${remainingUnwantedFileRows}`);
    
    // Animate removal
    folderElement.classList.add('removing');
    setTimeout(() => {
        folderElement.remove();
        validateFolders();
        updateUI();
    }, ANIMATION_DELAYS.REMOVE_FOLDER);
};

/**
 * Remove all unwanted files from the application
 */
const removeUnwantedFiles = () => {
    const unwantedFiles = state.folders.filter(folder => folder.isFile);
    if (unwantedFiles.length === 0) return;
    
    const filesToRemove = unwantedFiles.length;
    
    // Animate removal of each file
    unwantedFiles.forEach((file, index) => {
        const folderElement = getElementById('folder', file.id);
        if (!folderElement) return;
        
        folderElement.classList.add('removing');
        
        setTimeout(() => {
            folderElement.remove();
            
            // Update state after last file is removed
            if (index === unwantedFiles.length - 1) {
                state.folders = state.folders.filter(f => !f.isFile);
                validateFolders();
                updateUI();
                
                // Update console log with remaining folder rows
                const remainingRows = state.folders.length;
                const remainingUnwantedFileRows = state.folders.filter(f => f.isFile).length;
                console.log(`Removed ${filesToRemove} unwanted file row(s). Remaining folder rows: ${remainingRows}`);
                console.log(`Folder rows with files (other than folders): ${remainingUnwantedFileRows}`);
            }
        }, ANIMATION_DELAYS.REMOVE_FOLDER);
    });
    
    // Remove from state immediately
    state.folders = state.folders.filter(f => !f.isFile);
};

// ============================================================================
// ZIP OPERATIONS
// ============================================================================

/**
 * Calculate relative path for file in zip
 * @param {File} file - File object
 * @param {string} folderName - Folder name
 * @returns {string} - Relative path in zip
 */
const calculateRelativePath = (file, folderName) => {
    const pathParts = file.webkitRelativePath.split('/');
    const folderIndex = pathParts.indexOf(folderName);
    
    if (folderIndex >= 0) {
        const relativeParts = pathParts.slice(folderIndex + 1);
        return relativeParts.join('/') || file.name;
    }
    
    if (pathParts.length > 1) {
        return pathParts.slice(1).join('/') || file.name;
    }
    
    return file.name;
};

/**
 * Reset folder to pending state
 * @param {Object} folder - Folder object to reset
 */
const resetFolderState = (folder) => {
    folder.status = FOLDER_STATUS.PENDING;
    folder.progress = 0;
    updateFolderStatus(folder);
    updateFolderProgress(folder);
    updateUI();
};

/**
 * Zip a single folder
 * @param {Object} folder - Folder object to zip
 */
const zipFolder = async (folder) => {
    // Check if operation should be stopped
    if (state.shouldStopZipping) {
        return resetFolderState(folder);
    }
    
    // Update folder status
    folder.status = FOLDER_STATUS.ZIPPING;
    updateFolderStatus(folder);
    updateUI();
    
    // Initialize zip
    const zip = new JSZip();
    const totalFiles = folder.files.length;
    
    // Add files to zip
    for (let i = 0; i < totalFiles; i++) {
        if (state.shouldStopZipping) {
            return resetFolderState(folder);
        }
        
        const file = folder.files[i];
        const relativePath = calculateRelativePath(file, folder.name);
        zip.file(relativePath, file);
        
        // Update progress
        folder.progress = Math.round(((i + 1) / totalFiles) * 100);
        updateFolderProgress(folder);
        
        // Small delay for UI responsiveness
        await delay(ANIMATION_DELAYS.ZIP_PROCESSING);
    }
    
    // Check again before generating zip
    if (state.shouldStopZipping) {
        return resetFolderState(folder);
    }
    
    // Generate zip blob
    folder.zipBlob = await zip.generateAsync(ZIP_CONFIG);
    folder.status = FOLDER_STATUS.COMPLETE;
    folder.progress = 100;
    
    // Update UI
    updateFolderStatus(folder);
    updateFolderProgress(folder);
    updateUI();
};

/**
 * Download a single folder zip
 * @param {Object} folder - Folder object to download
 */
const downloadZip = (folder) => {
    if (!folder.zipBlob) return;
    triggerDownload(folder.zipBlob, `${folder.name}.zip`);
};

/**
 * Download all folders as a single zip
 */
const downloadAllZips = async () => {
    const mainZip = new JSZip();
    
    // Add all completed zips to main zip
    state.folders.forEach(folder => {
        if (folder.zipBlob) {
            mainZip.file(`${folder.name}.zip`, folder.zipBlob);
        }
    });
    
    // Generate and download
    const finalBlob = await mainZip.generateAsync(ZIP_CONFIG);
    triggerDownload(finalBlob, 'all_folders.zip');
};

/**
 * Zip all pending folders
 */
const zipAllFolders = async () => {
    // Validate and highlight unwanted files
    if (validateAndHighlightFiles()) {
        return;
    }
    
    // Initialize zipping state
    state.shouldStopZipping = false;
    elements.zipAllBtn.disabled = true;
    elements.zipAllBtn.style.display = 'none';
    elements.stopBtn.style.display = 'inline-block';
    elements.stopBtn.disabled = false;
    
    // Zip each pending folder
    for (const folder of state.folders) {
        if (state.shouldStopZipping) break;
        
        if (folder.status === FOLDER_STATUS.PENDING && !folder.isFile) {
            await zipFolder(folder);
        }
    }
    
    // Reset UI state
    elements.zipAllBtn.style.display = 'inline-block';
    elements.stopBtn.style.display = 'none';
    elements.stopBtn.disabled = true;
    updateUI();
};

/**
 * Stop zipping process
 */
const stopZipping = () => {
    state.shouldStopZipping = true;
    elements.stopBtn.disabled = true;
    elements.stopBtn.style.display = 'none';
    elements.zipAllBtn.style.display = 'inline-block';
    updateUI();
};

/**
 * Clear all folders and reset application state
 */
const clearAllFolders = () => {
    // Stop any ongoing zipping process
    state.shouldStopZipping = true;
    
    // Clear all folders from state
    state.folders = [];
    
    // Clear the folders list in the UI
    elements.foldersList.innerHTML = '';
    
    // Reset file input
    elements.folderInput.value = '';
    
    // Reset UI state
    updateUI();
    
    console.log('All folders cleared. Application reset.');
};

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Initialize event listeners
 */
const initializeEventListeners = () => {
    // Browse button
    elements.browseBtn.addEventListener('click', () => {
        elements.folderInput.click();
    });
    
    // File input change
    elements.folderInput.addEventListener('change', (event) => {
        processUploadedFiles(event.target.files);
    });
    
    // Zip all button
    elements.zipAllBtn.addEventListener('click', zipAllFolders);
    
    // Stop button
    elements.stopBtn.addEventListener('click', stopZipping);
    
    // Cleanup button
    elements.cleanupBtn.addEventListener('click', removeUnwantedFiles);
    
    // Download all button
    elements.downloadAllBtn.addEventListener('click', downloadAllZips);
    
    // Clear all button
    elements.clearAllBtn.addEventListener('click', clearAllFolders);
};

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventListeners);
} else {
    initializeEventListeners();
}
