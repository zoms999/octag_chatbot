#!/usr/bin/env python3
"""
Debug login functionality step by step
"""
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def debug_login():
    try:
        from database.connection import db_manager
        from sqlalchemy import text
        
        print("=== Debugging Login Process ===")
        
        async with db_manager.get_async_session() as session:
            # Step 1: Test the exact query from auth_endpoints.py
            print("1. Testing account query...")
            
            result = await session.execute(
                text("""
                    SELECT pe.pe_seq, pe.pe_name, ac.ac_gid, ac.ac_use, ac.ac_id
                    FROM mwd_person pe
                    JOIN mwd_account ac ON ac.pe_seq = pe.pe_seq 
                    WHERE ac.ac_id = lower(:username) 
                    AND ac.ac_pw = CRYPT(:password, ac.ac_pw)
                """),
                {"username": "test111", "password": "testpass"}
            )
            
            account_row = result.fetchone()
            
            if account_row:
                print(f"✅ Account found: {account_row}")
                pe_seq, pe_name, ac_gid, ac_use, ac_id = account_row
                
                # Step 2: Check if it's an admin account (pe_seq = -1)
                print(f"2. Checking account type (pe_seq = {pe_seq})...")
                if pe_seq == -1:
                    print("❌ This is an admin account")
                else:
                    print("✅ This is a regular user account")
                
                # Step 3: Check institute membership
                print("3. Checking institute membership...")
                institute_check = await session.execute(
                    text("""
                        SELECT COUNT(*) as count
                        FROM mwd_institute_member im
                        WHERE im.pe_seq = :pe_seq
                    """),
                    {"pe_seq": pe_seq}
                )
                
                institute_count = institute_check.fetchone().count
                print(f"Institute membership count: {institute_count}")
                
                if institute_count > 0:
                    print("❌ User is institute member, should use organization login")
                else:
                    print("✅ User is not institute member, can use personal login")
                
                # Step 4: Test payment status query
                print("4. Testing payment status query...")
                payment_result = await session.execute(
                    text("""
                        SELECT cr_pay, pd_kind, expire, state FROM (
                            SELECT ac.ac_gid, row_number() OVER (ORDER BY cr.cr_seq DESC) rnum,
                                   COALESCE(cr.cr_pay, 'N') cr_pay, 
                                   COALESCE(cr.pd_kind, '') pd_kind,
                                   CASE WHEN ac.ac_expire_date >= now() THEN 'Y' ELSE 'N' END expire,
                                   COALESCE(ap.anp_done, 'R') state
                            FROM mwd_person pe, mwd_account ac
                            LEFT OUTER JOIN mwd_choice_result cr ON cr.ac_gid = ac.ac_gid
                            LEFT OUTER JOIN mwd_answer_progress ap ON ap.cr_seq = cr.cr_seq
                            WHERE ac.ac_gid = :ac_gid::uuid
                            AND pe.pe_seq = ac.pe_seq AND ac.ac_use = 'Y'
                        ) t WHERE rnum = 1
                    """),
                    {"ac_gid": str(ac_gid)}
                )
                
                payment_row = payment_result.fetchone()
                if payment_row:
                    print(f"✅ Payment info: {payment_row}")
                else:
                    print("⚠️ No payment info found")
                
                # Step 5: Test gender query
                print("5. Testing gender query...")
                gender_result = await session.execute(
                    text("""
                        SELECT pe.pe_sex 
                        FROM mwd_account ac, mwd_person pe 
                        WHERE ac.ac_gid = :ac_gid::uuid
                        AND pe.pe_seq = ac.pe_seq
                    """),
                    {"ac_gid": str(ac_gid)}
                )
                
                gender_row = gender_result.fetchone()
                if gender_row:
                    print(f"✅ Gender info: {gender_row.pe_sex}")
                else:
                    print("⚠️ No gender info found")
                
                print("=== All queries successful! ===")
                
            else:
                print("❌ No account found with these credentials")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_login())