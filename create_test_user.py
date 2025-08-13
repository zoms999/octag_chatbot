#!/usr/bin/env python3
"""
Create a test user with known credentials
"""
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def create_test_user():
    try:
        from database.connection import db_manager
        from sqlalchemy import text
        
        async with db_manager.get_async_session() as session:
            # Check if test user already exists
            result = await session.execute(text("""
                SELECT ac_id FROM mwd_account WHERE ac_id = 'testuser123'
            """))
            
            if result.fetchone():
                print("Test user already exists, deleting...")
                await session.execute(text("""
                    DELETE FROM mwd_account WHERE ac_id = 'testuser123'
                """))
                await session.execute(text("""
                    DELETE FROM mwd_person WHERE pe_name = 'Test User 123'
                """))
            
            # Create person
            await session.execute(text("""
                INSERT INTO mwd_person (pe_name, pe_sex) 
                VALUES ('Test User 123', 'M')
            """))
            
            # Get person ID
            result = await session.execute(text("""
                SELECT pe_seq FROM mwd_person WHERE pe_name = 'Test User 123'
            """))
            pe_seq = result.scalar()
            
            # Create account with known password
            await session.execute(text("""
                INSERT INTO mwd_account (pe_seq, ac_id, ac_pw, ac_use) 
                VALUES (:pe_seq, 'testuser123', CRYPT('password123', GEN_SALT('bf')), 'Y')
            """), {"pe_seq": pe_seq})
            
            await session.commit()
            print("Created test user: testuser123 / password123")
            
            # Verify the account works
            result = await session.execute(text("""
                SELECT ac.ac_id, pe.pe_name
                FROM mwd_account ac
                JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
                WHERE ac.ac_id = 'testuser123' 
                AND ac.ac_pw = CRYPT('password123', ac.ac_pw)
                AND ac.ac_use = 'Y'
            """))
            
            account = result.fetchone()
            if account:
                print(f"Verification successful: {account.ac_id} ({account.pe_name})")
                return True
            else:
                print("Verification failed!")
                return False
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(create_test_user())
    if success:
        print("\nNow you can test login with:")
        print("Username: testuser123")
        print("Password: password123")
        print("Login Type: personal")