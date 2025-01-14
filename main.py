from flask import Flask, jsonify, send_from_directory, request
from flask_sqlalchemy import SQLAlchemy
from inventory_db import db, Product, Order
from flask_cors import CORS
import os
from flask_mail import Mail, Message
from dotenv import load_dotenv
from sqlalchemy import text
import pandas as pd

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
    try:
        db.create_all()
        # Check if we need to add products
        if Product.query.count() == 0:
            products = [
                Product(name='Post-Bio-GH', stock=7),
                Product(name='Omega-Alg', stock=6),
                Product(name='Edi-DR-BC-SML', stock=0),
                Product(name='Edi-DR-BC-LRG', stock=0),
                Product(name='TS-Edi-HJ-PB', stock=0),
                Product(name='Edi-HJ-PB-SML', stock=0),
                Product(name='Edi-HJ-PB-LRG', stock=0),
                Product(name='Edi-HJ-PB-FAM', stock=3),
                Product(name='600-HJR-HO', stock=2),
                Product(name='TS-Edi-STRESS-PB', stock=0),
                Product(name='Edi-STRESS-PB-SML', stock=0),
                Product(name='Edi-STRESS-PB-LRG', stock=0),
                Product(name='Edi-STRESS-PB-FAM', stock=0),
                Product(name='100-DR-HO', stock=0),
                Product(name='200-DR-HO', stock=0),
                Product(name='500-DR-HO', stock=1),
                Product(name='750-DR-HO', stock=4),
                Product(name='150-Mini-Stress-HO', stock=0),
                Product(name='300-SR-HO', stock=0),
                Product(name='600-SR-HO', stock=2),
                Product(name='300-HJR-HO', stock=5),
                Product(name='600-HJR-HO', stock=2),
                Product(name='180-CAT-SR', stock=4),
                Product(name='100-Line-Ultra', stock=3),
                Product(name='300-Line-Ultra', stock=2),
                Product(name='600-Line-Ultra', stock=0),
                Product(name='CAP450', stock=1),
                Product(name='SNT30', stock=0),
                Product(name='TS-Itchy-Dry-Shampoo', stock=0),
                Product(name='Itchy & Dry-SK-CT', stock=3),
                Product(name='Sensitive-SK-CT', stock=11),
                Product(name='Conditioner-SK-CT', stock=2),
                Product(name='TS-Zini-Shampoo', stock=2),
                Product(name='Zini-SK-CT', stock=4),
                Product(name='SK-PW-RL', stock=3)
            ]
            db.session.add_all(products)
            db.session.commit()
            print("Added initial products to database")
    except Exception as e:
        print(f"Database initialization error: {e}")
        db.session.rollback()

# Add new routes for inventory management
@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    try:
        products = Product.query.all()
        print("\nDEBUG - Database query results:")
        for p in products:
            print(f"ID: {p.id}, Name: {p.name}, Stock: {p.stock}")
        
        response_data = {
            'status': 'success',
            'products': [{
                'id': p.id,
                'name': p.name,
                'stock': p.stock
            } for p in products]
        }
        print("DEBUG - Sending response:", response_data)
        return jsonify(response_data)
    except Exception as e:
        print("\nERROR fetching inventory:")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
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
        
        # Just track the order without updating stock
        db.session.add(order)
        db.session.commit()
        return jsonify({'success': True})
            
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
        print("\nDEBUG - Full request data:", data)
        
        # Update product stock in database
        for ordered_product in data['products']:
            if ordered_product['quantity'] > 0:
                product = Product.query.filter_by(name=ordered_product['name']).first()
                print(f"\nDEBUG - Updating stock for {product.name}:")
                print(f"Current stock: {product.stock}")
                print(f"Order quantity: {ordered_product['quantity']}")
                
                if not product:
                    raise Exception(f"Product not found: {ordered_product['name']}")
                
                if product.stock < ordered_product['quantity']:
                    raise Exception(f"Not enough stock for {product.name}")
                
                product.stock -= ordered_product['quantity']
                print(f"New stock: {product.stock}")
        
        # Commit the stock updates
        try:
            db.session.commit()
            print("DEBUG - Updated product stock in database")
            # Verify the updates
            for ordered_product in data['products']:
                if ordered_product['quantity'] > 0:
                    product = Product.query.filter_by(name=ordered_product['name']).first()
                    print(f"Verified stock for {product.name}: {product.stock}")
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update stock: {str(e)}")

        # Format email content
        products_text = "\n".join([
            f"- {p['name']}: {p['quantity']} units"
            for p in data['products']
        ])
        
        print("\nDEBUG - Mail settings:")
        print(f"Username: {app.config['MAIL_USERNAME']}")
        print(f"Recipient: {os.getenv('MAIL_RECIPIENT')}")
        print(f"Server: {app.config['MAIL_SERVER']}")
        
        # Debug print for notes
        print("\nDEBUG - Employee data:", data.get('employee', {}))
        print("DEBUG - Notes received:", data.get('employee', {}).get('notes', 'No notes found in data'))
        
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

@app.route('/api/lotcodes', methods=['GET'])
def get_lotcodes():
    try:
        # Read the Excel file
        df = pd.read_excel('LotCode.xlsx')
        
        # Convert DataFrame to a dictionary format
        lot_codes = {}
        for _, row in df.iterrows():
            sku = row['SKU']
            lot = row['LOT']
            bb = row['B/B']
            
            if sku not in lot_codes:
                lot_codes[sku] = {}
            
            lot_codes[sku][lot] = bb
        
        print("DEBUG - Loaded lot codes:", lot_codes)  # Add debug logging
        return jsonify({
            'status': 'success',
            'data': lot_codes
        })
    except Exception as e:
        print(f"Error loading lot codes: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))

