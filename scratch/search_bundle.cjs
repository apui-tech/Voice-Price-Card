const fs = require('fs');

const filepath = 'd:/code/mother_app/dist/assets/index-Bj3V2ha3.js';
console.log("Reading bundle:", filepath);
const content = fs.readFileSync(filepath, 'utf8');

// Find all matches for let/const/var/function ze, or similar declarations
const regex = /\b(let|const|var|function)\s+ze\b/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Found declaration at index ${match.index}: "${match[0]}"`);
  console.log(content.substring(match.index - 100, match.index + 200));
  console.log("-----------------------------------------");
}
