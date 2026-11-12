const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../public');
const hash = crypto.createHash('sha256');
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (file !== path.join(root, 'release.js')) {
      hash.update(path.relative(root, file).replaceAll('\\', '/'));
      hash.update(fs.readFileSync(file));
    }
  }
}
visit(root);
const version = hash.digest('hex');
fs.writeFileSync(path.join(root, 'release.js'), `self.APP_RELEASE = '${version}';\n`);
console.log('Hosting release: ' + version.slice(0, 12));
