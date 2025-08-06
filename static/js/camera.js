let stream = null;
let capturedImages = [];

// Camera functions
async function startCamera() {
    try {
        updateStatus('Starting camera...', 'info');
        
        // Try to use back camera on mobile devices
        const constraints = {
            video: {
                facingMode: 'environment', // Use back camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera');
        video.srcObject = stream;
        
        updateStatus('Camera ready! Click "Take Photo" to capture images.', 'success');
        document.getElementById('captureBtn').disabled = false;
        
    } catch (err) {
        console.error('Camera error:', err);
        updateStatus('Camera access denied. Please allow camera permissions and refresh the page.', 'error');
    }
}

function captureImage() {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Add to captured images array
    capturedImages.push(imageData);
    
    // Display the captured image
    displayCapturedImage(imageData, capturedImages.length - 1);
    
    updateStatus(`Photo captured! (${capturedImages.length} total)`, 'success');
}

function displayCapturedImage(imageData, index) {
    const container = document.getElementById('capturedImages');
    
    const imageDiv = document.createElement('div');
    imageDiv.className = 'captured-image';
    
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = `Captured image ${index + 1}`;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image';
    removeBtn.innerHTML = '×';
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
    statusDiv.textContent = message;
    statusDiv.className = `camera-status ${type}`;
}

function collectTemplateData() {
    // Collect all the form data
    const data = {
        processedBy: document.querySelector('.info-item .input-field').textContent,
        orderType: document.querySelectorAll('.info-item .input-field')[1].textContent,
        poSo: document.querySelector('.so-number-box').textContent,
        // Add more fields as needed
        timestamp: new Date().toISOString()
    };
    return data;
}

async function sendEmailWithPhotos() {
    const templateData = collectTemplateData();
    
    if (capturedImages.length === 0) {
        updateStatus('No photos captured. Please take at least one photo before sending.', 'error');
        return;
    }
    
    updateStatus('Sending email...', 'info');
    
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                templateData: templateData,
                photos: capturedImages
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateStatus('Email sent successfully!', 'success');
            // Clear captured images after successful send
            capturedImages = [];
            refreshCapturedImages();
        } else {
            updateStatus(`Failed to send email: ${result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('Error sending email:', error);
        updateStatus('Failed to send email. Please try again.', 'error');
    }
}

// Initialize camera functionality when DOM is ready
function initializeCamera() {
    // Event listeners
    document.getElementById('captureBtn').addEventListener('click', captureImage);
    document.getElementById('emailButton').addEventListener('click', sendEmailWithPhotos);

    // Auto-start camera when page loads
    startCamera();

    // Clean up camera when page is unloaded
    window.addEventListener('beforeunload', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCamera);
} else {
    initializeCamera();
} 