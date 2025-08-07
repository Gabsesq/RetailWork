from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import smtplib
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import io

# Global storage for local testing
local_lots_data = []

# Email configuration
EMAIL_CONFIG = {
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587,
    'sender_email': 'gabbyesquibel1999@gmail.com',
    'sender_password': 'efhg jlbn tzdk iroo',
    'recipient_emails': ['gabbye@petreleaf.com', 'PRshipping@petreleaf.com']
}

def generate_server_pdf(template_data):
    """Generate simple HTML representation for email"""
    try:
        # Create HTML content instead of PDF
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 30px; }}
                .info-section {{ margin-bottom: 20px; }}
                .info-row {{ margin: 10px 0; }}
                .label {{ font-weight: bold; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th {{ background-color: #333; color: white; padding: 10px; text-align: center; }}
                td {{ border: 1px solid #ddd; padding: 8px; text-align: center; }}
                tr:nth-child(even) {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">{template_data.get('header', 'WAREHOUSE PICKLIST / PALLET CONFIRMATION')}</div>
            
            <div class="info-section">
        """
        
        # Add order info
        if 'orderInfo' in template_data:
            for label, value in template_data['orderInfo'].items():
                html_content += f'<div class="info-row"><span class="label">{label}:</span> {value}</div>'
        
        html_content += '</div>'
        
        # Add table
        if 'tableData' in template_data and template_data['tableData']['headers']:
            html_content += '<table><thead><tr>'
            for header in template_data['tableData']['headers']:
                html_content += f'<th>{header}</th>'
            html_content += '</tr></thead><tbody>'
            
            for row in template_data['tableData']['rows']:
                html_content += '<tr>'
                for cell in row:
                    html_content += f'<td>{cell}</td>'
                html_content += '</tr>'
            
            html_content += '</tbody></table>'
        
        html_content += '</body></html>'
        
        print(f"HTML template generated, length: {len(html_content)} characters")
        return html_content
        
    except Exception as e:
        print(f"Error generating HTML template: {e}")
        import traceback
        traceback.print_exc()
        return None

def send_email_with_photos(template_data, photos, template_pdf=None):
    """
    Send email with template data, captured photos, and template screenshot
    """
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = ', '.join(EMAIL_CONFIG['recipient_emails'])  # Join multiple emails with commas
        # Get company name and PO number for subject line
        company_name = template_data.get('companyName', 'Unknown Company')
        po_number = template_data.get('poSo', 'No PO/SO')
        msg['Subject'] = f"{company_name} {po_number}"
        
        # Create email body
        body = f"""
        <html>
        <body>
        <h2>Warehouse Picklist Report</h2>
        <p><strong>Processed By:</strong> {template_data.get('processedBy', 'N/A')}</p>
        <p><strong>Company Name:</strong> {template_data.get('companyName', 'N/A')}</p>
        <p><strong>PO/SO Number:</strong> {template_data.get('poSo', 'N/A')}</p>
        <p><strong>Timestamp:</strong> {template_data.get('timestamp', 'N/A')}</p>
        <p><strong>Number of Photos:</strong> {len(photos)}</p>
        <br>
        <p>Please find the attached template screenshot and photos below.</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Handle template PDF or template data
        print(f"Template PDF received: {template_pdf is not None}")
        if template_pdf:
            try:
                # Check if it's a base64 PDF or template data
                if isinstance(template_pdf, str) and template_pdf.startswith('data:application/pdf;base64,'):
                    # Client-side PDF
                    print(f"Processing client-side PDF, length: {len(template_pdf)}")
                    template_pdf = template_pdf.replace('data:application/pdf;base64,', '')
                    pdf_data = base64.b64decode(template_pdf)
                    print(f"Decoded client PDF size: {len(pdf_data)} bytes")
                elif isinstance(template_pdf, dict):
                    # Template data - generate HTML template on server
                    print("Processing template data, generating server-side HTML template")
                    html_template = generate_server_pdf(template_pdf)
                    if not html_template:
                        print("Failed to generate server-side HTML template")
                        return False, "Failed to generate template"
                    
                    # Create a simple text file with the template data
                    template_text = f"""
WAREHOUSE PICKLIST / PALLET CONFIRMATION

Order Information:
"""
                    for label, value in template_pdf.get('orderInfo', {}).items():
                        template_text += f"{label}: {value}\n"
                    
                    template_text += "\nTable Data:\n"
                    if 'tableData' in template_pdf and template_pdf['tableData']['headers']:
                        # Add headers
                        template_text += " | ".join(template_pdf['tableData']['headers']) + "\n"
                        template_text += "-" * 50 + "\n"
                        
                        # Add data rows
                        for row in template_pdf['tableData']['rows']:
                            template_text += " | ".join(row) + "\n"
                    
                    pdf_data = template_text.encode('utf-8')
                else:
                    print("Unknown template PDF format")
                    return False, "Invalid PDF format"
                
                # Create MIME attachment
                from email.mime.base import MIMEBase
                from email import encoders
                
                if isinstance(template_pdf, dict):
                    # Text file for template data
                    attachment = MIMEBase('text', 'plain')
                    attachment.set_payload(pdf_data)
                    encoders.encode_base64(attachment)
                    attachment.add_header('Content-Disposition', 'attachment', filename='warehouse_picklist.txt')
                    msg.attach(attachment)
                    print("Template text file attached successfully")
                else:
                    # PDF file for client-side PDF
                    pdf_attachment = MIMEBase('application', 'pdf')
                    pdf_attachment.set_payload(pdf_data)
                    encoders.encode_base64(pdf_attachment)
                    pdf_attachment.add_header('Content-Disposition', 'attachment', filename='warehouse_picklist.pdf')
                    msg.attach(pdf_attachment)
                    print("Template PDF attached successfully")
                
            except Exception as e:
                print(f"Error processing template PDF: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("No template PDF provided")
        
        # Attach photos
        for i, photo_data in enumerate(photos):
            try:
                # Remove data URL prefix
                if photo_data.startswith('data:image/jpeg;base64,'):
                    photo_data = photo_data.replace('data:image/jpeg;base64,', '')
                
                # Decode base64 image
                image_data = base64.b64decode(photo_data)
                
                # Create MIME image
                image = MIMEImage(image_data)
                image.add_header('Content-Disposition', 'attachment', filename=f'photo_{i+1}.jpg')
                msg.attach(image)
                
            except Exception as e:
                print(f"Error processing photo {i+1}: {e}")
        
        # Send email
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
        text = msg.as_string()
        server.sendmail(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['recipient_emails'], text)
        server.quit()
        
        return True, "Email sent successfully"
        
    except Exception as e:
        print(f"Error sending email: {e}")
        return False, f"Failed to send email: {str(e)}"

class CustomHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.static_directory = "static"
        super().__init__(*args, **kwargs)

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Handle API requests
        if path.startswith('/api/'):
            self.handle_api_get(path, parsed_url.query)
            return
        
        # Handle static files
        self.handle_static_file(path)
    
    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        # Handle API requests
        if path.startswith('/api/'):
            self.handle_api_post(path)
            return
        
        # Return 404 for non-API POST requests
        self.send_error(404, "Not Found")
    
    def handle_api_get(self, path, query):
        if path == '/api/lots':
            # For local testing, return stored data
            response_data = {
                "success": True,
                "lots": local_lots_data
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
        else:
            self.send_error(404, "API endpoint not found")
    
    def handle_api_post(self, path):
        if path == '/api/lots':
            # For local testing, store the data and return success
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                print(f"Received lots data: {data}")
                
                # Check if there are existing entries for this SO/PO number
                so_number = data.get('soNumber', '')
                existing_entries = [entry for entry in local_lots_data if entry['soNumber'] == so_number]
                
                # Remove existing entries for this SO/PO number
                for existing_entry in existing_entries:
                    local_lots_data.remove(existing_entry)
                
                if existing_entries:
                    print(f"Removed {len(existing_entries)} existing entries for SO/PO: {so_number}")
                
                # Add timestamp and unique ID
                entry = {
                    "id": f"{datetime.now().isoformat()}-{len(local_lots_data)}",
                    "timestamp": datetime.now().isoformat(),
                    "soNumber": so_number,
                    "sku": data.get('sku', ''),
                    "lotCode": data.get('lotCode', ''),
                    "quantity": data.get('quantity', ''),
                    "unit": data.get('unit', ''),
                    "template": data.get('template', '')
                }
                
                # Store in local memory
                local_lots_data.append(entry)
                print(f"Stored entry. Total entries: {len(local_lots_data)}")
                
                response_data = {
                    "success": True,
                    "message": "Lot data stored successfully (local mode)",
                    "entry": entry
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode())
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON")
            except Exception as e:
                print(f"Error processing lots data: {e}")
                self.send_error(500, "Internal server error")
                
        elif path == '/api/send-email':
            # Handle email sending
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                template_data = data.get('templateData', {})
                photos = data.get('photos', [])
                template_pdf = data.get('templatePDF', None)
                
                print(f"Sending email with {len(photos)} photos and template PDF")
                
                # Send email
                success, message = send_email_with_photos(template_data, photos, template_pdf)
                
                response_data = {
                    "success": success,
                    "message": message
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode())
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON")
        else:
            self.send_error(404, "API endpoint not found")
    
    def handle_static_file(self, path):
        # Handle root path
        if path == '/':
            path = '/index.html'
        
        # Construct file path
        file_path = os.path.join(self.static_directory, path.lstrip('/'))
        
        # Check if file exists
        if os.path.exists(file_path) and os.path.isfile(file_path):
            # Determine content type
            content_type = 'text/plain'
            if file_path.endswith('.html'):
                content_type = 'text/html'
            elif file_path.endswith('.css'):
                content_type = 'text/css'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript'
            elif file_path.endswith('.json'):
                content_type = 'application/json'
            elif file_path.endswith('.png'):
                content_type = 'image/png'
            elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                content_type = 'image/jpeg'
            
            # Read and serve file
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(404, "File not found")
    
    def log_message(self, format, *args):
        # Custom logging to show requests
        print(f"{self.address_string()} - {format % args}")

def run(server_class=HTTPServer, handler_class=CustomHandler, port=None):
    # Use PORT environment variable (Render sets this) or default to 8000
    port = int(os.environ.get('PORT', 8000))
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting server at http://localhost:{port}")
    print("API endpoints available:")
    print("  GET  /api/lots - Get lots data")
    print("  POST /api/lots - Store lots data")
    print("  POST /api/send-email - Send email with photos")
    httpd.serve_forever()

if __name__ == "__main__":
    run() 