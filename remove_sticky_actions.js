const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Replace <th> with sticky Actions
    const thStickyRegex = /<th\s+class="px-8 py-5 text-right md:sticky md:right-0 bg-slate-50 dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-800">Acciones<\/th>/g;
    if (thStickyRegex.test(content)) {
        content = content.replace(thStickyRegex, '<th class="px-8 py-5 text-center border-b border-slate-200 dark:border-slate-800">Acciones</th>');
        modified = true;
    }

    // 2. Replace <td> with sticky Actions
    const tdStickyRegex = /<td\s+class="px-8 py-\[20px\] text-right md:sticky md:right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-10 border-b border-slate-100\/30 dark:border-slate-800\/10">/g;
    if (tdStickyRegex.test(content)) {
        content = content.replace(tdStickyRegex, '<td class="px-8 py-[20px] text-center border-b border-slate-100/30 dark:border-slate-800/10">');
        modified = true;
    }

    // 3. For any td we modified or are in, if the next line has flex justify-end or items-center justify-end, change to justify-center
    // Let's do a direct replacement of flex justify-end / items-center justify-end inside Actions column
    // Since we simplified the td to '<td class="px-8 py-[20px] text-center border-b border-slate-100/30 dark:border-slate-800/10">'
    // we can search for that and replace the subsequent justify-end with justify-center
    const targetTd = '<td class="px-8 py-[20px] text-center border-b border-slate-100/30 dark:border-slate-800/10">';
    
    // We can do a split and process to find the subsequent div
    if (modified) {
        let lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(targetTd)) {
                // Look at the next few lines for any div with justify-end
                for (let j = 1; j <= 3; j++) {
                    if (i + j < lines.length && lines[i + j].includes('justify-end')) {
                        lines[i + j] = lines[i + j].replace('justify-end', 'justify-center');
                        break;
                    }
                }
            }
        }
        content = lines.join('\n');
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated Actions column styles in: ${filePath}`);
    }
}

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.html')) {
            processHtmlFile(fullPath);
        }
    }
}

processDirectory(featuresPath);
console.log('Done!');
