let stream = null;
let capturedImages = [];

// Simple camera functions
async function startCamera() {
    try {
        updateStatus('Starting camera...', 'info');
        
        // Simple constraints
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera');
        video.srcObject = stream;
        
        updateStatus('Camera ready!', 'success');
        document.getElementById('captureBtn').disabled = false;
        
        // Change button to stop
        const startBtn = document.getElementById('startCameraBtn');
        if (startBtn) {
            startBtn.textContent = '⏹️ Stop Camera';
            startBtn.onclick = stopCamera;
            startBtn.style.background = '#dc3545';
        }
        
    } catch (err) {
        console.error('Camera error:', err);
        updateStatus('Camera failed to start. You can still use the scanner.', 'error');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    const video = document.getElementById('camera');
    if (video) {
        video.srcObject = null;
    }
    
    updateStatus('Camera stopped. Scanner should work normally.', 'info');
    document.getElementById('captureBtn').disabled = true;
    
    // Change button back to start
    const startBtn = document.getElementById('startCameraBtn');
    if (startBtn) {
        startBtn.textContent = '📷 Start Camera';
        startBtn.onclick = startCamera;
        startBtn.style.background = '#007bff';
    }
}

function captureImage() {
    if (!stream) {
        updateStatus('Camera not started', 'error');
        return;
    }
    
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    capturedImages.push(imageData);
    displayCapturedImage(imageData, capturedImages.length - 1);
    
    updateStatus(`Photo captured! (${capturedImages.length} total)`, 'success');
}

function displayCapturedImage(imageData, index) {
    const container = document.getElementById('capturedImages');
    
    const imageDiv = document.createElement('div');
    imageDiv.className = 'captured-image';
    
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = `Photo ${index + 1}`;
    img.style.cssText = 'max-width: 150px; height: auto; margin: 5px; border: 1px solid #ccc;';
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;';
    removeBtn.onclick = () => removeImage(index);
    
    imageDiv.appendChild(img);
    imageDiv.appendChild(removeBtn);
    container.appendChild(imageDiv);
}

function removeImage(index) {
    capturedImages.splice(index, 1);
    refreshCapturedImages();
    updateStatus(`Photo removed. (${capturedImages.length} remaining)`, 'info');
}

function refreshCapturedImages() {
    const container = document.getElementById('capturedImages');
    container.innerHTML = '';
    capturedImages.forEach((imageData, index) => {
        displayCapturedImage(imageData, index);
    });
}

function updateStatus(message, type) {
    const statusDiv = document.getElementById('cameraStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `camera-status ${type}`;
    }
}

function collectTemplateData() {
    return {
        processedBy: document.querySelector('.info-item .input-field')?.textContent || '',
        orderType: document.querySelectorAll('.info-item .input-field')[1]?.textContent || '',
        poSo: document.querySelector('.so-number-box')?.textContent || '',
        timestamp: new Date().toISOString()
    };
}

async function sendEmailWithPhotos() {
    if (capturedImages.length === 0) {
        updateStatus('No photos captured.', 'error');
        return;
    }
    
    updateStatus('Sending email...', 'info');
    
    try {
        const templateData = collectTemplateData();
        const templatePDF = generateTemplateData();
        
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                templateData: templateData,
                photos: capturedImages,
                templatePDF: templatePDF
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateStatus('Email sent successfully!', 'success');
            capturedImages = [];
            refreshCapturedImages();
        } else {
            updateStatus(`Email failed: ${result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('Email error:', error);
        updateStatus('Email failed. Please try again.', 'error');
    }
}

function generateTemplateData() {
    const templateData = {
        header: document.querySelector('h1.header')?.textContent || 'WAREHOUSE PICKLIST',
        orderInfo: {},
        tableData: { headers: [], rows: [] }
    };
    
    // Collect order info
    const orderInfo = document.querySelector('.order-info');
    if (orderInfo) {
        const infoItems = orderInfo.querySelectorAll('.info-item');
        infoItems.forEach((item) => {
            const label = item.querySelector('.label');
            const value = item.querySelector('.input-field, .so-number-box');
            if (label && value) {
                const labelText = label.textContent.replace(':', '');
                templateData.orderInfo[labelText] = value.textContent || '';
            }
        });
    }
    
    // Collect table data
    const table = document.querySelector('table');
    if (table) {
        const ths = table.querySelectorAll('th');
        ths.forEach(th => templateData.tableData.headers.push(th.textContent));
        
        const trs = table.querySelectorAll('tbody tr');
        trs.forEach(tr => {
            const row = [];
            const tds = tr.querySelectorAll('td');
            tds.forEach(td => row.push(td.textContent || ''));
            if (row.some(cell => cell.trim() !== '')) {
                templateData.tableData.rows.push(row);
            }
        });
    }
    
    return templateData;
}

// Simple setup - no auto-start
function setupCamera() {
    const captureBtn = document.getElementById('captureBtn');
    if (!captureBtn) return;
    
    // Add start button
    const cameraSection = document.querySelector('.camera-section');
    if (cameraSection) {
        const startBtn = document.createElement('button');
        startBtn.id = 'startCameraBtn';
        startBtn.textContent = '📷 Start Camera';
        startBtn.className = 'camera-button';
        startBtn.style.cssText = `
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        `;
        startBtn.onclick = startCamera;
        
        const cameraControls = cameraSection.querySelector('.camera-controls');
        if (cameraControls) {
            cameraControls.insertBefore(startBtn, cameraControls.firstChild);
        }
    }
    
    // Add email button
    const emailBtn = document.createElement('button');
    emailBtn.id = 'emailButton';
    emailBtn.textContent = '📧 Email Photos';
    emailBtn.className = 'camera-button';
    emailBtn.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        margin: 5px;
        font-size: 14px;
    `;
    emailBtn.onclick = sendEmailWithPhotos;
    
    const cameraControls = cameraSection.querySelector('.camera-controls');
    if (cameraControls) {
        cameraControls.appendChild(emailBtn);
    }
    
    // Event listeners
    captureBtn.addEventListener('click', captureImage);
    
    // Initial status
    updateStatus('Camera is off. Scanner should work normally.', 'info');
    
    console.log('Simple camera setup complete');
}

// Cleanup function
function cleanupCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    capturedImages = [];
    console.log('Camera cleaned up');
}

// Make cleanup globally accessible
window.cleanupCamera = cleanupCamera;

// Setup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCamera);
} else {
    setupCamera();
} 