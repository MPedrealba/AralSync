#!/usr/bin/env node

/**
 * AralSync Unified Development Orchestrator
 * Starts both the Next.js frontend and the Python OpenCV AI microservice concurrently.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const pythonDir = path.join(rootDir, 'python-service');

function isPythonServiceRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function resolvePythonBinary() {
  const winVenv = path.join(pythonDir, '.venv', 'Scripts', 'python.exe');
  if (process.platform === 'win32' && fs.existsSync(winVenv)) {
    return winVenv;
  }
  const posixVenv = path.join(pythonDir, '.venv', 'bin', 'python');
  if (fs.existsSync(posixVenv)) {
    return posixVenv;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

async function start() {
  const children = [];

  const cleanup = () => {
    children.forEach((child) => {
      if (!child || child.killed) return;
      try {
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
        } else if (child.pid) {
          child.kill('SIGTERM');
        }
      } catch {
        // ignore
      }
    });
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('exit', () => {
    cleanup();
  });

  const pythonOnly = process.argv.includes('--python-only');

  // 1. Check & start Python microservice
  const pythonAlreadyRunning = await isPythonServiceRunning();
  if (pythonAlreadyRunning) {
    console.log('\x1b[32m[OMR Vision Service]\x1b[0m Python OpenCV service is already running on http://127.0.0.1:8000');
    if (pythonOnly) {
      process.exit(0);
    }
  } else {
    const pythonBin = resolvePythonBinary();
    console.log(`\x1b[34m[OMR Vision Service]\x1b[0m Starting Python OpenCV microservice on http://127.0.0.1:8000 using ${pythonBin}...`);

    const pyProcess = spawn(
      pythonBin,
      ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'],
      {
        cwd: pythonDir,
        stdio: 'inherit',
        shell: false,
      }
    );

    pyProcess.on('error', (err) => {
      console.error('\x1b[31m[OMR Vision Service Error]\x1b[0m Failed to spawn Python microservice:', err.message);
    });

    children.push(pyProcess);

    if (pythonOnly) {
      pyProcess.on('close', (code) => {
        cleanup();
        process.exit(code || 0);
      });
      return;
    }
  }

  // 2. Start Next.js development server
  console.log('\x1b[35m[Next.js]\x1b[0m Starting Next.js development server on http://localhost:3000...');
  const nextCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const nextProcess = spawn(nextCmd, ['next', 'dev'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });

  nextProcess.on('error', (err) => {
    console.error('\x1b[31m[Next.js Error]\x1b[0m Failed to spawn Next.js dev server:', err.message);
  });

  nextProcess.on('close', (code) => {
    cleanup();
    process.exit(code || 0);
  });

  children.push(nextProcess);
}

start();
