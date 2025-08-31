#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:80';

function checkService(name, url, path = '/health') {
  return new Promise((resolve) => {
    const req = http.request(`${url}${path}`, { method: 'GET', timeout: 5000 }, (res) => {
      if (res.statusCode === 200) {
        resolve({ name, status: 'UP', responseTime: Date.now() });
      } else {
        resolve({ name, status: 'DOWN', error: `HTTP ${res.statusCode}` });
      }
    });

    req.on('error', (err) => {
      resolve({ name, status: 'DOWN', error: err.message });
    });

    req.on('timeout', () => {
      resolve({ name, status: 'DOWN', error: 'Timeout' });
      req.destroy();
    });

    req.end();
  });
}

async function checkSystemResources() {
  return new Promise((resolve) => {
    exec('ps aux | grep -E "(node|nginx)" | grep -v grep', (error, stdout) => {
      const processes = stdout.split('\n').filter(line => line.trim());
      resolve({
        nodeProcesses: processes.filter(p => p.includes('node')).length,
        nginxProcesses: processes.filter(p => p.includes('nginx')).length
      });
    });
  });
}

async function monitor() {
  console.log(`[${new Date().toISOString()}] 🔍 Starting system health check...`);

  const [backend, frontend, resources] = await Promise.all([
    checkService('Backend', BACKEND_URL),
    checkService('Frontend', FRONTEND_URL, '/health'),
    checkSystemResources()
  ]);

  const services = [backend, frontend];
  const healthy = services.filter(s => s.status === 'UP').length;
  const total = services.length;

  console.log(`📊 Services: ${healthy}/${total} healthy`);
  console.log(`🔧 Processes: Node.js (${resources.nodeProcesses}), Nginx (${resources.nginxProcesses})`);

  services.forEach(service => {
    const status = service.status === 'UP' ? '✅' : '❌';
    console.log(`${status} ${service.name}: ${service.status}${service.error ? ` (${service.error})` : ''}`);
  });

  // Alert if services are down
  if (healthy < total) {
    console.log('🚨 ALERT: Some services are down!');
    process.exit(1);
  } else {
    console.log('✅ All systems operational');
  }
}

// Run monitoring
monitor().catch(console.error);
