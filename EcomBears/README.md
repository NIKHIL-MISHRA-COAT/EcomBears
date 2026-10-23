# LabelCropper

Turns Amazon, Flipkart, Meesho, Myntra and Snapdeal shipping label PDFs into 4×6 inch thermal labels.
Everything runs in the browser. Files are never uploaded.

## Run

    npm install
    npm run dev       # http://localhost:5173
    npm run build     # production build in dist/

Pages:
- `/` landing page
- `/tool` the tool (platform tabs are in the ribbon)
- `/tool?platform=amazon` opens a platform directly

## Structure

    src/main.tsx                 app entry, router
    src/App.tsx                  routes
    src/styles.css               all styles
    src/pages/                   full pages (LandingPage, ToolPage)
    src/components/              reusable UI pieces (Ribbon, CropEditor, FileDropzone, ...)
    src/config/platforms.ts      platform defaults and ribbon layout (edit to hide/show options)
    src/lib/                     logic without React (PDF, detection, SKU text, export, settings)

## Deploy

The server must send `index.html` for every path (otherwise refreshing `/tool` shows 404).
- Cloudflare Pages: add `public/_redirects` with `/*    /index.html   200`
- Caddy: `try_files {path} /index.html` with `file_server`
