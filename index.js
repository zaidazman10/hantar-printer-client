const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const { createCanvas } = require('canvas');
const JsBarcode = require('jsbarcode');

// Configuration
// IMPORTANT: Change back to Railway URL before pushing to production
const API_URL = 'https://hantar-production.up.railway.app/api';
// const API_URL = 'http://hantar.test/api'; // LOCAL DEVELOPMENT
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
async function generateLabelHTML(order) {
    // Generate Google Maps URL
    const fullAddress = `${order.alamat}${order.kawasan ? ', ' + order.kawasan : ''}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    
    // Generate QR code as data URL
    let qrCodeDataUrl = '';
    try {
        qrCodeDataUrl = await QRCode.toDataURL(mapsUrl, {
            width: 120,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error('QR Code generation error:', err);
    }
    
    // Generate barcode for order number
    let barcodeDataUrl = '';
    // Extract date from ISO format (e.g., "2025-11-02T00:00:00.000000Z009" -> "20251102")
    let dateString = '20251102';
    try {
        const canvas = createCanvas();
        if (order.tarikh) {
            // Extract YYYY-MM-DD from ISO timestamp
            const dateMatch = order.tarikh.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
                dateString = dateMatch[1] + dateMatch[2] + dateMatch[3];
            }
        }
        const orderNumber = `${dateString}${String(order.id).padStart(3, '0')}`;
        JsBarcode(canvas, orderNumber, {
            format: 'CODE39',
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 14,
            margin: 5
        });
        barcodeDataUrl = canvas.toDataURL();
    } catch (err) {
        console.error('Barcode generation error:', err);
    }
    
    // Convert images to base64
    const hantarLogoPath = path.join(__dirname, 'logo-hantar.png');
    const hantarLogoBase64 = fs.existsSync(hantarLogoPath) 
        ? `data:image/png;base64,${fs.readFileSync(hantarLogoPath).toString('base64')}`
        : '';
    
    const pusingLogoPath = path.join(__dirname, 'logo-pusing.png');
    const pusingLogoBase64 = fs.existsSync(pusingLogoPath) 
        ? `data:image/png;base64,${fs.readFileSync(pusingLogoPath).toString('base64')}`
        : '';
    
    const frozenIconPath = path.join(__dirname, 'frozen-icon.png');
    const frozenIconBase64 = fs.existsSync(frozenIconPath)
        ? `data:image/png;base64,${fs.readFileSync(frozenIconPath).toString('base64')}`
        : '';
    
    const scooterPath = path.join(__dirname, 'delivery-scooter.png');
    const scooterBase64 = fs.existsSync(scooterPath)
        ? `data:image/png;base64,${fs.readFileSync(scooterPath).toString('base64')}`
        : '';
    
    const wavingEmojiPath = path.join(__dirname, 'waving-emoji.png');
    const wavingEmojiBase64 = fs.existsSync(wavingEmojiPath)
        ? `data:image/png;base64,${fs.readFileSync(wavingEmojiPath).toString('base64')}`
        : '';
    
    const fryingPanPath = path.join(__dirname, 'fryingpan.png');
    const fryingPanBase64 = fs.existsSync(fryingPanPath)
        ? `data:image/png;base64,${fs.readFileSync(fryingPanPath).toString('base64')}`
        : '';
    
    const airFryerPath = path.join(__dirname, 'icon-airfryer.png');
    const airFryerBase64 = fs.existsSync(airFryerPath)
        ? `data:image/png;base64,${fs.readFileSync(airFryerPath).toString('base64')}`
        : '';
    
    const qrOrderPath = path.join(__dirname, 'qr-order.png');
    const qrOrderBase64 = fs.existsSync(qrOrderPath)
        ? `data:image/png;base64,${fs.readFileSync(qrOrderPath).toString('base64')}`
        : '';
    
    const cookingInstructionsPath = path.join(__dirname, 'cooking-instructions.png');
    const cookingInstructionsBase64 = fs.existsSync(cookingInstructionsPath)
        ? `data:image/png;base64,${fs.readFileSync(cookingInstructionsPath).toString('base64')}`
        : '';
    
    // Format date nicely for display
    let displayDate = '2/11/2025';
    if (order.tarikh) {
        const dateMatch = order.tarikh.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
            displayDate = `${parseInt(dateMatch[3])}/${parseInt(dateMatch[2])}/${dateMatch[1]}`;
        }
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
            size: A6;
            margin: 0;
        }
        
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-weight: 600;
            padding: 8px;
            width: 148mm;
            font-size: 9pt;
        }
        
        @media print {
            body {
                width: 100%;
                padding: 5px;
                font-size: 8.5pt;
            }
        }
        
        .label-container {
            width: 100%;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 10px;
        }
        
        .logo-section {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .logo {
            width: 90px;
            height: auto;
        }
        
        .nh-logo {
            width: 80px;
            height: auto;
        }
        
        .order-number-section {
            text-align: center;
            flex: 1;
        }
        
        .barcode {
            width: 220px;
            height: auto;
        }
        
        .section-title {
            font-size: 10pt;
            font-weight: 800;
            margin-bottom: 5px;
        }
        
        .divider {
            border-bottom: 0.5pt solid black;
            margin: 10px 0;
        }
        
        .customer-info {
            font-size: 9.5pt;
            font-weight: 600;
            line-height: 1.4;
        }
        
        .info-row {
            margin-bottom: 3px;
        }
        
        .customer-row {
            display: flex;
            gap: 20px;
            margin-bottom: 10px;
        }
        
        .customer-col-left {
            flex: 1;
        }
        
        .customer-col-right {
            width: 180px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
        }
        
        .qr-box {
            background: black;
            border: 0.5pt solid black;
            border-radius: 12px;
            padding: 8px;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
        }
        
        .qr-code {
            width: 110px;
            height: 110px;
            background: white;
            padding: 5px;
            border-radius: 8px;
        }
        
        .qr-text {
            color: white;
            font-size: 11pt;
            font-weight: bold;
            margin-top: 5px;
        }
        
        .two-column {
            display: flex;
            gap: 20px;
        }
        
        .column-left {
            flex: 1;
        }
        
        .column-right {
            flex: 0.7;
            border-left: 0.5pt solid black;
            padding-left: 12px;
        }
        
        .items-list {
            margin: 10px 0;
        }
        
        .item {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 9.5pt;
            font-weight: 600;
            line-height: 1.3;
        }
        
        .item-bullet {
            margin-right: 8px;
        }
        
        .item-content {
            display: flex;
            flex: 1;
            justify-content: space-between;
            align-items: center;
        }
        
        .item-name {
            flex: 0;
            white-space: nowrap;
        }
        
        .item-colon {
            margin-left: 5px;
            margin-right: 5px;
        }
        
        .item-qty {
            flex: 1;
            text-align: left;
        }
        
        .delivery-options {
            font-size: 9pt;
            font-weight: 600;
            line-height: 1.6;
        }
        
        .checkbox {
            margin-right: 5px;
            font-size: 14pt;
            font-weight: bold;
        }
        
        .payment-section {
            font-size: 9pt;
            font-weight: 600;
            line-height: 1.5;
        }
        
        .cooking-section {
            width: 100%;
            display: flex;
            justify-content: center;
            padding: 10px 0;
        }
        
        .cooking-instructions-img {
            width: 100%;
            height: auto;
            display: block;
        }
    </style>
</head>
<body>
    <div class="label-container">
        <!-- Header with Logos and Barcode -->
        <div class="header">
            <div class="logo-section">
                ${hantarLogoBase64 ? `<img src="${hantarLogoBase64}" alt="Hantar" class="logo">` : ''}
                ${pusingLogoBase64 ? `<img src="${pusingLogoBase64}" alt="Karipap Pusing NH" class="nh-logo">` : ''}
            </div>
            <div class="order-number-section">
                ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Barcode" class="barcode">` : ''}
            </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- Customer Info with QR Code -->
        <div class="customer-row">
            <div class="customer-col-left">
                <div class="section-title">KEPADA :</div>
                <div class="customer-info">
                    <div class="info-row">${order.nama}</div>
                    <div class="info-row">${order.alamat}</div>
                    ${order.kawasan ? `<div class="info-row">${order.kawasan}</div>` : ''}
                    <div class="info-row">TEL : ${order.no_fon}</div>
                    ${order.note ? `<div class="info-row">NOTA : ${order.note}</div>` : ''}
                </div>
            </div>
            <div class="customer-col-right">
                ${qrCodeDataUrl ? `
                <div class="qr-box">
                    <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
                    <div class="qr-text">Let's Go</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- Items and Date/Time in Two Columns -->
        <div class="two-column">
            <div class="column-left">
                <div class="section-title">MAKLUMAT ITEM :</div>
                <div class="items-list">
                    ${order.items.map(item => {
                        const itemName = item.name;
                        const qtyText = (item.quantity && item.quantity > 0) 
                            ? `${item.quantity} PEK` 
                            : '';
                        
                        return `
                        <div class="item">
                            <span class="item-bullet">•</span>
                            <div class="item-content">
                                <span class="item-name">${itemName}</span>
                                <span class="item-colon">:</span>
                                <span class="item-qty">${qtyText}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="column-right">
                <div class="section-title">TARIKH : ${displayDate}</div>
                <div class="delivery-options">
                    <div><span class="checkbox">☐</span>PICK-UP @ P9</div>
                    <div><span class="checkbox">☐</span>DELIVERY</div>
                </div>
                <br>
                <div class="section-title">MASA :</div>
                <div class="delivery-options">
                    <div><span class="checkbox">☐</span>9am-12pm</div>
                    <div><span class="checkbox">☐</span>2pm-6pm</div>
                    <div><span class="checkbox">☐</span>7pm-9pm</div>
                    <div><span class="checkbox">☐</span>_____ selain diatas</div>
                </div>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- Payment Section -->
        <div class="section-title">MAKLUMAT BAYARAN :</div>
        <div class="payment-section">
            <div><span class="checkbox">${order.bayaran_status === 'Jelas' ? '☑' : '☐'}</span>SELESAI PEMBAYARAN.</div>
            <div><span class="checkbox">${order.bayaran_status === 'Belum' ? '☑' : '☐'}</span>BELUM SELESAI / BTT/QR/COD :</div>
        </div>
        
        <!-- Cooking Instructions -->
        <div class="cooking-section">
            ${cookingInstructionsBase64 ? `<img src="${cookingInstructionsBase64}" alt="Cooking Instructions" class="cooking-instructions-img">` : ''}
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
    
    const html = await generateLabelHTML(order);
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
