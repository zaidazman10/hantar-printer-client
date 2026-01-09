const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const { createCanvas } = require('canvas');
const JsBarcode = require('jsbarcode');

// Configuration
const API_URL = 'https://hantar-production.up.railway.app/api';
const API_TOKEN = process.env.API_TOKEN || '76c01967f47a090d67debc73dc2d37e4e31285ce7d5f0fa24f09b77a03539c3e';
const POLL_INTERVAL = 5000; // 5 seconds
const OUTPUT_DIR = path.join(__dirname, 'labels');
const LOCAL_SERVER_PORT = 9876;

// Configure default axios headers
axios.defaults.headers.common['X-API-TOKEN'] = API_TOKEN;

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple HTTP server to serve label files
const server = http.createServer((req, res) => {
    console.log(`📡 [Incoming Request] ${req.method} ${req.url}`);

    // Enable CORS for web UI communication
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle Direct Print Requests for Labels
    if (req.method === 'POST' && req.url === '/print-label') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const order = JSON.parse(body);
                console.log(`\n📥 Received manual reprint request for Label Order #${order.id}`);
                await printLabel(order);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Label print job queued' }));
            } catch (err) {
                console.error('Error processing label print request:', err);
                res.writeHead(400);
                res.end(JSON.stringify({ success: false, error: 'Invalid order data' }));
            }
        });
        return;
    }

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

