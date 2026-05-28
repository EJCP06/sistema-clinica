const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Add table-fixed to all <table> elements that have w-full
    content = content.replace(/<table\s+class="w-full text-left text-sm\s*">/gi, (match) => {
        modified = true;
        return '<table class="w-full table-fixed text-left text-sm">';
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Added table-fixed: ${filePath}`);
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
