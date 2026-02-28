#!/usr/bin/env python3
"""
Configure OpenSearch role mapping for Lambda IAM role.

This script maps the Lambda IAM role to OpenSearch's all_access role,
allowing the Lambda function to authenticate using IAM credentials.
"""

import sys
import json
import requests
from requests.auth import HTTPBasicAuth
import argparse


def configure_role_mapping(endpoint, master_user, master_password, lambda_role_arn):
    """
    Map Lambda IAM role to OpenSearch all_access role.
    
    Args:
        endpoint: OpenSearch domain endpoint
        master_user: OpenSearch master username
        master_password: OpenSearch master password
        lambda_role_arn: ARN of the Lambda IAM role to map
    """
    url = f"https://{endpoint}/_plugins/_security/api/rolesmapping/all_access"
    
    # Get current role mapping
    try:
        response = requests.get(
            url,
            auth=HTTPBasicAuth(master_user, master_password),
            headers={"Content-Type": "application/json"},
            verify=True
        )
        response.raise_for_status()
        current_mapping = response.json().get("all_access", {})
        print(f"Current role mapping: {json.dumps(current_mapping, indent=2)}")
    except requests.exceptions.RequestException as e:
        print(f"Error getting current role mapping: {e}")
        current_mapping = {}
    
    # Add Lambda role to backend_roles
    backend_roles = current_mapping.get("backend_roles", [])
    if lambda_role_arn not in backend_roles:
        backend_roles.append(lambda_role_arn)
    
    # Update role mapping
    payload = {
        "backend_roles": backend_roles,
        "hosts": current_mapping.get("hosts", []),
        "users": current_mapping.get("users", [])
    }
    
    try:
        response = requests.put(
            url,
            auth=HTTPBasicAuth(master_user, master_password),
            headers={"Content-Type": "application/json"},
            json=payload,
            verify=True
        )
        response.raise_for_status()
        print(f"✓ Successfully mapped Lambda role to OpenSearch all_access role")
        print(f"  Lambda Role ARN: {lambda_role_arn}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"✗ Error updating role mapping: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response: {e.response.text}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Configure OpenSearch role mapping for Lambda IAM role"
    )
    parser.add_argument("--endpoint", required=True, help="OpenSearch domain endpoint")
    parser.add_argument("--master-user", required=True, help="OpenSearch master username")
    parser.add_argument("--master-password", required=True, help="OpenSearch master password")
    parser.add_argument("--lambda-role-arn", required=True, help="Lambda IAM role ARN")
    
    args = parser.parse_args()
    
    success = configure_role_mapping(
        args.endpoint,
        args.master_user,
        args.master_password,
        args.lambda_role_arn
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
