from main import app, db, Product
from sqlalchemy import text

with app.app_context():
    products = Product.query.all()
    print("\nCurrent Products in Database:")
    print("-" * 50)
    for p in products:
        print(f"ID: {p.id}, Name: {p.name}, Stock: {p.stock}")