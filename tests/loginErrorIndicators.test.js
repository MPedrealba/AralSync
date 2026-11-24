import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('Login Page Error Indicators & Authentication Error Contract Suite', () => {
  const loginRoutePath = path.join(process.cwd(), 'src/app/api/auth/login/route.ts');
  const loginPagePath = path.join(process.cwd(), 'src/app/login/page.tsx');
  const globalsCssPath = path.join(process.cwd(), 'src/app/globals.css');

  const routeSource = fs.readFileSync(loginRoutePath, 'utf-8');
  const pageSource = fs.readFileSync(loginPagePath, 'utf-8');
  const cssSource = fs.readFileSync(globalsCssPath, 'utf-8');

  describe('1. API Route Contract (src/app/api/auth/login/route.ts)', () => {
    it('returns structured username not found error with field: "username"', () => {
      assert.ok(
        routeSource.includes('"No account found with that username. Please verify your username or LRN."'),
        'Must return specific username not found message'
      );
      assert.ok(
        routeSource.includes('field: "username"'),
        'Must include field: "username" for missing user'
      );
    });

    it('returns structured incorrect password error with field: "password"', () => {
      assert.ok(
        routeSource.includes('"Incorrect password. Please try again."'),
        'Must return specific password mismatch message'
      );
      assert.ok(
        routeSource.includes('field: "password"'),
        'Must include field: "password" for password mismatch'
      );
    });

    it('returns structured role mismatch error with field: "role"', () => {
      assert.ok(
        routeSource.includes('Role mismatch: This account is registered as a ${actualLabel}. Please choose ${actualLabel} in the role selector.'),
        'Must format role mismatch message accurately with actualLabel'
      );
      assert.ok(
        routeSource.includes('field: "role"'),
        'Must include field: "role" for role mismatch'
      );
    });

    it('returns field metadata for missing inputs (username, password, role)', () => {
      assert.ok(
        routeSource.includes('missingField') && routeSource.includes('field: missingField'),
        'Must identify whether username or password was missing'
      );
      assert.ok(
        routeSource.includes('"Please select your role"') && routeSource.includes('field: "role"'),
        'Must return field: "role" when role is empty'
      );
    });

    it('returns success: false across all error response payloads', () => {
      const errorBlocks = routeSource.match(/NextResponse\.json\(\s*\{[^}]*success:\s*false[^}]*\}/g);
      assert.ok(errorBlocks && errorBlocks.length >= 5, 'Must have multiple structured error payloads with success: false');
    });
  });

  describe('2. Login Page UI & UX (src/app/login/page.tsx)', () => {
    it('applies the required red border and soft red ring to affected inputs', () => {
      assert.ok(
        pageSource.includes('border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-red-500/20') ||
        pageSource.includes('border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'),
        'Must apply border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-red-500/20 to affected inputs'
      );
    });

    it('implements shake animation on failed submission', () => {
      assert.ok(
        pageSource.includes('animate-shake'),
        'Must include animate-shake class'
      );
      assert.ok(
        pageSource.includes('isShaking') && pageSource.includes('triggerShake'),
        'Must have shake state and trigger mechanism'
      );
    });

    it('renders inline error hints beneath username, password, and role fields', () => {
      assert.ok(
        pageSource.includes('errorField === "username"') && pageSource.includes('Check your username'),
        'Must render inline error hint beneath username'
      );
      assert.ok(
        pageSource.includes('errorField === "password"') && pageSource.includes('Incorrect password'),
        'Must render inline error hint beneath password'
      );
      assert.ok(
        pageSource.includes('errorField === "role"'),
        'Must render inline error hint beneath role selector'
      );
    });

    it('automatically clears the error state when typing or changing selection', () => {
      assert.ok(
        pageSource.includes('clearFieldError("username")'),
        'Must clear username error on typing'
      );
      assert.ok(
        pageSource.includes('clearFieldError("password")'),
        'Must clear password error on typing'
      );
      assert.ok(
        pageSource.includes('clearFieldError("role")'),
        'Must clear role error on selection change'
      );
    });

    it('renders the polished alert banner with Login Failed title and warning icon', () => {
      assert.ok(
        pageSource.includes('Login Failed:'),
        'Must include bold Login Failed: title in alert banner'
      );
      assert.ok(
        pageSource.includes('AlertCircle'),
        'Must include clear warning icon (AlertCircle)'
      );
      assert.ok(
        pageSource.includes('animate-fadeInDown'),
        'Must animate entry of the alert banner'
      );
    });
  });

  describe('3. Animation Styles in globals.css', () => {
    it('defines keyframes and utility for shake animation', () => {
      assert.ok(cssSource.includes('@keyframes shake'), 'Must define @keyframes shake');
      assert.ok(cssSource.includes('.animate-shake'), 'Must define .animate-shake utility');
    });

    it('defines keyframes and utility for fadeInDown animated entry', () => {
      assert.ok(cssSource.includes('@keyframes fadeInDown'), 'Must define @keyframes fadeInDown');
      assert.ok(cssSource.includes('.animate-fadeInDown'), 'Must define .animate-fadeInDown utility');
    });
  });
});
