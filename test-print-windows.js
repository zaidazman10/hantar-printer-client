const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Windows Print Test\n');

// Test 1: Check if Chrome exists
console.log('1️⃣ Checking for Chrome...');
const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];

let chromeFound = null;
for (const p of chromePaths) {
    if (fs.existsSync(p)) {
        chromeFound = p;
        console.log(`   ✅ Found: ${p}\n`);
        break;
    }
}

if (!chromeFound) {
    console.log('   ❌ Chrome not found!\n');
    process.exit(1);
}

// Test 2: Check if SumatraPDF exists
console.log('2️⃣ Checking for SumatraPDF...');
const sumatraPaths = [
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
    process.env.LOCALAPPDATA + '\\Programs\\SumatraPDF\\SumatraPDF.exe'
];

let sumatraFound = null;
for (const p of sumatraPaths) {
    if (fs.existsSync(p)) {
        sumatraFound = p;
        console.log(`   ✅ Found: ${p}\n`);
        break;
    }
}

if (!sumatraFound) {
    console.log('   ⚠️  SumatraPDF not found - will open PDF manually\n');
}

// Test 3: Find a test label
console.log('3️⃣ Finding test label...');
const labelsDir = path.join(__dirname, 'labels');
const files = fs.readdirSync(labelsDir).filter(f => f.endsWith('.html'));

if (files.length === 0) {
    console.log('   ❌ No label files found in labels/ folder\n');
    process.exit(1);
}

const testFile = path.join(labelsDir, files[0]);
console.log(`   ✅ Using: ${files[0]}\n`);

// Test 4: Generate PDF
console.log('4️⃣ Generating PDF with Chrome...');
const pdfPath = testFile.replace('.html', '.pdf');
const pdfCmd = `"${chromeFound}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "file:///${testFile.replace(/\\/g, '/')}"`;

console.log(`   Command: ${pdfCmd}\n`);

exec(pdfCmd, (error, stdout, stderr) => {
    if (error) {
        console.log(`   ❌ PDF generation failed: ${error.message}\n`);
        return;
    }
    
    console.log('   ✅ PDF generated successfully!\n');
    
    // Test 5: Print PDF
    if (sumatraFound) {
        console.log('5️⃣ Printing with SumatraPDF...');
        const printCmd = `"${sumatraFound}" -print-to-default -silent "${pdfPath}"`;
        console.log(`   Command: ${printCmd}\n`);
        
        exec(printCmd, (err, out, serr) => {
            if (err) {
                console.log(`   ❌ Print failed: ${err.message}\n`);
                console.log(`   📂 Opening PDF manually: ${pdfPath}\n`);
                exec(`start "" "${pdfPath}"`);
            } else {
                console.log('   ✅ Print command sent!\n');
                console.log('   Check your printer - the label should be printing now!\n');
            }
        });
    } else {
        console.log('5️⃣ Opening PDF for manual printing...');
        exec(`start "" "${pdfPath}"`, (err) => {
            if (err) {
                console.log(`   ❌ Could not open PDF: ${err.message}\n`);
            } else {
                console.log('   ✅ PDF opened - please press Ctrl+P to print\n');
            }
        });
    }
});
