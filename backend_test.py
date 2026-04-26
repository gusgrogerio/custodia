import requests
import sys
import json
from datetime import datetime
import uuid

class D1CustodiaAPITester:
    def __init__(self, base_url="https://d1-custodia.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.cookies = None
        self.tests_run = 0
        self.tests_passed = 0
        self.custody_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, cookies=self.cookies)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, data=data, headers=headers, cookies=self.cookies)
                else:
                    response = requests.post(url, json=data, headers=headers, cookies=self.cookies)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, cookies=self.cookies)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        if success:
            print(f"   User: {response.get('name', 'Unknown')} ({response.get('role', 'Unknown')})")
        return success

    def test_get_stats(self):
        """Test custody statistics with new fields"""
        success, response = self.run_test(
            "Get Custody Stats",
            "GET",
            "custodies/stats",
            200
        )
        if success:
            total_today = response.get('total_today', 0)
            pending = response.get('pending', 0)
            resolved = response.get('resolved', 0)
            expired = response.get('expired', 0)
            near_return = response.get('near_return', 0)
            ready_for_return = response.get('ready_for_return', 0)
            
            print(f"   Stats: Total Today: {total_today}, Pending: {pending}, Resolved: {resolved}")
            print(f"   Expired: {expired}, Near Return: {near_return}, Ready for Return: {ready_for_return}")
            
            # Verify all required fields are present
            required_fields = ['total_today', 'pending', 'resolved', 'expired', 'near_return', 'ready_for_return']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"   ❌ Missing fields in stats: {missing_fields}")
                return False
            else:
                print(f"   ✅ All required stats fields present")
        return success

    def test_list_custodies(self):
        """Test list custodies"""
        success, response = self.run_test(
            "List Custodies",
            "GET",
            "custodies",
            200
        )
        if success:
            print(f"   Found {len(response)} custodies")
        return success

    def test_create_custody(self):
        """Test create new custody with volume fields"""
        test_data = {
            "shipment_code": f"TEST{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "client_name": "Cliente Teste",
            "phone": "(11) 99999-9999",
            "address": "Rua Teste, 123 - São Paulo, SP",
            "occurrence_type": "cliente_ausente",
            "observation": "Teste automatizado - cliente não estava presente",
            "volume_current": 2,
            "volume_total": 3
        }
        
        success, response = self.run_test(
            "Create Custody with Volume Fields",
            "POST",
            "custodies",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.custody_id = response['id']
            box_number = response.get('box_number', 'N/A')
            volume_current = response.get('volume_current', 0)
            volume_total = response.get('volume_total', 0)
            days_without_treatment = response.get('days_without_treatment', 0)
            print(f"   Created custody ID: {self.custody_id}")
            print(f"   Auto-generated box_number: {box_number}")
            print(f"   Volume: {volume_current}/{volume_total}")
            print(f"   Days without treatment: {days_without_treatment}")
            
            # Verify box number format (CX-YYYYMMDD-NNN)
            if box_number and box_number.startswith('CX-') and len(box_number.split('-')) == 3:
                print(f"   ✅ Box number format is correct: {box_number}")
            else:
                print(f"   ❌ Box number format is incorrect: {box_number}")
                return False
                
            return True
        return False

    def test_get_custody(self):
        """Test get specific custody with new fields"""
        if not self.custody_id:
            print("❌ No custody ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Custody Details",
            "GET",
            f"custodies/{self.custody_id}",
            200
        )
        if success:
            shipment_code = response.get('shipment_code', 'Unknown')
            client_name = response.get('client_name', 'Unknown')
            box_number = response.get('box_number', 'N/A')
            volume_current = response.get('volume_current', 0)
            volume_total = response.get('volume_total', 0)
            days_without_treatment = response.get('days_without_treatment', 0)
            
            print(f"   Custody: {shipment_code} - {client_name}")
            print(f"   Box Number: {box_number}")
            print(f"   Volume: {volume_current}/{volume_total}")
            print(f"   Days without treatment: {days_without_treatment}")
            
            # Verify required new fields are present
            required_fields = ['box_number', 'volume_current', 'volume_total', 'days_without_treatment']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"   ❌ Missing fields: {missing_fields}")
                return False
            else:
                print(f"   ✅ All required fields present")
        return success

    def test_update_custody_status(self):
        """Test update custody status"""
        if not self.custody_id:
            print("❌ No custody ID available for testing")
            return False
            
        success, response = self.run_test(
            "Update Custody Status",
            "PATCH",
            f"custodies/{self.custody_id}",
            200,
            data={"status": "resolved"}
        )
        if success:
            print(f"   Status updated to: {response.get('status', 'Unknown')}")
        return success

    def test_add_observation(self):
        """Test add observation to custody"""
        if not self.custody_id:
            print("❌ No custody ID available for testing")
            return False
            
        success, response = self.run_test(
            "Add Observation",
            "PATCH",
            f"custodies/{self.custody_id}",
            200,
            data={"observation": "Observação de teste adicionada via API"}
        )
        return success

    def test_list_users(self):
        """Test list users"""
        success, response = self.run_test(
            "List Users",
            "GET",
            "users",
            200
        )
        if success:
            print(f"   Found {len(response)} users")
        return success

    def test_get_alerts(self):
        """Test custody alerts"""
        success, response = self.run_test(
            "Get Custody Alerts",
            "GET",
            "custodies/alerts",
            200
        )
        if success:
            print(f"   Found {len(response)} alerts")
            for alert in response[:3]:  # Show first 3 alerts
                alert_type = alert.get('type', 'unknown')
                box_number = alert.get('box_number', 'N/A')
                days = alert.get('days_without_treatment', 0)
                print(f"   Alert: {alert_type} - Box {box_number} - {days} days")
        return success

    def test_get_label(self):
        """Test custody label generation"""
        if not self.custody_id:
            print("❌ No custody ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Custody Label",
            "GET",
            f"custodies/{self.custody_id}/label",
            200
        )
        if success:
            box_number = response.get('box_number', 'N/A')
            shipment_code = response.get('shipment_code', 'Unknown')
            volume = response.get('volume', 'N/A')
            qr_data = response.get('qr_data', 'N/A')
            
            print(f"   Label data: Box {box_number}, Code {shipment_code}")
            print(f"   Volume: {volume}, QR Data: {qr_data}")
            
            # Verify required label fields
            required_fields = ['box_number', 'shipment_code', 'client_name', 'volume', 'qr_data']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"   ❌ Missing label fields: {missing_fields}")
                return False
            else:
                print(f"   ✅ All required label fields present")
        return success

    def test_export_csv(self):
        """Test CSV export with new columns"""
        success, response = self.run_test(
            "Export CSV with New Columns",
            "GET",
            "custodies/export/csv",
            200
        )
        if success:
            print(f"   CSV export successful")
            # Note: CSV content validation would require parsing the response
            # For now, we just verify the endpoint returns 200
        return success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

def main():
    print("🚀 Starting D1 Custódia API Tests")
    print("=" * 50)
    
    # Setup
    tester = D1CustodiaAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Login", lambda: tester.test_login("admin", "123456789")),
        ("Get Current User", tester.test_get_me),
        ("Get Stats", tester.test_get_stats),
        ("List Custodies", tester.test_list_custodies),
        ("Get Alerts", tester.test_get_alerts),
        ("Create Custody", tester.test_create_custody),
        ("Get Custody Details", tester.test_get_custody),
        ("Get Label", tester.test_get_label),
        ("Update Custody Status", tester.test_update_custody_status),
        ("Add Observation", tester.test_add_observation),
        ("List Users", tester.test_list_users),
        ("Export CSV", tester.test_export_csv),
        ("Logout", tester.test_logout),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())