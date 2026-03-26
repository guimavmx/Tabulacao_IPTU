#!/usr/bin/env node
// Script de inicialização do IPTU Extractor
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname);
const nodeModules = path.join(dir, 'node_modules');

if (!fs.existsSync(nodeModules)) {
  console.log('📦 Instalando dependências...');
  execSync('npm install', { cwd: dir, stdio: 'inherit' });
}

require('./server.js');
