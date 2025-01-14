from flask import Flask, jsonify, send_from_directory, request
from flask_sqlalchemy import SQLAlchemy
from inventory_db import db, Product, Order
from flask_cors import CORS
import os
from flask_mail import Mail, Message
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("\nEnvironment Variables:")
print("Current working directory:", os.getcwd())
print("Env file exists:", os.path.exists('.env'))
print("MAIL_USERNAME:", os.getenv('MAIL_USERNAME'))
print("MAIL_PASSWORD:", bool(os.getenv('MAIL_PASSWORD')))  # Print only whether it exists
print("MAIL_RECIPIENT:", os.getenv('MAIL_RECIPIENT'), "\n")

print("Mail Username:", os.getenv('MAIL_USERNAME'))
print("Mail Recipient:", os.getenv('MAIL_RECIPIENT'))

app = Flask(__name__, static_folder='static')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///inventory.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')

# Enable CORS for all routes
CORS(app)

db.init_app(app)

mail = Mail(app)

print("\nMail Configuration:")
print(f"Server: {app.config['MAIL_SERVER']}")
print(f"Port: {app.config['MAIL_PORT']}")
print(f"Username: {app.config['MAIL_USERNAME']}")
print(f"TLS: {app.config['MAIL_USE_TLS']}")
print(f"Recipient: {os.getenv('MAIL_RECIPIENT')}\n")

# Create tables
with app.app_context():
    db.session.execute('DROP TABLE IF EXISTS product')
    db.session.execute('DROP TABLE IF EXISTS "order"')
    db.session.commit()
    db.create_all()

# Add new routes for inventory management
@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    try:
        products = Product.query.all()
        print("Found products:", [p.name for p in products])  # Debug print
        return jsonify({
            'status': 'success',
            'products': [{
                'id': p.id,
                'name': p.name,
                'stock': p.stock
            } for p in products]
        })
    except Exception as e:
        print("Error fetching inventory:", str(e))  # Debug print
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/order', methods=['POST'])
def place_order():
    data = request.json
    try:
        # Create new order
        order = Order(
            first_name=data['employee_name'].split()[0],
            last_name=data['employee_name'].split()[1],
            shipping_address=data['shipping_address'],
            product_id=data['product_id'],
            quantity=data['quantity']
        )
        
        # Update stock
        product = Product.query.get(data['product_id'])
        if product.stock >= data['quantity']:
            product.stock -= data['quantity']
            db.session.add(order)
            db.session.commit()
            return jsonify({'success': True})
        else:
            return jsonify({
                'success': False,
                'message': 'Not enough stock'
            }), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route("/", methods=["GET"])
def home():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/employee-order", methods=["GET"])
def employee_order():
    return send_from_directory(app.static_folder, "employee-order.html")

@app.route('/api/debug', methods=['GET'])
def debug_db():
    try:
        products = Product.query.all()
        return jsonify({
            'product_count': len(products),
            'products': [{
                'id': p.id,
                'name': p.name,
                'stock': p.stock,
                'last_updated': p.last_updated.isoformat() if p.last_updated else None
            } for p in products]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-order', methods=['POST'])
def submit_order():
    try:
        data = request.json
        print("\nDEBUG - Full request data:", data)  # Print entire request data
        
        print("\nDEBUG - Mail settings:")
        print(f"Username: {app.config['MAIL_USERNAME']}")
        print(f"Recipient: {os.getenv('MAIL_RECIPIENT')}")
        print(f"Server: {app.config['MAIL_SERVER']}")
        
        # Debug print for notes
        print("\nDEBUG - Employee data:", data.get('employee', {}))
        print("DEBUG - Notes received:", data.get('employee', {}).get('notes', 'No notes found in data'))
        
        # Format email content
        products_text = "\n".join([
            f"- {p['name']}: {p['quantity']} units"
            for p in data['products']
        ])
        
        # Format notes with proper line breaks
        notes_text = data.get('employee', {}).get('notes', '').strip()
        print("\nDEBUG - Notes text after formatting:", notes_text)
        
        if not notes_text:
            notes_text = 'None'
        
        message = f"""
New Employee Order

Employee: {data['employee']['firstName']} {data['employee']['lastName']}
Shipping Address: {data['employee']['address']}

Products Ordered:
{products_text}

Additional Notes:
{notes_text}
"""
        print("\nDEBUG - Final message content:")
        print(message)
        
        msg = Message(
            'New Employee Order',
            sender=app.config['MAIL_USERNAME'],
            recipients=[os.getenv('MAIL_RECIPIENT')],
            body=message
        )
        
        print("\nDEBUG - About to send email")
        mail.send(msg)
        print("DEBUG - Email sent successfully")
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"\nERROR sending email: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Error args: {e.args}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))

