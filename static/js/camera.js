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

async function generateTemplatePDF() {
    try {
        console.log('Generating PDF template...');
        
        // Check if jsPDF is available
        if (typeof window.jsPDF === 'undefined') {
            console.error('jsPDF not available, using fallback method');
            return generateTemplateData();
        }
        
        console.log('jsPDF is available, creating document...');
        const { jsPDF } = window.jsPDF;
        console.log('jsPDF object:', jsPDF);
        
        const doc = new jsPDF('p', 'mm', 'a4');
        console.log('PDF document created');
        
        // Test basic PDF functionality
        doc.text('Test PDF Generation', 20, 20);
        const testOutput = doc.output('datauristring');
        console.log('Test PDF output length:', testOutput.length);
        
        // Set up PDF styling
        doc.setFont('helvetica');
        doc.setFontSize(16);
        
        // Add header
        const header = document.querySelector('h1.header');
        if (header) {
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text(header.textContent, 105, 20, { align: 'center' });
        }
        
        // Add order info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        const orderInfo = document.querySelector('.order-info');
        if (orderInfo) {
            const infoItems = orderInfo.querySelectorAll('.info-item');
            let yPos = 40;
            
            infoItems.forEach((item, index) => {
                const label = item.querySelector('.label');
                const value = item.querySelector('.input-field, .so-number-box');
                
                if (label && value) {
                    const labelText = label.textContent.replace(':', '');
                    const valueText = value.textContent || '';
                    
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${labelText}:`, 20, yPos);
                    doc.setFont('helvetica', 'normal');
                    doc.text(valueText, 60, yPos);
                    
                    yPos += 8;
                }
            });
        }
        
        // Add table
        const table = document.querySelector('table');
        if (table) {
            const headers = [];
            const rows = [];
            
            // Get headers
            const ths = table.querySelectorAll('th');
            ths.forEach(th => headers.push(th.textContent));
            
            // Get data rows
            const trs = table.querySelectorAll('tbody tr');
            trs.forEach(tr => {
                const row = [];
                const tds = tr.querySelectorAll('td');
                tds.forEach(td => row.push(td.textContent || ''));
                if (row.some(cell => cell.trim() !== '')) {
                    rows.push(row);
                }
            });
            
            // Draw table
            if (headers.length > 0) {
                const startY = 70;
                const colWidths = [40, 30, 25, 25, 35, 35]; // SKU, LOT, U/M, CNT1, PALLET 1, PALLET 2
                let currentY = startY;
                
                // Draw headers
                doc.setFillColor(51, 51, 51);
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                
                let xPos = 20;
                headers.forEach((header, index) => {
                    doc.rect(xPos, currentY - 5, colWidths[index], 8, 'F');
                    doc.text(header, xPos + 2, currentY);
                    xPos += colWidths[index];
                });
                
                currentY += 10;
                
                // Draw data rows
                doc.setFillColor(255, 255, 255);
                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'normal');
                
                rows.forEach((row, rowIndex) => {
                    // Check if we need a new page
                    if (currentY > 250) {
                        doc.addPage();
                        currentY = 20;
                    }
                    
                    xPos = 20;
                    row.forEach((cell, colIndex) => {
                        // Alternate row colors
                        if (rowIndex % 2 === 0) {
                            doc.setFillColor(249, 249, 249);
                        } else {
                            doc.setFillColor(255, 255, 255);
                        }
                        
                        doc.rect(xPos, currentY - 5, colWidths[colIndex], 8, 'F');
                        doc.text(cell, xPos + 2, currentY);
                        xPos += colWidths[colIndex];
                    });
                    
                    currentY += 10;
                });
            }
        }
        
        // Convert PDF to base64
        console.log('Converting PDF to base64...');
        const pdfBase64 = doc.output('datauristring');
        console.log('PDF generated successfully, length:', pdfBase64.length);
        console.log('PDF starts with:', pdfBase64.substring(0, 50));
        
        // Verify the PDF was created properly
        if (!pdfBase64 || pdfBase64.length < 100) {
            console.error('PDF generation failed - output too small');
            return null;
        }
        
        return pdfBase64;
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return null;
    }
}

function generateTemplateData() {
    console.log('Generating template data for server-side PDF...');
    
    // Collect all template data
    const templateData = {
        header: document.querySelector('h1.header')?.textContent || 'WAREHOUSE PICKLIST / PALLET CONFIRMATION',
        orderInfo: {},
        tableData: {
            headers: [],
            rows: []
        }
    };
    
    // Collect order info
    const orderInfo = document.querySelector('.order-info');
    if (orderInfo) {
        const infoItems = orderInfo.querySelectorAll('.info-item');
        infoItems.forEach((item, index) => {
            const label = item.querySelector('.label');
            const value = item.querySelector('.input-field, .so-number-box');
            
            if (label && value) {
                const labelText = label.textContent.replace(':', '');
                const valueText = value.textContent || '';
                templateData.orderInfo[labelText] = valueText;
            }
        });
    }
    
    // Collect table data
    const table = document.querySelector('table');
    if (table) {
        // Get headers
        const ths = table.querySelectorAll('th');
        ths.forEach(th => templateData.tableData.headers.push(th.textContent));
        
        // Get data rows
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
    
    console.log('Template data collected:', templateData);
    return templateData;
}

async function sendEmailWithPhotos() {
    const templateData = collectTemplateData();
    
    if (capturedImages.length === 0) {
        updateStatus('No photos captured. Please take at least one photo before sending.', 'error');
        return;
    }
    
    updateStatus('Capturing template and sending email...', 'info');
    
    try {
        // Generate template PDF
        const templatePDF = await generateTemplatePDF();
        console.log('Template PDF generated:', templatePDF ? 'Yes' : 'No');
        if (templatePDF) {
            console.log('PDF data length:', templatePDF.length);
            console.log('PDF data type:', typeof templatePDF);
        }
        
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                templateData: templateData,
                photos: capturedImages,
                templatePDF: templatePDF
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