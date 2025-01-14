from main import app, db, Product
from sqlalchemy import text

with app.app_context():
    # Drop existing tables
    db.session.execute(text('DROP TABLE IF EXISTS product'))
    db.session.execute(text('DROP TABLE IF EXISTS "order"'))
    db.session.commit()
    
    # Create tables
    db.create_all()
    
    # Add products
    products = [
        Product(name='Post-Bio-GH', stock=10),
        Product(name='Omega-Alg', stock=10),
        Product(name='Edi-DR-BC-SML', stock=10),
        Product(name='Edi-DR-BC-LRG', stock=10),
        Product(name='TS-Edi-HJ-PB', stock=10),
        Product(name='Edi-HJ-PB-SML', stock=10),
        Product(name='Edi-HJ-PB-LRG', stock=10),
        Product(name='Edi-HJ-PB-FAM', stock=10),
        Product(name='600-HJR-HO', stock=10),
        Product(name='TS-Edi-STRESS-PB', stock=10),
        Product(name='Edi-STRESS-PB-SML', stock=10),
        Product(name='Edi-STRESS-PB-LRG', stock=10),
        Product(name='Edi-STRESS-PB-FAM', stock=10),
        Product(name='100-DR-HO', stock=10),
        Product(name='200-DR-HO', stock=10),
        Product(name='500-DR-HO', stock=10),
        Product(name='750-DR-HO', stock=10)
    ]
    db.session.add_all(products)
    db.session.commit()
    print("Database initialized successfully!")