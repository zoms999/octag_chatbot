#!/usr/bin/env python3
"""
Check password for test accounts
"""
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def check_passwords():
    try:
        from database.connection import db_manager
        from sqlalchemy import text
        
        async with db_manager.get_async_session() as session:
            # Test common passwords
            test_passwords = ['test', 'test111', 'password', '1234', 'testpass']
            
            for password in test_passwords:
                result = await session.execute(text("""
                    SELECT ac.ac_id, pe.pe_name
                    FROM mwd_account ac
                    LEFT JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
                    WHERE ac.ac_id = 'test111' 
                    AND ac.ac_pw = CRYPT(:password, ac.ac_pw)
                    AND ac.ac_use = 'Y'
                """), {"password": password})
                
                account = result.fetchone()
                if account:
                    print(f"Found matching password '{password}' for account: {account.ac_id} ({account.pe_name})")
                    return password
            
            print("No matching password found for test111")
            
            # Let's also check the raw password hash
            result = await session.execute(text("""
                SELECT ac.ac_id, ac.ac_pw
                FROM mwd_account ac
                WHERE ac.ac_id = 'test111'
            """))
            
            account = result.fetchone()
            if account:
                print(f"Account {account.ac_id} has password hash: {account.ac_pw[:20]}...")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_passwords())