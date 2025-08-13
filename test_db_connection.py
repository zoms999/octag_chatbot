#!/usr/bin/env python3
"""
Test database connection
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_database():
    try:
        from database.connection import db_manager
        
        print("Testing database connection...")
        result = await db_manager.test_connection()
        print(f"Database connection test: {'SUCCESS' if result else 'FAILED'}")
        
        if result:
            # Test a simple query
            async with db_manager.get_async_session() as session:
                from sqlalchemy import text
                result = await session.execute(text('SELECT version()'))
                version = result.scalar()
                print(f"PostgreSQL version: {version}")
                
                # Test if required tables exist
                result = await session.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('mwd_account', 'mwd_person')
                """))
                tables = [row[0] for row in result.fetchall()]
                print(f"Required tables found: {tables}")
                
                if not tables:
                    print("WARNING: Required tables not found. Database may need migration.")
        
    except Exception as e:
        print(f"Database error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return result

if __name__ == "__main__":
    success = asyncio.run(test_database())
    sys.exit(0 if success else 1)