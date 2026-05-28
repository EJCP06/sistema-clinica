const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace min-h-[580px] with min-h-[480px]
    if (content.includes('min-h-[580px]')) {
        content = content.replace(/min-h-\[580px\]/g, 'min-h-[480px]');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated min-h in: ${filePath}`);
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
