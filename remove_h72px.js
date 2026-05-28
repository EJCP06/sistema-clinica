const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Remove h-[72px] from <tr> classes
    // e.g. <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800 h-[72px]">
    // to <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800">
    const trRegex = /<tr\s+class="([^"]*)\s+h-\[72px\]([^"]*)">/g;
    if (trRegex.test(content)) {
        content = content.replace(trRegex, '<tr class="$1$2">');
        modified = true;
    }

    // Also replace h-[72px] in case it's in simple td fillers, e.g. class="h-[72px]"
    const tdRegex = /class="h-\[72px\]"/g;
    if (tdRegex.test(content)) {
        content = content.replace(tdRegex, 'class="h-[52px]"');
        modified = true;
    }

    // Also replace in case of double spacing/quotes variations
    const trRegex2 = /h-\[72px\]/g;
    if (trRegex2.test(content)) {
        content = content.replace(trRegex2, '');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Removed h-[72px] from: ${filePath}`);
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
