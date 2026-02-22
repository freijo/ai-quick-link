const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
console.log('Manifest v3 OK:', manifest.manifest_version === 3);
console.log('Permissions:', manifest.permissions);
process.exit(0);
