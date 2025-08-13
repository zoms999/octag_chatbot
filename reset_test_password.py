#!/usr/bin/env python3
"""
Reset password for existing test account
"""
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def reset_password():
    try:
        from database.connection import db_manager
        from sqlalchemy import text
        
        async with db_manager.get_async_session() as session:
            # Reset password for test111 to 'testpass'
            await session.execute(text("""
                UPDATE mwd_account 
                SET ac_pw = CRYPT('testpass', GEN_SALT('bf'))
                WHERE ac_id = 'test111'
            """))
            
            await session.commit()
            print("Password reset for test111 to 'testpass'")
            
            # Verify the password works
            result = await session.execute(text("""
                SELECT ac.ac_id, pe.pe_name
                FROM mwd_account ac
                JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
                WHERE ac.ac_id = 'test111' 
                AND ac.ac_pw = CRYPT('testpass', ac.ac_pw)
                AND ac.ac_use = 'Y'
            """))
            
            account = result.fetchone()
            if account:
                print(f"Password verification successful: {account.ac_id} ({account.pe_name})")
                return True
            else:
                print("Password verification failed!")
                return False
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(reset_password())
    if success:
        print("\nNow you can test login with:")
        print("Username: test111")
        print("Password: testpass")
        print("Login Type: personal")