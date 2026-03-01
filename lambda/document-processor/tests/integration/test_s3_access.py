#!/usr/bin/env python3
"""
Quick S3 Access Test

This script tests if you have the necessary S3 permissions
before running the full integration test suite.
"""

import os
import sys
import boto3
from botocore.exceptions import ClientError

def test_s3_access():
    """Test S3 bucket access with required permissions"""
    
    # Get bucket name from environment
    bucket_name = os.environ.get('TEST_BUCKET_NAME')
    
    if not bucket_name:
        print("❌ TEST_BUCKET_NAME environment variable not set")
        print("\nPlease run: bash setup_test_env.sh")
        return False
    
    print(f"Testing S3 access to: {bucket_name}")
    print("-" * 60)
    
    s3_client = boto3.client('s3')
    test_key = "test-access/test.txt"
    test_content = b"test"
    
    all_passed = True
    
    # Test 1: List bucket
    print("\n1. Testing s3:ListBucket permission...")
    try:
        s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        print("   ✓ ListBucket: PASS")
    except ClientError as e:
        print(f"   ✗ ListBucket: FAIL - {e.response['Error']['Code']}")
        all_passed = False
    
    # Test 2: Put object
    print("\n2. Testing s3:PutObject permission...")
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=test_key,
            Body=test_content
        )
        print("   ✓ PutObject: PASS")
    except ClientError as e:
        print(f"   ✗ PutObject: FAIL - {e.response['Error']['Code']}")
        print(f"   Error: {e.response['Error']['Message']}")
        all_passed = False
        return all_passed  # Can't continue without PutObject
    
    # Test 3: Get object
    print("\n3. Testing s3:GetObject permission...")
    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=test_key)
        content = response['Body'].read()
        if content == test_content:
            print("   ✓ GetObject: PASS")
        else:
            print("   ✗ GetObject: FAIL - Content mismatch")
            all_passed = False
    except ClientError as e:
        print(f"   ✗ GetObject: FAIL - {e.response['Error']['Code']}")
        all_passed = False
    
    # Test 4: Delete object
    print("\n4. Testing s3:DeleteObject permission...")
    try:
        s3_client.delete_object(Bucket=bucket_name, Key=test_key)
        print("   ✓ DeleteObject: PASS")
    except ClientError as e:
        print(f"   ✗ DeleteObject: FAIL - {e.response['Error']['Code']}")
        all_passed = False
    
    # Test 5: Verify deletion
    print("\n5. Verifying cleanup...")
    try:
        s3_client.head_object(Bucket=bucket_name, Key=test_key)
        print("   ✗ Cleanup: FAIL - Object still exists")
        all_passed = False
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            print("   ✓ Cleanup: PASS")
        else:
            print(f"   ✗ Cleanup: FAIL - {e.response['Error']['Code']}")
            all_passed = False
    
    print("\n" + "=" * 60)
    
    if all_passed:
        print("✓ All S3 permissions verified!")
        print("\nYou can now run the integration tests:")
        print("  bash run_tests.sh")
        return True
    else:
        print("✗ Some S3 permissions are missing")
        print("\nPlease add the required IAM permissions.")
        print("See TROUBLESHOOTING.md for detailed instructions.")
        return False

if __name__ == '__main__':
    try:
        success = test_s3_access()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
