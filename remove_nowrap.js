const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Remove whitespace-nowrap from <table ...>
    if (content.includes('whitespace-nowrap')) {
        content = content.replace(/<table([^>]*)whitespace-nowrap([^>]*)>/gi, (match, p1, p2) => {
            modified = true;
            return `<table${p1}${p2}>`.replace(/  +/g, ' '); // cleanup double spaces
        });
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Removed whitespace-nowrap from: ${filePath}`);
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
