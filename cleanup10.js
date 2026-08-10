const fs = require('fs');
const file = 'C:\\Users\\Edward\\Desktop\\sistema clinica\\src\\app\\features\\turnero\\turnero.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

const lines = content.split('\n');
// Remove the last }
if (lines[lines.length - 1].trim() === '}') {
  lines.pop(); // Remove the extra }
  if (lines[lines.length - 1].trim() === '') {
    lines.pop(); // Remove empty line before
  }
}
content = lines.join('\n');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed extra brace');