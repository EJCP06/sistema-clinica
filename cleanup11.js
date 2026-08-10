const fs = require('fs');
const file = 'C:\\Users\\Edward\\Desktop\\sistema clinica\\src\\app\\features\\turnero\\turnero.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// Find the last two lines that are just }
const lines = content.split('\n');
let removed = 0;
for (let i = lines.length - 1; i >= 0 && removed < 2; i--) {
  if (lines[i].trim() === '}') {
    lines.splice(i, 1);
    removed++;
  }
}
// Now add back ONE closing brace
lines.push('}');

content = lines.join('\n');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed extra brace, removed:', removed);