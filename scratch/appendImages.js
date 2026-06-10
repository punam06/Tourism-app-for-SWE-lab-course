const fs = require('fs');
const newImages = JSON.parse(fs.readFileSync('scratch/newImages.json'));
let appendStr = '';
for (const [key, val] of Object.entries(newImages)) {
  appendStr += `,\n  "${key}": "${val}"`;
}
console.log(appendStr);
