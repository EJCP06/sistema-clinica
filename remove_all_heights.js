const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 1. Remove h-[72px] and h-[65px] from inside tr classes
    // e.g. class="... h-[72px] ..." or class="... h-[65px] ..."
    // Let's replace " h-[72px]" and " h-[65px]" with ""
    content = content.replace(/\s+h-\[72px\](?=["\s])/g, '');
    content = content.replace(/\s+h-\[65px\](?=["\s])/g, '');

    // 2. Also replace class="h-[72px]" or class="h-[65px]" inside td (fillers) with class="h-[52px]"
    content = content.replace(/class="h-\[72px\]"/g, 'class="h-[52px]"');
    content = content.replace(/class="h-\[65px\]"/g, 'class="h-[52px]"');

    // 3. Just in case there are other occurrences of h-[72px] or h-[65px] in table elements, replace them
    content = content.replace(/h-\[72px\]/g, 'h-[52px]');
    content = content.replace(/h-\[65px\]/g, 'h-[52px]');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully normalized table heights in: ${filePath}`);
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
