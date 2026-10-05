const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'config.js', 'ui.js', 'styles.css', 'assets', 'design-system']) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true, force: true });
}
console.log('Static webinar dashboard built in public/');
