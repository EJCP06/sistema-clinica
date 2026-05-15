const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\Edward\\.gemini\\antigravity\\brain\\14eec768-f974-49c5-b2ca-2aba3097105a\\.system_generated\\logs\\overview.txt', 'utf8').split('\n');
let lastMatch = '';
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('VIEW_FILE') && lines[i].includes('recepcion.html')) {
    lastMatch = lines[i];
  }
}
if (lastMatch) {
  fs.writeFileSync('scratch_old_recepcion.txt', lastMatch);
  console.log('Extracted!');
} else {
  console.log('Not found');
}
