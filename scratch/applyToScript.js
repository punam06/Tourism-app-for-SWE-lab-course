const fs = require('fs');

const newImages = JSON.parse(fs.readFileSync('scratch/newImages.json'));
let appendStr = '';
for (const [key, val] of Object.entries(newImages)) {
  appendStr += `,\n  "${key}": "${val}"`;
}

let scriptContent = fs.readFileSync('script.js', 'utf8');

scriptContent = scriptContent.replace(
  /"Ratargul Swamp Forest": "spot-pictures\/Bishankandi-4.jpg" \/\/ similar nature\n\};/g,
  `"Ratargul Swamp Forest": "spot-pictures/Bishankandi-4.jpg" // similar nature${appendStr}\n};`
);

fs.writeFileSync('script.js', scriptContent);
console.log("Updated script.js");