// Generate checkbox image
function generateCheckboxImage(checked) {
    const canvas = createCanvas(20, 20);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 20, 20);

    // Draw black border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 16, 16);

    // Draw checkmark if checked
    if (checked) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw checkmark
        ctx.beginPath();
        ctx.moveTo(5, 10);
        ctx.lineTo(8, 14);
        ctx.lineTo(15, 6);
        ctx.stroke();
    }

    return canvas.toDataURL();
}

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
            width: 3,
            height: 70,
            displayValue: true,
            fontSize: 28,
            margin: 5,
            fontOptions: 'bold'
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

    // Cara Memasak image
    const caraMemasakPath = path.join(__dirname, 'cara-memasak.png');
    const caraMemasakBase64 = fs.existsSync(caraMemasakPath)
        ? `data:image/png;base64,${fs.readFileSync(caraMemasakPath).toString('base64')}`
        : '';

    // Contact image
    const contactImgPath = path.join(__dirname, 'contact.png');
    const contactImgBase64 = fs.existsSync(contactImgPath)
        ? `data:image/png;base64,${fs.readFileSync(contactImgPath).toString('base64')}`
        : '';

    // Format date nicely for display
    const checkboxEmptyBase64 = generateCheckboxImage(false);
    const checkboxCheckedBase64 = generateCheckboxImage(true);

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
            size: 100mm 150mm; 
    	    margin: 0;
        }
        
        html, body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-weight: 700;
            margin: 0;
            padding: 0;
        }
        
        body {
            padding: 2px;
            width: 105mm;
            font-size: 9pt;
            line-height: 1.05;
        }
        
        @media print {
            html, body {
                margin: 0 !important;
                padding: 0 !important;
            }
            
            body {
                width: 105mm !important;
                height: 148mm !important;
                padding: 6px !important;
                font-size: 12pt !important;
                line-height: 1.15 !important;
                transform: none !important;
                zoom: 1 !important;
            }
            
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
        
        /* HEADER SECTION */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
            gap: 10px;
        }
        
        .left-logos {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }
        
        .left-logos img {
            width: 70px;
            height: auto;
        }
        
        .right-order {
            text-align: right;
            flex: 1;
            display: flex;
            justify-content: flex-end;
            align-items: center;
        }
        
        .barcode-img {
            max-width: 100%;
            height: 70px;
        }
        
        .divider {
            border-bottom: 1.5pt solid black;
            margin: 2px 0;
        }
        
        /* CUSTOMER SECTION */
        .customer-section {
            display: flex;
            gap: 6px;
            margin-bottom: 2px;
        }
        
        .customer-left {
            flex: 1;
        }
        
        .section-title {
            font-size: 11pt;
            font-weight: 900;
            margin-bottom: 1px;
        }
        
        .customer-info {
            font-size: 10pt;
            font-weight: 700;
            line-height: 1.1;
        }
        
        .customer-right {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        
        .qr-container {
            background: black;
            border-radius: 10px;
            padding: 8px;
            text-align: center;
        }
        
        .qr-img {
            width: 75px;
            height: 75px;
            background: white;
            border-radius: 4px;
            padding: 2px;
        }
        
        .qr-label {
            color: white;
            font-size: 10pt;
            font-weight: 900;
            margin-top: 2px;
        }
        
        .scooter-img {
            width: 120px;
            height: auto;
        }
        
        /* MAIN CONTENT - TWO COLUMNS */
        .main-content {
            display: flex;
            gap: 6px;
            margin-bottom: 2px;
        }
        
        .left-col {
            flex: 1.2;
        }
        
        .right-col {
            flex: 1;
            border-left: 1.5pt solid black;
            padding-left: 8px;
        }
        
        /* ITEMS LIST */
        .items-list {
            margin-top: 1px;
            font-size: 9pt;
            font-weight: 700;
        }
        
        .item-row {
            display: flex;
            margin-bottom: 0.5px;
        }
        
        .item-bullet {
            margin-right: 6px;
            flex-shrink: 0;
        }
        
        .item-details {
            display: flex;
            flex: 1;
            justify-content: space-between;
            gap: 4px;
        }
        
        .item-name {
            flex: 1;
            min-width: 0;
        }
        
        .item-qty {
            flex-shrink: 0;
            white-space: nowrap;
        }
        
        /* DELIVERY OPTIONS */
        .delivery-date {
            font-size: 11pt;
            font-weight: 900;
            margin-bottom: 1px;
        }
        
        .option-list {
            font-size: 9pt;
            font-weight: 700;
            line-height: 1.1;
        }
        
        .option-item {
            margin-bottom: 0.5px;
        }
        
        .checkbox {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 1.5pt solid black;
            margin-right: 5px;
            vertical-align: middle;
        }
        .time-section {
            margin-top: 1px;
        }
        
        /* PAYMENT SECTION */
        .payment-section {
            margin-bottom: 1px;
        }
        
        .payment-option {
            font-size: 10pt;
            font-weight: 700;
            margin-bottom: 1px;
        }
        
        /* FOOTER ROW */
        .footer-row {
            border-top: 1.5pt solid black;
            padding-top: 2px;
            display: flex;
            gap: 6px;
            align-items: flex-start;
        }
        
        .footer-left {
            flex: 1;
        }
        
        .footer-left img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .footer-right {
            flex: 1;
            border-left: 1.5pt solid black;
            padding-left: 10px;
        }
        
        .footer-right img {
            width: 100%;
            height: auto;
            display: block;
        }
        .cooking-section {
            padding-top: 0;
        }
        
        .cooking-title {
            font-size: 11pt;
            font-weight: 900;
            text-decoration: underline;
            margin-bottom: 2px;
        }
        
        .cooking-steps {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .cooking-step {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            font-size: 9pt;
            font-weight: 700;
            line-height: 1.1;
        }
        
        .cooking-icon {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
        }
        
        .cooking-text {
            flex: 1;
            padding-top: 8px;
        }
        
        .cooking-temp {
            text-decoration: underline;
        }
        
        /* FOOTER CONTACT */
        .footer-contact {
            margin-top: 2px;
            border-top: 2pt solid black;
            padding-top: 2px;
        }
        
        .footer-title {
            font-size: 11pt;
            font-weight: 900;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .emoji-img {
            width: 20px;
            height: 20px;
        }
        
        .contact-info {
            font-size: 9pt;
            font-weight: 700;
            line-height: 1.1;
        }
        
        .qr-order {
            float: right;
            width: 100px;
            height: auto;
            margin-left: 10px;
        }
        
        .order-label {
            text-align: center;
            font-size: 11pt;
            font-weight: 900;
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <!-- HEADER: Logos + Order Number -->
    <div class="header">
        <div class="left-logos">
            ${hantarLogoBase64 ? `<img src="${hantarLogoBase64}" alt="Hantar">` : ''}
            ${pusingLogoBase64 ? `<img src="${pusingLogoBase64}" alt="NH">` : ''}
        </div>
        <div class="right-order">
            ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" class="barcode-img" alt="Barcode">` : ''}
        </div>
    </div>
    
    <div class="divider"></div>
    
    <!-- CUSTOMER INFO + QR CODE -->
    <div class="customer-section">
        <div class="customer-left">
            <div class="section-title">KEPADA :</div>
            <div class="customer-info">
                <div>${order.nama}</div>
                <div>${order.alamat}</div>
                ${order.kawasan ? `<div>${order.kawasan}</div>` : ''}
                ${order.poskod ? `<div>POSKOD: ${order.poskod}</div>` : ''}
                <div>TEL : ${order.no_fon}</div>
                ${order.note ? `<div>NOTA :</div><div>${order.note}</div>` : ''}
            </div>
        </div>
        <div class="customer-right">
            ${qrCodeDataUrl ? `
            <div class="qr-container">
                <img src="${qrCodeDataUrl}" class="qr-img" alt="Map QR">
                <div class="qr-label">Let's Go</div>
            </div>
            ` : ''}
        </div>
    </div>
    
    <div class="divider"></div>
    
    <!-- MAIN CONTENT: ITEMS + DELIVERY INFO -->
    <div class="main-content">
        <div class="left-col">
            <div class="section-title">MAKLUMAT ITEM :</div>
            <div class="items-list">
                ${order.items.map(item => `
                <div class="item-row">
                    <span class="item-bullet">•</span>
                    <div class="item-details">
                        <span class="item-name">${item.name}</span>
                        <span class="item-qty">: ${item.quantity ? item.quantity + ' PEK' : ''}</span>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        
        <div class="right-col">
            <div class="delivery-date">TARIKH : ${displayDate}</div>
            <div class="option-list">
                <div class="option-item"><img src="${order.delivery_method === 'pickup' ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">PICK-UP @ P9</div>
                <div class="option-item"><img src="${order.delivery_method === 'delivery' || !order.delivery_method ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">DELIVERY</div>
            </div>
            
            <div class="time-section">
                <div class="section-title">MASA :</div>
                <div class="option-list">
                    <div class="option-item"><img src="${order.time_slot === '9am-12pm' ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">9am-12pm</div>
                    <div class="option-item"><img src="${order.time_slot === '2pm-6pm' ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">2pm-6pm</div>
                    <div class="option-item"><img src="${order.time_slot === '7pm-9pm' ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">7pm-9pm</div>
                    <div class="option-item"><img src="${order.time_slot && !['9am-12pm', '2pm-6pm', '7pm-9pm'].includes(order.time_slot) ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">${order.time_slot && !['9am-12pm', '2pm-6pm', '7pm-9pm'].includes(order.time_slot) ? order.time_slot : '_________'} selain diatas</div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="divider"></div>
    
    <!-- PAYMENT SECTION -->
    <div class="payment-section">
        <div class="section-title">MAKLUMAT BAYARAN :</div>
        <div class="payment-option"><img src="${order.bayaran_status === 'Selesai' || order.bayaran_status === 'Jelas' ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">SELESAI PEMBAYARAN.</div>
        <div class="payment-option"><img src="${order.bayaran_status === 'Belum' ? checkboxCheckedBase64 : checkboxEmptyBase64}" class="checkbox" alt="">BELUM SELESAI / BTT/QR/COD :</div>
    </div>
    
    <!-- FOOTER: Cooking (left) + Contact (right) -->
    <div class="footer-row">
        <div class="footer-left">
            ${caraMemasakBase64 ? `<img src="${caraMemasakBase64}" alt="Cara Memasak">` : ''}
        </div>
        <div class="footer-right">
            ${contactImgBase64 ? `<img src="${contactImgBase64}" alt="Contact">` : ''}
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

                // Generate PDF from HTML with A6 page size (105mm x 148mm)
                // Chrome respects CSS @page size: A6 portrait rule
                const pdfCmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --print-to-pdf-margin=0 --virtual-time-budget=10000 "${localUrl}"`

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
                                exec(`"${sumatraPath}" -print-to-default -silent -print-settings "paper=A6,noscale" "${pdfPath}"`, (err) => {
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
