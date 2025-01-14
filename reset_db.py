from main import app, db, Product
from sqlalchemy import text

with app.app_context():
    # Drop all tables
    db.drop_all()
    print("Dropped all tables")
    
    # Create tables
    db.create_all()
    print("Created new tables")
    
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
        Product(name='600-HJR-HO', stock=10)
    ]
    db.session.add_all(products)
    db.session.commit()
    print("Added products")
    
    # Verify products
    all_products = Product.query.all()
    print("\nCurrent Products:")
    for p in all_products:
        print(f"ID: {p.id}, Name: {p.name}, Stock: {p.stock}") 