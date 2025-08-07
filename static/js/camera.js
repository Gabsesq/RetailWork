let stream = null;
let capturedImages = [];

// Simple camera functions
async function startCamera() {
    try {
        updateStatus('Starting camera...', 'info');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera timeout')), 10000); // 10 second timeout
        });
        
        // Even simpler constraints - just basic camera access
        const constraints = {
            video: true
        };

        // Race between camera start and timeout
        stream = await Promise.race([
            navigator.mediaDevices.getUserMedia(constraints),
            timeoutPromise
        ]);
        
        const video = document.getElementById('camera');
        video.srcObject = stream;
        
        updateStatus('Camera ready! Take photos of your documents.', 'success');
        document.getElementById('captureBtn').disabled = false;
        
    } catch (err) {
        console.error('Camera error:', err);
        if (err.message === 'Camera timeout') {
            updateStatus('Camera took too long to start. Try again or use scanner only.', 'error');
        } else {
            updateStatus('Camera failed to start. You can still use the scanner.', 'error');
        }
        
        // Reset capture button state on error
        document.getElementById('captureBtn').disabled = true;
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
    
    updateStatus('Camera stopped. Scanner ready for next use.', 'info');
    document.getElementById('captureBtn').disabled = true;
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
            
            // Auto-stop camera after successful email
            autoStopCameraAfterEmail();
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

// Auto-start camera after print button is pressed
function setupCamera() {
    const captureBtn = document.getElementById('captureBtn');
    if (!captureBtn) return;
    
    // Event listeners
    captureBtn.addEventListener('click', captureImage);
    
    // Add event listener to existing email button
    const emailBtn = document.getElementById('emailButton');
    if (emailBtn) {
        emailBtn.addEventListener('click', sendEmailWithPhotos);
    }
    
    // Initial status
    updateStatus('Camera will start automatically after printing.', 'info');
    
    console.log('Auto camera setup complete');
}

// Function to auto-start camera after print
function autoStartCameraAfterPrint() {
    updateStatus('Starting camera for photo capture...', 'info');
    startCamera().then(() => {
        updateStatus('Camera ready! Take photos of your documents.', 'success');
    }).catch((err) => {
        updateStatus('Camera failed to start. You can still email without photos.', 'error');
    });
}

// Function to auto-stop camera after email
function autoStopCameraAfterEmail() {
    if (stream) {
        stopCamera();
        updateStatus('Camera stopped. Scanner ready for next use.', 'info');
    }
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

// Make functions globally accessible
window.cleanupCamera = cleanupCamera;
window.autoStartCameraAfterPrint = autoStartCameraAfterPrint;

// Setup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCamera);
} else {
    setupCamera();
} 