const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');

// Configuration
const API_URL = 'https://hantar-production.up.railway.app/api';
const POLL_INTERVAL = 5000; // 5 seconds
const OUTPUT_DIR = path.join(__dirname, 'labels');
const LOCAL_SERVER_PORT = 9876;

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple HTTP server to serve label files
const server = http.createServer((req, res) => {
    const filePath = path.join(OUTPUT_DIR, path.basename(req.url));
    
    if (fs.existsSync(filePath) && filePath.endsWith('.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(filePath));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(LOCAL_SERVER_PORT, () => {
    console.log('🐬 Hantar Printer Client Started');
    console.log(`📡 Connecting to: ${API_URL}`);
    console.log(`🌐 Local server: http://localhost:${LOCAL_SERVER_PORT}`);
    console.log(`⏱️  Polling every ${POLL_INTERVAL / 1000} seconds\n`);
});

// Generate HTML for label
function generateLabelHTML(order) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
            size: 4in auto;
            margin: 0;
        }
        
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            width: 4in;
        }
        
        @media print {
            body {
                width: 100%;
                padding: 10px;
            }
        }
        .label { 
            border: 8px solid black; 
            padding: 20px;
        }
        .header { 
            text-align: center; 
            font-size: 32px; 
            font-weight: bold; 
            border-bottom: 8px solid black; 
            padding-bottom: 10px; 
            margin-bottom: 15px;
        }
        .row { 
            display: flex; 
            gap: 20px; 
            margin-bottom: 10px; 
            border-bottom: 4px solid black;
            padding-bottom: 8px;
        }
        .field { flex: 1; }
        .label-text { font-weight: bold; font-size: 16px; }
        .value { font-size: 14px; margin-top: 4px; }
        table { 
            width: 100%; 
            border: 4px solid black; 
            border-collapse: collapse; 
            margin: 15px 0;
        }
        th, td { 
            border: 2px solid black; 
            padding: 8px; 
            text-align: left;
        }
        th { 
            background: #f0f0f0; 
            font-weight: bold;
        }
        .payment {
            border: 4px solid black;
            padding: 10px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="label">
        <div class="header">DELIVERY NOTE</div>
        
        <div class="row">
            <div class="field">
                <div class="label-text">Nama:</div>
                <div class="value">${order.nama}</div>
            </div>
            <div class="field">
                <div class="label-text">No Fon:</div>
                <div class="value">${order.no_fon}</div>
            </div>
        </div>
        
        <div class="row">
            <div class="field">
                <div class="label-text">Alamat:</div>
                <div class="value">${order.alamat}</div>
            </div>
        </div>
        
        <div class="row">
            <div class="field">
                <div class="label-text">Kawasan:</div>
                <div class="value">${order.kawasan || '-'}</div>
            </div>
        </div>
        
        <div class="row">
            <div class="field">
                <div class="label-text">Tarikh:</div>
                <div class="value">${order.tarikh}</div>
            </div>
            <div class="field">
                <div class="label-text">Masa:</div>
                <div class="value">${order.masa || '-'}</div>
            </div>
            <div class="field">
                <div class="label-text">Time:</div>
                <div class="value">${order.time_slot || '-'}</div>
            </div>
        </div>
        
        ${order.note ? `
        <div class="row">
            <div class="field">
                <div class="label-text">Note:</div>
                <div class="value">${order.note}</div>
            </div>
        </div>
        ` : ''}
        
        <table>
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Kuantiti</th>
                    <th>Check</th>
                </tr>
            </thead>
            <tbody>
                ${order.items.map((item, idx) => `
                    <tr>
                        <td>${idx + 1}. ${item.name}</td>
                        <td>${item.quantity || '-'}</td>
                        <td>${item.checked ? '✓' : ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="payment">
            <div class="row" style="border: none;">
                <div class="field">
                    <div class="label-text">Jumlah Bayaran:</div>
                    <div class="value">RM ${parseFloat(order.jumlah_bayaran).toFixed(2)}</div>
                </div>
                <div class="field">
                    <div class="label-text">No Paket:</div>
                    <div class="value">${order.no_paket || '-'}</div>
                </div>
            </div>
            <div class="row" style="border: none; margin-top: 10px;">
                <div class="field">
                    <div class="label-text">Bayaran: ${order.bayaran_status === 'Jelas' ? '☑' : '☐'} Jelas  ${order.bayaran_status === 'Belum' ? '☑' : '☐'} Belum</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

// Print label directly to printer
async function printLabel(order) {
    const filename = `order-${order.id}-${Date.now()}.html`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    const html = generateLabelHTML(order);
    fs.writeFileSync(filepath, html);
    
    console.log(`  💾 Label saved: ${filename}`);
    
    // Auto-print directly to default printer
    const localUrl = `http://localhost:${LOCAL_SERVER_PORT}/${filename}`;
    
    if (process.platform === 'win32') {
        // Method 1: Try Chrome to generate PDF first
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
        ];
        
        const sumatraPaths = [
            'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
            'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
            `${process.env.LOCALAPPDATA}\\Programs\\SumatraPDF\\SumatraPDF.exe`
        ];
        
        let chromeFound = false;
        for (const chromePath of chromePaths) {
            if (fs.existsSync(chromePath)) {
                const pdfPath = filepath.replace('.html', '.pdf');
                
                // Generate PDF from HTML
                const pdfCmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${localUrl}"`;
                
                exec(pdfCmd, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`  ⚠️  PDF generation failed: ${error.message}`);
                        console.log(`  🔗 Opening in browser manually...`);
                        exec(`start "" "${filepath}"`);
                        return;
                    }
                    
                    // Wait for PDF to be written
                    setTimeout(() => {
                        // Try SumatraPDF for silent printing
                        let sumatraFound = false;
                        for (const sumatraPath of sumatraPaths) {
                            if (fs.existsSync(sumatraPath)) {
                                // Silent print with SumatraPDF
                                exec(`"${sumatraPath}" -print-to-default -silent "${pdfPath}"`, (err) => {
                                    if (err) {
                                        console.log(`  ⚠️  SumatraPDF print failed: ${err.message}`);
                                        exec(`start "" "${pdfPath}"`);
                                    } else {
                                        console.log(`  🖨️  Sent to printer automatically (SumatraPDF)`);
                                    }
                                });
                                sumatraFound = true;
                                break;
                            }
                        }
                        
                        if (!sumatraFound) {
                            // Fallback: open PDF in default viewer
                            console.log(`  📝 PDF generated, opening for printing...`);
                            exec(`start "" "${pdfPath}"`);
                        }
                    }, 1000);
                });
                chromeFound = true;
                break;
            }
        }
        
        if (!chromeFound) {
            // Fallback: open HTML in default browser
            console.log(`  🔗 Chrome not found, opening in default browser...`);
            exec(`start "" "${filepath}"`, (error) => {
                if (error) {
                    console.log(`  ⚠️  Could not open: ${error.message}`);
                } else {
                    console.log(`  🌐 Opened in browser - press Ctrl+P to print`);
                }
            });
        }
    } else {
        // Mac/Linux: fallback to opening in browser
        const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${command} "${filepath}"`, (error) => {
            if (error) {
                console.log(`  ⚠️  Could not auto-open: ${error.message}`);
            } else {
                console.log(`  🖨️  Opened in browser for printing`);
            }
        });
    }
    
    return filepath;
}

// Mark order as printed
async function markOrderPrinted(orderId) {
    try {
        await axios.post(`${API_URL}/print-jobs/${orderId}/mark-printed`);
        console.log(`  ✅ Marked order #${orderId} as printed\n`);
    } catch (error) {
        console.error(`  ❌ Failed to mark order as printed:`, error.message);
    }
}

// Check for pending orders and print them
async function checkAndPrint() {
    try {
        const response = await axios.get(`${API_URL}/print-jobs/pending`);
        const { count, orders } = response.data;
        
        if (count > 0) {
            console.log(`\n📋 Found ${count} pending order(s)`);
            
            for (const order of orders) {
                console.log(`\n🖨️  Processing Order #${order.id} - ${order.nama}`);
                await printLabel(order);
                await markOrderPrinted(order.id);
                
                // Wait a bit between prints
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error('❌ Error checking for orders:', error.message);
    }
}

// Start polling
console.log('✅ Client ready. Waiting for orders...\n');
checkAndPrint(); // Check immediately on start
setInterval(checkAndPrint, POLL_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down printer client...');
    process.exit(0);
});
