const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Remove overflow-x-auto from the container that has flex-col (the main table container)
    // We look for class="..." that contains overflow-x-auto AND min-h-[480px]
    const containerRegex = /class="([^"]*overflow-x-auto[^"]*min-h-\[480px\][^"]*)"/g;
    content = content.replace(containerRegex, (match, classString) => {
        modified = true;
        const newClassString = classString.replace(/\boverflow-x-auto\b\s*/g, '').trim();
        return `class="${newClassString}"`;
    });

    // 2. Wrap the <table> elements with <div class="overflow-x-auto">
    // Since we know the table tags, we can wrap them.
    // However, some tables might already be wrapped, so we only do this if we actually modified the container,
    // or we can do a targeted replacement.
    if (modified) {
        // We find <table class="..."> and replace with <div class="overflow-x-auto">\n<table class="...">
        // And we find </table> and replace with </table>\n</div>
        // Warning: This assumes one table per min-h-[480px] container, which is true for our app.
        
        // Wait, it's safer to just split by <table and </table>
        content = content.replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, (tableMatch) => {
            return `<div class="overflow-x-auto">\n${tableMatch}\n</div>`;
        });
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Modified: ${filePath}`);
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
            processFile(fullPath);
        }
    }
}

const featuresPath = path.join(__dirname, 'src', 'app', 'features');
processDirectory(featuresPath);
console.log('Done!');
