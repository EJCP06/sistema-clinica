const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Regex to match <thead, <tr, <th, <td tags and remove "transition-colors" or " transition-colors"
            const tagRegex = /<(thead|tr|th|td)\b([^>]*?)>/gi;
            
            content = content.replace(tagRegex, (match, tag, attributes) => {
                if (attributes.includes('transition-colors')) {
                    modified = true;
                    // Remove "transition-colors" preserving spaces
                    const newAttributes = attributes.replace(/\s*\btransition-colors\b/g, '');
                    return `<${tag}${newAttributes}>`;
                }
                return match;
            });

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Modified: ${fullPath}`);
            }
        }
    }
}

const featuresPath = path.join(__dirname, 'src', 'app', 'features');
processDirectory(featuresPath);
console.log('Done!');
