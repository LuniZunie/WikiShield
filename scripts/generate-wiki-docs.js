const jsdoc2md = require('jsdoc-to-markdown');
const fs = require('fs');
const path = require('path');

const sections = [
  {
    name: 'Core-API',
    description: 'Core WikiShield functionality',
    files: ['src/core/*.js'],
    output: 'wiki/Core-API.md'
  },
  {
    name: 'UI-Components',
    description: 'User interface components and settings',
    files: ['src/ui/*.js', 'src/ui/*.jsx'],
    output: 'wiki/UI-Components.md'
  },
  {
    name: 'AI-Integration',
    description: 'AI analysis and Ollama integration',
    files: ['src/ai/*.js'],
    output: 'wiki/AI-Integration.md'
  },
  {
    name: 'Data-Modules',
    description: 'Data structures, warnings, events, and sounds',
    files: ['src/data/*.js'],
    output: 'wiki/Data-Modules.md'
  },
  {
    name: 'Utilities',
    description: 'Helper functions and utilities',
    files: ['src/utils/*.js'],
    output: 'wiki/Utilities.md'
  },
  {
    name: 'Configuration',
    description: 'Configuration and default settings',
    files: ['src/config/*.js'],
    output: 'wiki/Configuration.md'
  }
];

async function generateDocs() {
  console.log('Generating WikiShield documentation...\n');
  
  // Create wiki directory if it doesn't exist
  if (!fs.existsSync('wiki')) {
    fs.mkdirSync('wiki');
    console.log('Created wiki/ directory');
  }

  // Generate home page with table of contents
  let homeContent = `# WikiShield Docs

These docs are automatically generated from JSDoc comments in the source code. See the [Wikipedia page](https://en.wikipedia.org/wiki/Wikipedia:WikiShield) for more information.

`;

  let successCount = 0;
  let errorCount = 0;

  for (const section of sections) {
    console.log(`Generating ${section.name}...`);
    
    try {
      const markdown = await jsdoc2md.render({
        files: section.files,
        'no-cache': true,
        separators: true,
        'heading-depth': 2,
        'module-index-format': 'table',
        'global-index-format': 'table'
      });
      
      // Add section header
      const content = `# ${section.name}

${section.description}

---

${markdown}

---

*This documentation was automatically generated from JSDoc comments.*
`;
      
      fs.writeFileSync(section.output, content);
      homeContent += `### [${section.name}](${path.basename(section.output, '.md')})\n${section.description}\n\n`;
      
      console.log(`   ✓ Generated ${section.output}`);
      successCount++;
    } catch (err) {
      console.error(`   ✗ Error generating ${section.name}:`, err.message);
      errorCount++;
    }
  }

  // Add quick links section
  homeContent += `\n## Quick Links

- [Installation Guide](Installation)
- [Getting Started](Getting-Started)
- [Contributing](Contributing)
- [Changelog](Changelog)

`;

  // Add metadata
  const packageJson = require('../package.json');
  homeContent += `\n---

## Project Information

- **Version**: ${packageJson.version}
- **License**: ${packageJson.license}
- **Authors**: ${packageJson.author}
- **Last Updated**: ${new Date().toLocaleString()}

---

*Documentation generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown)*
`;
  
  fs.writeFileSync('wiki/Home.md', homeContent);
  console.log('\n✓ Generated wiki/Home.md');
  
  console.log(`\nDocumentation generation complete!`);
  console.log(`   Success: ${successCount} sections`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount} sections`);
  }
  console.log(`\nDocumentation files are in the wiki/ directory`);
  console.log(`   git clone https://github.com/username/WikiShield.wiki.git`);
}

generateDocs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

