const fs = require('fs');

const newImages = JSON.parse(fs.readFileSync('scratch/newImages.json'));
let appendStr = '';
for (const [key, val] of Object.entries(newImages)) {
  appendStr += `,\n  "${key}": "${val}"`;
}

let seedContent = fs.readFileSync('server/seed.js', 'utf8');

seedContent = seedContent.replace(
  /"Ratargul Swamp Forest": "spot-pictures\/Bishankandi-4.jpg" \/\/ similar nature\n\};/g,
  `"Ratargul Swamp Forest": "spot-pictures/Bishankandi-4.jpg" // similar nature${appendStr}\n};`
);

fs.writeFileSync('server/seed.js', seedContent);
console.log("Updated server/seed.js");
