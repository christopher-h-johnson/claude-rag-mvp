#!/usr/bin/env node

/**
 * WebSocket Connection Diagnostic Tool
 * 
 * Run this script to diagnose WebSocket connection issues.
 * Usage: node diagnose-websocket.js
 */

const https = require('https');

// Configuration - update these from your .env
const WS_URL = 'wss://ftj9zrh5h0.execute-api.us-east-2.amazonaws.com/dev';
const API_URL = 'https://gv1ucj9hg9.execute-api.us-east-2.amazonaws.com/dev';

console.log('🔍 WebSocket Connection Diagnostic Tool\n');
console.log('Configuration:');
console.log('  WebSocket URL:', WS_URL);
console.log('  API URL:', API_URL);
console.log('');

// Step 1: Check if token exists in localStorage (browser only)
console.log('Step 1: C