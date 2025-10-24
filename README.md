# Delivery Label Printer Client

Automatically prints delivery labels when new orders are created.

## How It Works

1. **Polls** the Laravel API every 5 seconds for new orders
2. **Generates** HTML label matching your design
3. **Opens** label in browser for printing
4. **Marks** order as printed in the database

## Installation

Already installed! Just run it.

## Usage

### Start the printer client:

```bash
cd /Users/matzaid/Herd/hantar/printer-client
node index.js
```

You'll see:
```
🖨️  Hantar Printer Client Started
📡 Connecting to: http://hantar.test/api
⏱️  Polling every 5 seconds

✅ Client ready. Waiting for orders...
```

### When an order is created:

```
📋 Found 1 pending order(s)

🖨️  Processing Order #1 - John Doe
  💾 Label saved: order-1-1234567890.html
  🖨️  Opened in browser for printing
  ✅ Marked order #1 as printed
```

## What It Does

- **Saves labels** to `printer-client/labels/` folder
- **Auto-opens** labels in your default browser
- **Uses browser print dialog** - you can:
  - Select your label printer
  - Save as PDF
  - Adjust settings before printing

## Configuration

Edit `index.js` to change:

```javascript
const API_URL = 'http://hantar.test/api';  // API endpoint
const POLL_INTERVAL = 5000;  // Check every 5 seconds
```

## For Production

When deploying online:
1. Change `API_URL` to your live domain
2. Run on the PC connected to your label printer
3. Keep the terminal open or run as a service

### Run as background service (optional):

**Using PM2:**
```bash
npm install -g pm2
pm2 start index.js --name label-printer
pm2 startup  # Start on boot
pm2 save
```

## Troubleshooting

**Labels not printing?**
- Make sure Laravel is running (`npm run dev`)
- Check the API is accessible: `curl http://hantar.test/api/print-jobs/pending`
- Labels are saved in the `labels/` folder even if browser doesn't open

**Connect to actual printer?**
For direct thermal printer printing (without browser), you can:
- Use `node-thermal-printer` package for ESC/POS printers
- Use `node-printer` for system printers
- Or keep using browser print dialog (works with any printer)

## Stop the client

Press `Ctrl+C` in the terminal
