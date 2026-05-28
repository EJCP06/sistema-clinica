const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'src', 'app', 'features');

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Add whitespace-nowrap to <table class="..."> if missing
    content = content.replace(/<table\b([^>]*class="[^"]*)">/gi, (match, p1) => {
        if (!p1.includes('whitespace-nowrap')) {
            modified = true;
            return `<table ${p1} whitespace-nowrap">`;
        }
        return match;
    });

    // 2. Replace py-4 with py-[20px] inside <td> and <th> (wait, we did py-5 in th earlier in admin-reports, but for simplicity let's do py-[20px] on td)
    content = content.replace(/<td\b([^>]*class="[^"]*)\bpy-4\b([^"]*)">/gi, (match, p1, p2) => {
        modified = true;
        return `<td ${p1}py-[20px]${p2}">`;
    });

    // 3. Replace h-[52px] with h-[65px] in fillers
    content = content.replace(/h-\[52px\]/g, () => {
        modified = true;
        return 'h-[65px]';
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Modified HTML: ${filePath}`);
    }
}

function processTsFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Filter out 'Atendido' from this.admisiones = data;
    // We match: this.admisiones = data;
    // And replace with: this.admisiones = data.filter((a: any) => (a.nombre_estado || '').toUpperCase() !== 'ATENDIDO');
    const regex = /this\.admisiones\s*=\s*data;/g;
    if (regex.test(content)) {
        content = content.replace(regex, "this.admisiones = data.filter((a: any) => (a.nombre_estado || '').toUpperCase() !== 'ATENDIDO');");
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Modified TS: ${filePath}`);
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
        } else if (fullPath.endsWith('.ts')) {
            processTsFile(fullPath);
        }
    }
}

processDirectory(featuresPath);
console.log('Done!');
