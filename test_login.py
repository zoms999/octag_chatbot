#!/usr/bin/env python3
"""
Test login functionality
"""
import asyncio
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_login():
    try:
        from database.connection import db_manager
        from sqlalchemy import text
        
        print("Testing login functionality...")
        
        async with db_manager.get_async_session() as session:
            # Check if there are any test accounts
            result = await session.execute(text("""
                SELECT ac.ac_id, pe.pe_name, ac.ac_use
                FROM mwd_account ac
                LEFT JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
                WHERE ac.ac_use = 'Y'
                LIMIT 5
            """))
            
            accounts = result.fetchall()
            print(f"Found {len(accounts)} active accounts:")
            for acc in accounts:
                print(f"  - ID: {acc.ac_id}, Name: {acc.pe_name}, Active: {acc.ac_use}")
            
            if not accounts:
                print("No active accounts found. Creating a test account...")
                
                # Create a test account
                await session.execute(text("""
                    INSERT INTO mwd_person (pe_name, pe_sex) 
                    VALUES ('테스트사용자', 'M')
                """))
                
                # Get the person ID
                result = await session.execute(text("""
                    SELECT pe_seq FROM mwd_person WHERE pe_name = '테스트사용자'
                """))
                pe_seq = result.scalar()
                
                # Create account with encrypted password
                await session.execute(text("""
                    INSERT INTO mwd_account (pe_seq, ac_id, ac_pw, ac_use) 
                    VALUES (:pe_seq, 'testuser', CRYPT('testpass', GEN_SALT('bf')), 'Y')
                """), {"pe_seq": pe_seq})
                
                await session.commit()
                print("Test account created: testuser / testpass")
        
        # Now test the actual login endpoint
        print("\nTesting login endpoint...")
        import requests
        
        login_data = {
            "username": "testuser",
            "password": "testpass", 
            "loginType": "personal"
        }
        
        response = requests.post(
            "http://localhost:8000/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Login response status: {response.status_code}")
        if response.status_code == 200:
            print("Login successful!")
            data = response.json()
            print(f"User: {data['user']['name']}")
            print(f"Token received: {len(data['tokens']['access'])} chars")
        else:
            print(f"Login failed: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_login())
    sys.exit(0 if success else 1)