const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// We need jsdom for mermaid to work in Node
async function render() {
  const { default: mermaid } = await import('mermaid');

  const diagramsDir = path.join(__dirname, '..', 'docs', 'diagrams');
  const files = fs.readdirSync(diagramsDir).filter(f => f.endsWith('.mmd'));

  for (const file of files) {
    const mmdPath = path.join(diagramsDir, file);
    const svgPath = path.join(diagramsDir, file.replace('.mmd', '.svg'));
    const pngPath = path.join(diagramsDir, file.replace('.mmd', '.svg'));

    const mmdContent = fs.readFileSync(mmdPath, 'utf-8');

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: {
          primaryColor: '#2ea857',
          primaryTextColor: '#fff',
          primaryBorderColor: '#1f7a3d',
          lineColor: '#718096',
          secondaryColor: '#E8F0FE',
          tertiaryColor: '#F7F9FC',
        },
      });

      const { svg } = await mermaid.render(`diagram-${file.replace('.mmd', '')}`, mmdContent);
      fs.writeFileSync(svgPath, svg);
      console.log(`Rendered: ${file} -> ${path.basename(svgPath)}`);
    } catch (err) {
      console.error(`Failed to render ${file}: ${err.message}`);
    }
  }
}

render().then(() => console.log('Done!')).catch(console.error);
