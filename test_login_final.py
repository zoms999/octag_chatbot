#!/usr/bin/env python3
"""
Test login with known credentials
"""
import requests
import json

def test_login():
    try:
        print("Testing login endpoint...")
        
        login_data = {
            "username": "test111",
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
            print("✅ Login successful!")
            data = response.json()
            print(f"User ID: {data['user']['id']}")
            print(f"User Name: {data['user']['name']}")
            print(f"User Type: {data['user']['type']}")
            print(f"Access Token Length: {len(data['tokens']['access'])} chars")
            print(f"Refresh Token Length: {len(data['tokens']['refresh'])} chars")
            
            # Test the token by calling /me endpoint
            print("\nTesting token with /me endpoint...")
            me_response = requests.get(
                "http://localhost:8000/api/auth/me",
                headers={
                    "Authorization": f"Bearer {data['tokens']['access']}",
                    "Content-Type": "application/json"
                }
            )
            
            if me_response.status_code == 200:
                print("✅ Token validation successful!")
                me_data = me_response.json()
                print(f"Current user: {me_data}")
            else:
                print(f"❌ Token validation failed: {me_response.status_code}")
                print(me_response.text)
                
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_login()