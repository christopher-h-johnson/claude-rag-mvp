#!/bin/bash

# Verify that Lambda functions are properly set up for building

echo "Verifying Vector Store Lambda setup..."
echo ""

ERRORS=0

# Check init-index
echo "Checking init-index Lambda..."

if [ ! -f "init-index/package.json" ]; then
    echo "  ✗ package.json not found"
    ERRORS=$((ERRORS + 1))
else
    if grep -q "build:terraform" init-index/package.json; then
        echo "  ✓ package.json has build:terraform script"
    else
        echo "  ✗ package.json missing build:terraform script"
        ERRORS=$((ERRORS + 1))
    fi
fi

if [ ! -f "init-index/build-for-terraform.sh" ]; then
    echo "  ✗ build-for-terraform.sh not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ build-for-terraform.sh exists"
fi

if [ ! -f "init-index/tsconfig.json" ]; then
    echo "  ✗ tsconfig.json not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ tsconfig.json exists"
fi

echo ""

# Check configure-access
echo "Checking configure-access Lambda..."

if [ ! -f "configure-access/package.json" ]; then
    echo "  ✗ package.json not found"
    ERRORS=$((ERRORS + 1))
else
    if grep -q "build:terraform" configure-access/package.json; then
        echo "  ✓ package.json has build:terraform script"
    else
        echo "  ✗ package.json missing build:terraform script"
        ERRORS=$((ERRORS + 1))
    fi
fi

if [ ! -f "configure-access/build-for-terraform.sh" ]; then
    echo "  ✗ build-for-terraform.sh not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ build-for-terraform.sh exists"
fi

if [ ! -f "configure-access/tsconfig.json" ]; then
    echo "  ✗ tsconfig.json not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ tsconfig.json exists"
fi

echo ""

# Check build-all script
echo "Checking build-all script..."

if [ ! -f "build-all.sh" ]; then
    echo "  ✗ build-all.sh not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ build-all.sh exists"
fi

echo ""
echo "=========================================="

if [ $ERRORS -eq 0 ]; then
    echo "✓ All checks passed!"
    echo ""
    echo "Ready to build. Run:"
    echo "  bash build-all.sh"
    exit 0
else
    echo "✗ Found $ERRORS error(s)"
    echo ""
    echo "Please fix the errors above before building."
    exit 1
fi
