const fs = require('fs');
const file = 'C:\\Users\\Edward\\Desktop\\sistema clinica\\src\\app\\features\\turnero\\turnero.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// The file has the class closing then an extra }
content = content.replace(/}\n\}\s*$/, '}\n');

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed extra brace');