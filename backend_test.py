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

    def test_get_central_stats(self):
        """Test central custody statistics for Central de Custódias page"""
        success, response = self.run_test(
            "Get Central Stats",
            "GET",
            "custodies/central-stats",
            200
        )
        if success:
            total = response.get('total', 0)
            awaiting_return = response.get('awaiting_return', 0)
            near_return = response.get('near_return', 0)
            ready_for_return = response.get('ready_for_return', 0)
            finalized = response.get('finalized', 0)
            no_photos = response.get('no_photos', 0)
            
            print(f"   Central Stats: Total: {total}, Awaiting: {awaiting_return}, Near Return: {near_return}")
            print(f"   Ready for Return: {ready_for_return}, Finalized: {finalized}, No Photos: {no_photos}")
            
            # Verify all required fields are present
            required_fields = ['total', 'awaiting_return', 'near_return', 'ready_for_return', 'finalized', 'no_photos']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                print(f"   ❌ Missing fields in central stats: {missing_fields}")
                return False
            else:
                print(f"   ✅ All required central stats fields present")
        return success

    def test_custodies_with_search_filters(self):
        """Test custodies endpoint with search_code and search_box filters"""
        # Test search_code filter
        success1, response1 = self.run_test(
            "Search Custodies by Code",
            "GET",
            "custodies?search_code=TEST",
            200
        )
        
        # Test search_box filter  
        success2, response2 = self.run_test(
            "Search Custodies by Box",
            "GET",
            "custodies?search_box=CX-",
            200
        )
        
        if success1 and success2:
            print(f"   Search by code found: {len(response1)} custodies")
            print(f"   Search by box found: {len(response2)} custodies")
            print(f"   ✅ Search filters working correctly")
            return True
        return False

    def test_custodies_with_special_filters(self):
        """Test custodies endpoint with no_photos and no_treatment filters"""
        # Test no_photos filter
        success1, response1 = self.run_test(
            "Filter Custodies with No Photos",
            "GET",
            "custodies?no_photos=true",
            200
        )
        
        # Test no_treatment filter
        success2, response2 = self.run_test(
            "Filter Custodies with No Treatment",
            "GET",
            "custodies?no_treatment=true",
            200
        )
        
        if success1 and success2:
            print(f"   No photos filter found: {len(response1)} custodies")
            print(f"   No treatment filter found: {len(response2)} custodies")
            print(f"   ✅ Special filters working correctly")
            return True
        return False

    def test_custodies_sort_by_days(self):
        """Test custodies endpoint with sort_by=days_without_treatment"""
        success, response = self.run_test(
            "Sort Custodies by Days Without Treatment",
            "GET",
            "custodies?sort_by=days_without_treatment&limit=10",
            200
        )
        
        if success:
            print(f"   Sorted custodies found: {len(response)} custodies")
            if len(response) > 1:
                # Check if sorting is working (first should have more days than last)
                first_days = response[0].get('days_without_treatment', 0)
                last_days = response[-1].get('days_without_treatment', 0)
                print(f"   First custody days: {first_days}, Last custody days: {last_days}")
                if first_days >= last_days:
                    print(f"   ✅ Sorting by days without treatment working correctly")
                else:
                    print(f"   ❌ Sorting by days without treatment not working correctly")
                    return False
            else:
                print(f"   ✅ Sort endpoint working (insufficient data to verify order)")
            return True
        return False

    def test_bulk_update_mark_returned(self):
        """Test bulk update endpoint with mark_returned action"""
        if not self.custody_id:
            print("❌ No custody ID available for bulk update testing")
            return False
            
        success, response = self.run_test(
            "Bulk Update Mark as Returned",
            "POST",
            "custodies/bulk-update",
            200,
            data={
                "custody_ids": [self.custody_id],
                "action": "mark_returned"
            }
        )
        
        if success:
            updated_count = response.get('updated_count', 0)
            print(f"   Bulk update successful: {updated_count} custodies updated")
            if updated_count > 0:
                print(f"   ✅ Bulk update mark_returned working correctly")
                return True
            else:
                print(f"   ❌ Bulk update didn't update any custodies")
                return False
        return False

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
        ("Get Central Stats", tester.test_get_central_stats),
        ("List Custodies", tester.test_list_custodies),
        ("Search Filters", tester.test_custodies_with_search_filters),
        ("Special Filters", tester.test_custodies_with_special_filters),
        ("Sort by Days", tester.test_custodies_sort_by_days),
        ("Get Alerts", tester.test_get_alerts),
        ("Create Custody", tester.test_create_custody),
        ("Get Custody Details", tester.test_get_custody),
        ("Get Label", tester.test_get_label),
        ("Update Custody Status", tester.test_update_custody_status),
        ("Add Observation", tester.test_add_observation),
        ("Bulk Update Mark Returned", tester.test_bulk_update_mark_returned),
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