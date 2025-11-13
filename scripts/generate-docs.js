const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Generating WikiShield HTML documentation...\n');

// Create docs directory if it doesn't exist
if (!fs.existsSync('docs')) {
  fs.mkdirSync('docs');
  console.log('✓ Created docs/ directory');
}

try {
  // Run jsdoc to generate HTML documentation
  console.log('Generating documentation with JSDoc...');
  execSync('npx jsdoc -c jsdoc.json', { stdio: 'pipe' });
} catch (err) {
  // JSDoc may exit with non-zero even when docs are generated (due to JSDoc syntax warnings)
  // Check if docs were actually created
  if (!fs.existsSync('docs/index.html')) {
    console.error('Error generating documentation:', err.message);
    process.exit(1);
  }
  // Docs exist, so warnings are non-fatal
  console.log('Some JSDoc warnings (existing code comments need fixing)');
}

console.log('\nDocumentation generated successfully');
console.log('Documentation is in the docs/ directory');
