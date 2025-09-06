// Utility selectors
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Local storage wrapper
const store = {
  key: 'agri_chain_demo_v4_qr',
  read() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || {
        listings: [], purchases: [], inventory: [], iot: {}, feedback: [], 
        consumerPurchases: [], retailPurchases: []
      };
    } catch {
      return { 
        listings: [], purchases: [], inventory: [], iot: {}, feedback: [], 
        consumerPurchases: [], retailPurchases: []
      };
    }
  },
  write(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  init() {
    const d = this.read();
    ['listings','purchases','inventory','feedback','consumerPurchases','retailPurchases'].forEach(k => {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    if (!d.iot) d.iot = {};
    this.write(d);
  }
};
store.init();

const uid = () => 'B' + Math.random().toString(36).substr(2, 6).toUpperCase();

// QR Scanner variables
let html5QrCode = null;
let scannerRunning = false;

function refreshStats() {
  const d = store.read();
  $('#statFarmers').textContent = new Set(d.listings.map(x => x.farmer)).size;
  $('#statBatches').textContent = d.listings.length;
  $('#statOnTime').textContent = (90 + Math.floor(Math.random() * 10)) + '%';
  $('#statEco').textContent = ['A+', 'A', 'B', 'B+'][Math.floor(Math.random() * 4)];
}

function showPage(hash) {
  const target = (hash || '#home').split('?')[0];
  $$('.page').forEach(s => s.classList.add('hidden'));
  (document.querySelector(target) || $('#home')).classList.remove('hidden');
  $$('.navlink').forEach(a => {
    const active = a.getAttribute('href') === target;
    a.classList.toggle('text-emerald-600', active);
    a.classList.toggle('font-semibold', active);
  });
  
  // Stop scanner when leaving QR scanner page
  if (target !== '#qr-scanner' && scannerRunning) {
    stopQRScanner();
  }
  
  if (target === '#farmer') {
    renderFarmer();
    // Initialize farmer form and lookup event listeners when farmer page is shown
    setTimeout(() => {
      initializeFarmerForm();
      initializeFarmerLookup();
    }, 100);
  }
  if (target === '#distributor') renderDistributor();
  if (target === '#retailer') {
    console.log('Switching to retailer page'); // Debug log
    renderRetailer();
    // Initialize retailer event listeners when retailer page is shown
    setTimeout(() => {
      console.log('About to initialize retailer events'); // Debug log
      initializeRetailerEvents();
      
      // Debug: Show data summary for troubleshooting
      const d = store.read();
      console.log('Data summary for troubleshooting:');
      console.log('- Total inventory items:', d.inventory.length);
      console.log('- Items with IN_TRANSIT status:', d.inventory.filter(x => x.status === 'IN_TRANSIT').length);
      console.log('- Items available for retailer purchase:', d.inventory.filter(x => x.status === 'IN_TRANSIT' && !x.retailPrice).length);
      console.log('- All listings:', d.listings.length);
      console.log('- Distributor purchases:', d.purchases.length);
    }, 100);
  }
  if (target === '#consumer') {
    console.log('Switching to consumer page'); // Debug log
    renderConsumer();
    // Initialize consumer event listeners when consumer page is shown
    setTimeout(() => {
      console.log('About to initialize consumer events'); // Debug log
      initializeConsumerEvents();
      
      // Debug: Show data summary for troubleshooting
      const d = store.read();
      console.log('Consumer data summary:');
      console.log('- Retail batches available:', d.inventory.filter(x => x.status === 'RETAIL' && x.retailPrice).length);
      console.log('- Farm batches available:', d.listings.filter(x => x.status === 'AVAILABLE').length);
      console.log('- Consumer purchases:', d.consumerPurchases.length);
    }, 100);
  }
  if (target === '#home') refreshStats();
}

window.addEventListener('hashchange', () => showPage(location.hash));
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing...'); // Debug log
  
  // Check if QRCode library is loaded
  if (typeof QRCode === 'undefined') {
    console.error('QRCode library is not loaded! Check script tags.');
  } else {
    console.log('QRCode library loaded successfully');
  }
  
  showPage(location.hash || '#home');
  refreshStats();
  
  // Ensure farmer form event listener is attached
  const farmerForm = $('#farmerForm');
  if (farmerForm) {
    console.log('Farmer form found and event listener attached'); // Debug log
  } else {
    console.warn('Farmer form not found during initialization'); // Debug log
  }
  
  // Initialize consumer page if it's the current page
  if (location.hash === '#consumer') {
    renderConsumer();
  }
  
  // Initialize farmer page if it's the current page
  if (location.hash === '#farmer') {
    renderFarmer();
  }
  
  // Initialize retailer page if it's the current page
  if (location.hash === '#retailer') {
    renderRetailer();
    setTimeout(() => {
      initializeRetailerEvents();
    }, 100);
  }
});

// Mobile menu toggle
$('#mobileMenuBtn').addEventListener('click', () => {
  const mobileMenu = $('#mobileMenu');
  mobileMenu.classList.toggle('hidden');
});

// Close mobile menu when clicking on a nav link
$$('#mobileMenu .navlink').forEach(link => {
  link.addEventListener('click', () => {
    $('#mobileMenu').classList.add('hidden');
  });
});

// -- QR Code Generation --
function generateQRCode(batchId) {
  // Check if QRCode library is loaded
  if (typeof QRCode === 'undefined') {
    console.error('QRCode library not loaded');
    // Fallback: Generate a simple text-based QR representation
    return Promise.resolve(generateFallbackQR(batchId));
  }
  
  const canvas = document.createElement('canvas');
  const qrData = `${window.location.origin}${window.location.pathname}#qr-scanner?batch=${batchId}`;
  
  console.log('Generating QR code for:', batchId, 'with data:', qrData);
  
  return new Promise((resolve) => {
    try {
      QRCode.toCanvas(canvas, qrData, {
        width: 140,
        height: 140,
        margin: 2,
        color: {
          dark: '#1f2937',  // Dark gray for better scanning
          light: '#ffffff'  // White background
        },
        errorCorrectionLevel: 'M'  // Medium error correction
      }, (error) => {
        if (error) {
          console.error('QR generation error:', error);
          // Fallback on error
          resolve(generateFallbackQR(batchId));
        } else {
          console.log('QR code generated successfully');
          resolve(canvas.toDataURL('image/png'));
        }
      });
    } catch (err) {
      console.error('Exception in QR generation:', err);
      // Fallback on exception
      resolve(generateFallbackQR(batchId));
    }
  });
}

// Fallback QR generation using a simple pattern
function generateFallbackQR(batchId) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 140;
  canvas.height = 140;
  
  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 140, 140);
  
  // Draw a simple pattern
  ctx.fillStyle = '#1f2937';
  
  // Draw border
  ctx.fillRect(0, 0, 140, 5);
  ctx.fillRect(0, 0, 5, 140);
  ctx.fillRect(135, 0, 5, 140);
  ctx.fillRect(0, 135, 140, 5);
  
  // Draw simple pattern based on batch ID
  const hash = batchId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      if ((hash + i * j) % 3 === 0) {
        ctx.fillRect(15 + i * 11, 15 + j * 11, 8, 8);
      }
    }
  }
  
  // Add text
  ctx.fillStyle = '#1f2937';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('QR FALLBACK', 70, 130);
  
  console.log('Generated fallback QR for:', batchId);
  return canvas.toDataURL('image/png');
}

function showQRModal(batchId) {
  console.log('showQRModal called with batchId:', batchId);
  
  // Update batch ID display
  const batchIdElement = $('#qrBatchId');
  if (batchIdElement) {
    batchIdElement.textContent = batchId;
  } else {
    console.error('qrBatchId element not found');
  }
  
  // Show modal
  const modal = $('#qrModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    console.error('qrModal element not found');
    return;
  }
  
  // Get batch details for enhanced display
  const d = store.read();
  const batch = d.listings.concat(d.inventory).find(x => x.id === batchId);
  
  // Show loading state
  const qrDisplayElement = $('#qrCodeDisplay');
  if (qrDisplayElement) {
    qrDisplayElement.innerHTML = `
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <div class="text-gray-500 text-sm">Generating QR code...</div>
      </div>
    `;
  }
  
  // Generate QR code
  generateQRCode(batchId).then(dataUrl => {
    console.log('QR generation result:', dataUrl ? 'Success' : 'Failed');
    
    if (qrDisplayElement) {
      if (dataUrl) {
        qrDisplayElement.innerHTML = `
          <div class="text-center">
            <img src="${dataUrl}" alt="QR Code for ${batchId}" class="mx-auto mb-2" style="width: 140px; height: 140px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div class="text-xs text-gray-500">${batch ? batch.crop : 'AgriChain'} Batch</div>
          </div>
        `;
      } else {
        qrDisplayElement.innerHTML = `
          <div class="text-center text-red-500">
            <div class="text-2xl mb-2">⚠️</div>
            <div class="text-sm">Failed to generate QR code</div>
            <div class="text-xs text-gray-500 mt-1">Check console for details</div>
          </div>
        `;
      }
    }
  }).catch(error => {
    console.error('QR generation promise error:', error);
    if (qrDisplayElement) {
      qrDisplayElement.innerHTML = `
        <div class="text-center text-red-500">
          <div class="text-2xl mb-2">⚠️</div>
          <div class="text-sm">Error generating QR code</div>
          <div class="text-xs text-gray-500 mt-1">${error.message}</div>
        </div>
      `;
    }
  });
  
  console.log(`QR Modal opened for batch: ${batchId}`);
}

$('#closeQRModal').addEventListener('click', () => {
  $('#qrModal').classList.add('hidden');
  $('#qrModal').classList.remove('flex');
});

// -- QR Code Scanner --
function initQRScanner() {
  const config = { 
    fps: 10, 
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  };
  
  html5QrCode = new Html5Qrcode("qr-reader");
  
  const onScanSuccess = (decodedText) => {
    console.log('QR Code detected:', decodedText);
    
    // Extract batch ID from URL or use direct batch ID
    let batchId = decodedText;
    if (decodedText.includes('batch=')) {
      const urlParams = new URLSearchParams(decodedText.split('?')[1]);
      batchId = urlParams.get('batch');
    } else if (decodedText.startsWith('B') && decodedText.length === 7) {
      // Direct batch ID format
      batchId = decodedText;
    }
    
    if (batchId) {
      const userType = $('#userType').value;
      displayBatchInfo(batchId, userType);
      stopQRScanner();
    }
  };
  
  const onScanError = (errorMessage) => {
    // Ignore frequent scan errors
    if (!errorMessage.includes('No QR code found')) {
      console.log('Scan error:', errorMessage);
    }
  };
  
  return { config, onScanSuccess, onScanError };
}
function startQRScanner() {
  if (scannerRunning) return;

  const { config, onScanSuccess, onScanError } = initQRScanner();

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      // Try to find a camera labeled as "back" or "rear"
      let backCam = devices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear')
      );

      // If not found, use the first available camera
      const cameraId = backCam ? backCam.id : devices[0].id;

      html5QrCode.start(cameraId, config, onScanSuccess, onScanError)
        .then(() => {
          scannerRunning = true;
          $('#startScan').disabled = true;
          $('#stopScan').disabled = false;
          $('#scanResults').innerHTML = '<p class="text-blue-600">Camera started. Point at a QR code to scan...</p>';
        })
        .catch(err => {
          console.error('Error starting scanner:', err);
          $('#scanResults').innerHTML = '<p class="text-red-500">Failed to start camera. Please ensure camera permissions are granted.</p>';
        });
    } else {
      $('#scanResults').innerHTML = '<p class="text-red-500">No cameras found on this device.</p>';
    }
  }).catch(err => {
    console.error('Error getting cameras:', err);
    $('#scanResults').innerHTML = '<p class="text-red-500">Cannot access camera. Please check permissions.</p>';
  });
}


function stopQRScanner() {
  if (!scannerRunning || !html5QrCode) return;
  
  html5QrCode.stop().then(() => {
    scannerRunning = false;
    $('#startScan').disabled = false;
    $('#stopScan').disabled = true;
    $('#scanResults').innerHTML += '<p class="text-gray-600 mt-2">Camera stopped.</p>';
  }).catch(err => {
    console.error('Error stopping scanner:', err);
  });
}

// Scanner controls
$('#startScan').addEventListener('click', startQRScanner);
$('#stopScan').addEventListener('click', stopQRScanner);

// Manual lookup from scanner page
$('#manualLookup').addEventListener('click', () => {
  const batchId = $('#manualBatchId').value.trim();
  if (batchId) {
    const userType = $('#userType').value;
    displayBatchInfo(batchId, userType);
  }
});

// Sample QR scan button
$('#sampleQRScan').addEventListener('click', () => {
  const d = store.read();
  if (d.listings.length > 0) {
    const sampleBatch = d.listings[0];
    displayBatchInfo(sampleBatch.id, 'consumer');
    $('#lookupConsumerResult').innerHTML = $('#scanResults').innerHTML;
  } else {
    alert('No sample batches available. Create some listings first!');
  }
});

function displayBatchInfo(batchId, userType) {
  const d = store.read();
  const found = d.listings.concat(d.inventory).find(x => x.id === batchId);
  
  let html = '';
  
  if (!found) {
    html = '<p class="text-red-500">❌ Batch not found in system</p>';
  } else {
    if (userType === 'farmer') {
      // Farmer view - detailed transaction history and tracking
      html = `
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
          <div class="flex items-center">
            <div class="text-blue-600 text-lg">👨‍🌾</div>
            <div class="ml-3">
              <p class="text-sm text-blue-700 font-medium">Farmer Dashboard View</p>
              <p class="text-sm text-blue-600">Complete transaction history and real-time tracking</p>
            </div>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <h4 class="font-semibold text-gray-900 mb-2">📦 Batch Details</h4>
            <div class="bg-gray-50 rounded-lg p-3 text-sm">
              <div><strong>Batch ID:</strong> ${found.id}</div>
              <div><strong>Crop:</strong> ${found.crop}</div>
              <div><strong>Grade:</strong> ${found.grade}</div>
              <div><strong>Quantity:</strong> ${found.qty} kg</div>
              <div><strong>Status:</strong> <span class="px-2 py-1 rounded-full text-xs ${found.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${found.status}</span></div>
            </div>
          </div>
          
          <div>
            <h4 class="font-semibold text-gray-900 mb-2">📍 Real-time Location</h4>
            <div class="bg-gray-50 rounded-lg p-3 text-sm">
              ${d.iot.gps ? `
                <div><strong>Current Location:</strong> ${d.iot.gps}</div>
                <div><strong>Temperature:</strong> ${d.iot.temp}</div>
                <div><strong>Humidity:</strong> ${d.iot.hum}</div>
                <div class="text-xs text-green-600 mt-2">🟢 Live tracking active</div>
              ` : '<div class="text-gray-500">No real-time data available</div>'}
            </div>
          </div>
        </div>
        
        <div class="mb-4">
          <h4 class="font-semibold text-gray-900 mb-2">💰 Complete Transaction History</h4>
          <div class="bg-gray-50 rounded-lg p-3">
            ${(found.history || []).length > 0 ? `
              <div class="space-y-2">
                ${(found.history || []).map(h => `
                  <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                    <div>
                      <span class="font-medium">${h.stage}</span>
                      <div class="text-xs text-gray-600">${new Date(h.ts).toLocaleString()}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-semibold">₹${h.price}/kg</div>
                    </div>
                  </div>
                `).join('')}
              </div>
              
              <div class="mt-3 pt-3 border-t border-gray-200">
                <div class="flex justify-between items-center">
                  <span class="font-medium">Total Value Added:</span>
                  <span class="font-bold text-green-600">
                    ₹${Math.max(...(found.history || [{price: found.price}]).map(h => h.price)) - found.price}/kg
                  </span>
                </div>
              </div>
            ` : '<div class="text-gray-500">No transaction history available</div>'}
          </div>
        </div>
        
        <div class="text-xs text-gray-500 text-center p-2 bg-blue-50 rounded">
          🔒 This detailed view is only visible to the original farmer
        </div>
      `;
    } else {
      // Consumer view - basic product information
      html = `
        <div class="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
          <div class="flex items-center">
            <div class="text-green-600 text-lg">🛍</div>
            <div class="ml-3">
              <p class="text-sm text-green-700 font-medium">Consumer View</p>
              <p class="text-sm text-green-600">Product origin and quality information</p>
            </div>
          </div>
        </div>
        
        <div class="bg-white border rounded-lg p-4 mb-4">
          <h4 class="font-semibold text-gray-900 mb-3">🌾 Product Information</h4>
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <div class="space-y-2 text-sm">
                <div><strong>Product:</strong> ${found.crop}</div>
                <div><strong>Quality Grade:</strong> <span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">${found.grade}</span></div>
                <div><strong>Batch ID:</strong> <code class="bg-gray-100 px-2 py-1 rounded">${found.id}</code></div>
                <div><strong>Original Quantity:</strong> ${found.qty} kg</div>
              </div>
            </div>
            <div>
              <div class="space-y-2 text-sm">
                <div><strong>Farm Origin:</strong> ${found.farmer || 'Verified Producer'}</div>
                <div><strong>Status:</strong> <span class="px-2 py-1 rounded-full text-xs ${found.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${found.status}</span></div>
                ${found.notes ? `<div><strong>Notes:</strong> ${found.notes}</div>` : ''}
                <div class="text-green-600 text-sm">✅ Verified on blockchain</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-white border rounded-lg p-4 mb-4">
          <h4 class="font-semibold text-gray-900 mb-3">💲 Price Transparency</h4>
          ${(found.history || []).length > 0 ? `
            <div class="space-y-2">
              ${(found.history || []).map((h, i) => `
                <div class="flex justify-between items-center py-2 ${i < (found.history || []).length - 1 ? 'border-b border-gray-100' : ''}">
                  <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full ${h.stage === 'FARMER' ? 'bg-green-400' : h.stage === 'DISTRIBUTOR' ? 'bg-blue-400' : 'bg-purple-400'} mr-2"></div>
                    <span class="text-sm">${h.stage === 'FARMER' ? 'Farm Price' : h.stage === 'DISTRIBUTOR' ? 'Wholesale Price' : 'Retail Price'}</span>
                  </div>
                  <span class="font-semibold">₹${h.price}/kg</span>
                </div>
              `).join('')}
            </div>
          ` : `<div class="text-sm text-gray-600">Farm Price: ₹${found.price}/kg</div>`}
        </div>
        
        <div class="bg-white border rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-3">🛡 Quality Assurance</h4>
          <div class="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="flex items-center text-green-600 mb-1">
                <span class="mr-2">✅</span> Blockchain verified
              </div>
              <div class="flex items-center text-green-600 mb-1">
                <span class="mr-2">✅</span> Source authenticated
              </div>
              <div class="flex items-center text-green-600">
                <span class="mr-2">✅</span> Quality grade certified
              </div>
            </div>
            <div>
              ${d.iot.temp ? `
                <div class="text-gray-600">
                  <div>Storage conditions monitored</div>
                  <div class="text-xs">Last update: ${new Date().toLocaleTimeString()}</div>
                </div>
              ` : '<div class="text-gray-500">Real-time monitoring available</div>'}
            </div>
          </div>
        </div>
        
        <div class="text-xs text-gray-500 text-center p-2 bg-green-50 rounded mt-4">
          🌱 Farm-to-fork transparency powered by blockchain technology
        </div>
      `;
    }
  }
  
  $('#scanResults').innerHTML = html;
}

// Function to initialize farmer form event listeners
function initializeFarmerForm() {
  const farmerForm = $('#farmerForm');
  if (!farmerForm) {
    console.warn('Farmer form not found');
    return;
  }
  
  // Remove existing event listener to prevent duplicates
  const newForm = farmerForm.cloneNode(true);
  farmerForm.parentNode.replaceChild(newForm, farmerForm);
  
  // Add fresh event listener
  $('#farmerForm').addEventListener('submit', e => {
    console.log('Form submission started'); // Debug log
    e.preventDefault();
    
    const f = new FormData(e.target);
    
    // Validate form data
    const crop = f.get('crop')?.trim();
    const grade = f.get('grade');
    const qty = Number(f.get('qty'));
    const price = Number(f.get('price'));
    const notes = f.get('notes')?.trim() || '';
    
    console.log('Form data:', { crop, grade, qty, price, notes }); // Debug log
    
    // Validation
    if (!crop || crop === '') {
      alert('Please enter a crop name');
      return;
    }
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity (greater than 0)');
      return;
    }
    if (!price || price <= 0) {
      alert('Please enter a valid price (greater than 0)');
      return;
    }
    
    const d = store.read();
    const id = uid();
    
    const listing = {
      id,
      crop,
      grade,
      qty,
      price,
      notes,
      farmer: 'Farmer #' + (new Set(d.listings.map(x => x.farmer)).size + 1),
      status: 'AVAILABLE',
      history: [{ stage: 'FARMER', price, ts: Date.now() }]
    };
    
    console.log('New listing:', listing); // Debug log
    
    d.listings.push(listing);
    store.write(d);
    
    console.log('Data saved, refreshing table'); // Debug log
    
    alert('Listing saved successfully!\nBatch ID: ' + id + '\nQR code generated!');
    renderFarmer();
    refreshStats();
    e.target.reset();
  });
  
  // Also ensure seed data button works
  const seedBtn = $('#seedData');
  if (seedBtn) {
    // Remove existing listener
    const newSeedBtn = seedBtn.cloneNode(true);
    seedBtn.parentNode.replaceChild(newSeedBtn, seedBtn);
    
    // Add fresh listener
    $('#seedData').addEventListener('click', () => {
      const samples = [ 
        { crop:'Wheat',grade:'A',qty:500,price:22,notes:'Organic certified' },
        { crop:'Rice',grade:'B',qty:800,price:28,notes:'Premium basmati' },
        { crop:'Tomato',grade:'A',qty:300,price:18,notes:'Greenhouse grown' }
      ];
      const d = store.read();
      samples.forEach((s, index) => {
        const id = uid();
        const baseTimestamp = Date.now() - (index * 24 * 60 * 60 * 1000); // Spread over 3 days
        
        // Create more realistic transaction history for demo
        const history = [{ stage: 'FARMER', price: s.price, ts: baseTimestamp }];
        
        // Add distributor and retailer stages for demo
        const distPrice = Math.round(s.price * (1.15 + Math.random() * 0.1)); // 15-25% markup
        history.push({ 
          stage: 'DISTRIBUTOR', 
          price: distPrice, 
          ts: baseTimestamp + (2 * 60 * 60 * 1000) // 2 hours later 
        });
        
        const retailPrice = Math.round(distPrice * (1.2 + Math.random() * 0.15)); // 20-35% markup
        history.push({ 
          stage: 'RETAILER', 
          price: retailPrice, 
          ts: baseTimestamp + (6 * 60 * 60 * 1000) // 6 hours later 
        });
        
        const status = 'RETAIL';
        
        // Add to listings
        d.listings.push({ 
          ...s, 
          id, 
          farmer:'Demo Farmer', 
          status: 'AVAILABLE', 
          history: [{ stage: 'FARMER', price: s.price, ts: baseTimestamp }]
        });
        
        // Add to inventory for retail
        d.inventory.push({
          ...s,
          id,
          farmer: 'Demo Farmer',
          farmerPrice: s.price,
          distributorPrice: distPrice,
          retailPrice: retailPrice,
          margin: Math.round(((retailPrice - s.price) / s.price) * 100),
          status: status,
          history: history
        });
      });
      
      // Add some demo IoT data
      d.iot = {
        temp: '18.5°C',
        hum: '65%',
        gps: '28.6139, 77.2090',
        timestamp: Date.now()
      };
      
      store.write(d);
      alert('Seeded 3 demo listings with complete supply chain data, transaction histories and QR codes.');
      renderFarmer();
      refreshStats();
    });
  }
  
  console.log('Farmer form event listener initialized');
}

// -- Farmer Logic --
// Form event listener is now handled by initializeFarmerForm()

// Seed data functionality is now handled by initializeFarmerForm()

function renderFarmer() {
  console.log('renderFarmer called'); // Debug log
  const d = store.read();
  console.log('Current listings:', d.listings); // Debug log
  
  const rows = d.listings.map(x => `
    <tr class="border-t hover:bg-gray-50">
      <td class="py-2 px-2">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">${x.id}</span>
          <button onclick="showQRModal('${x.id}')" class="text-blue-500 hover:text-blue-700 text-xs" title="Show QR Code">
            📱
          </button>
        </div>
      </td>
      <td class="py-2 px-2">${x.crop}</td>
      <td class="py-2 px-2">${x.grade}</td>
      <td class="py-2 px-2">${x.qty} kg</td>
      <td class="py-2 px-2">₹${x.price}/kg</td>
      <td class="py-2 px-2"><span class="${x.status==='AVAILABLE'?'text-emerald-600':'text-gray-600'} text-xs px-2 py-1 rounded-full ${x.status==='AVAILABLE'?'bg-emerald-100':'bg-gray-100'}">${x.status}</span></td>
      <td class="py-2 px-2">
        <button onclick="showQRModal('${x.id}')" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors flex items-center gap-1">
          <span>📱</span> <span class="hidden sm:inline">Show QR</span>
        </button>
      </td>
    </tr>`).join('');
  
  const tableElement = $('#farmerTable');
  if (tableElement) {
    tableElement.innerHTML = rows;
    console.log('Table updated with', d.listings.length, 'rows'); // Debug log
  } else {
    console.error('farmerTable element not found'); // Debug log
  }
  
  // Update farmer stats in lookup panel
  const totalBatches = d.listings.length;
  const activeBatches = d.listings.filter(x => x.status === 'AVAILABLE').length;
  
  const totalElement = $('#farmerTotalBatches');
  const activeElement = $('#farmerActiveBatches');
  
  if (totalElement) {
    totalElement.textContent = totalBatches;
  }
  if (activeElement) {
    activeElement.textContent = activeBatches;
  }
  
  console.log('Stats updated:', { totalBatches, activeBatches }); // Debug log
}

// Function to initialize farmer lookup event listeners
function initializeFarmerLookup() {
  console.log('Initializing farmer lookup event listeners');
  
  // Initialize lookup button
  const lookupBtn = $('#lookupFarmerBtn');
  if (lookupBtn) {
    // Remove existing event listener to prevent duplicates
    const newLookupBtn = lookupBtn.cloneNode(true);
    lookupBtn.parentNode.replaceChild(newLookupBtn, lookupBtn);
    
    // Add fresh event listener
    $('#lookupFarmerBtn').addEventListener('click', () => {
      console.log('Farmer lookup button clicked'); // Debug log
      const bid = $('#lookupBatchFarmer').value.trim();
      if (!bid) {
        $('#lookupFarmerResult').innerHTML = '<p class="text-red-500">Please enter a Batch ID</p>';
        return;
      }
      
      const d = store.read();
      const found = d.listings.concat(d.inventory).find(x => x.id === bid);
      
      console.log('Lookup result:', found); // Debug log
      
      let html = '';
      
      if (!found) {
        html = '<p class="text-red-500">❌ Batch not found in system</p>';
      } else {
        // Enhanced farmer view with complete transaction details
        html = `
          <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded">
            <div class="flex items-center">
              <div class="text-blue-600 text-lg">👨‍🌾</div>
              <div class="ml-3">
                <p class="text-sm text-blue-700 font-medium">Farmer Dashboard - Complete Batch Overview</p>
                <p class="text-sm text-blue-600">Full transaction history and real-time tracking</p>
              </div>
            </div>
          </div>
          
          <div class="grid md:grid-cols-2 gap-4 mb-6">
            <div class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                <span class="text-green-600 mr-2">📦</span> Batch Information
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Batch ID:</span>
                  <span class="font-mono bg-gray-100 px-2 py-1 rounded">${found.id}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Crop:</span>
                  <span class="font-semibold">${found.crop}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Quality Grade:</span>
                  <span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">${found.grade}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Original Quantity:</span>
                  <span class="font-semibold">${found.qty} kg</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Current Status:</span>
                  <span class="px-2 py-1 rounded-full text-xs ${
                    found.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 
                    found.status === 'PURCHASED' ? 'bg-yellow-100 text-yellow-800' :
                    found.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }">${found.status}</span>
                </div>
                ${found.notes ? `
                  <div class="flex justify-between">
                    <span class="text-gray-600">Notes:</span>
                    <span class="text-right text-sm">${found.notes}</span>
                  </div>
                ` : ''}
                <div class="flex justify-between">
                  <span class="text-gray-600">Farm Origin:</span>
                  <span class="font-semibold text-green-600">${found.farmer || 'Your Farm'}</span>
                </div>
              </div>
            </div>
            
            <div class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
                <span class="text-blue-600 mr-2">📍</span> Real-time Tracking
              </h4>
              ${d.iot.gps ? `
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Current Location:</span>
                    <span class="text-right text-xs font-mono">${d.iot.gps}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Temperature:</span>
                    <span class="font-semibold text-orange-600">${d.iot.temp}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Humidity:</span>
                    <span class="font-semibold text-blue-600">${d.iot.hum}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Last Updated:</span>
                    <span class="text-xs text-gray-500">${new Date(d.iot.timestamp || Date.now()).toLocaleString()}</span>
                  </div>
                  <div class="mt-3 p-2 bg-green-50 rounded-lg">
                    <div class="flex items-center text-green-700 text-sm">
                      <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Live tracking active
                    </div>
                  </div>
                </div>
              ` : `
                <div class="text-center py-4">
                  <div class="text-gray-400 text-2xl mb-2">📡</div>
                  <p class="text-gray-500 text-sm">No real-time data available</p>
                  <p class="text-xs text-gray-400">Tracking will activate when batch moves to distributor</p>
                </div>
              `}
            </div>
          </div>
          
          <div class="bg-white border rounded-lg p-4 mb-6">
            <h4 class="font-semibold text-gray-900 mb-4 flex items-center">
              <span class="text-purple-600 mr-2">💰</span> Complete Transaction History
            </h4>
            ${(found.history || []).length > 0 ? `
              <div class="space-y-3">
                ${(found.history || []).map((h, index) => {
                  const isLatest = index === (found.history || []).length - 1;
                  const stageColors = {
                    'FARMER': 'bg-green-100 text-green-800 border-green-200',
                    'DISTRIBUTOR': 'bg-blue-100 text-blue-800 border-blue-200',
                    'RETAILER': 'bg-purple-100 text-purple-800 border-purple-200'
                  };
                  const stageIcons = {
                    'FARMER': '🌾',
                    'DISTRIBUTOR': '🚚', 
                    'RETAILER': '🏪'
                  };
                  return `
                    <div class="border rounded-lg p-3 ${isLatest ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'} relative">
                      ${isLatest ? '<div class="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">Current</div>' : ''}
                      <div class="flex justify-between items-start">
                        <div class="flex-1">
                          <div class="flex items-center mb-2">
                            <span class="text-lg mr-2">${stageIcons[h.stage] || '📋'}</span>
                            <span class="font-semibold">${h.stage} Stage</span>
                            <span class="ml-2 px-2 py-1 rounded-full text-xs ${stageColors[h.stage] || 'bg-gray-100 text-gray-800'} border">
                              ${h.stage === 'FARMER' ? 'Farm Gate' : h.stage === 'DISTRIBUTOR' ? 'Wholesale' : 'Retail'}
                            </span>
                          </div>
                          <div class="text-sm text-gray-600 mb-1">
                            <strong>Date:</strong> ${new Date(h.ts).toLocaleDateString()} at ${new Date(h.ts).toLocaleTimeString()}
                          </div>
                          ${h.stage !== 'FARMER' ? `
                            <div class="text-xs text-gray-500">
                              Transaction processed • ${h.stage === 'DISTRIBUTOR' ? 'Wholesale acquisition' : 'Retail markup applied'}
                            </div>
                          ` : `
                            <div class="text-xs text-green-600">
                              Original listing • Farm gate price set
                            </div>
                          `}
                        </div>
                        <div class="text-right">
                          <div class="font-bold text-lg">₹${h.price}<span class="text-sm text-gray-500">/kg</span></div>
                          ${index > 0 ? `
                            <div class="text-xs ${
                              h.price > (found.history || [])[index-1].price ? 'text-red-600' : 'text-green-600'
                            }">
                              ${h.price > (found.history || [])[index-1].price ? '+' : ''}₹${(h.price - (found.history || [])[index-1].price).toFixed(2)}
                              (${(((h.price - (found.history || [])[index-1].price) / (found.history || [])[index-1].price) * 100).toFixed(1)}%)
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              
              <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                <h5 class="font-semibold mb-3">Financial Summary</h5>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div class="text-center">
                    <div class="text-xs text-gray-500">Original Price</div>
                    <div class="font-bold text-green-600">₹${found.price}/kg</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xs text-gray-500">Current Price</div>
                    <div class="font-bold">₹${Math.max(...(found.history || [{price: found.price}]).map(h => h.price))}/kg</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xs text-gray-500">Total Value Added</div>
                    <div class="font-bold text-blue-600">₹${(Math.max(...(found.history || [{price: found.price}]).map(h => h.price)) - found.price).toFixed(2)}/kg</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xs text-gray-500">Price Increase</div>
                    <div class="font-bold text-purple-600">${(((Math.max(...(found.history || [{price: found.price}]).map(h => h.price)) - found.price) / found.price) * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div class="mt-3 text-xs text-gray-600 text-center">
                  Total batch value: ₹${(Math.max(...(found.history || [{price: found.price}]).map(h => h.price)) * found.qty).toLocaleString()} 
                  | Your earnings: ₹${(found.price * found.qty).toLocaleString()}
                </div>
              </div>
            ` : `
              <div class="text-center py-6">
                <div class="text-gray-400 text-3xl mb-2">📊</div>
                <p class="text-gray-500">No transaction history available</p>
                <p class="text-xs text-gray-400 mt-1">History will be created when batch is purchased</p>
              </div>
            `}
          </div>
          
          <div class="bg-white border rounded-lg p-4 mb-4">
            <h4 class="font-semibold text-gray-900 mb-3 flex items-center">
              <span class="text-orange-600 mr-2">⚡</span> Quick Actions
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onclick="showQRModal('${found.id}')" class="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                <span>📱</span> View QR Code
              </button>
              <button onclick="navigator.share && navigator.share({title: 'Batch ${found.id}', text: 'Track this AgriChain batch', url: window.location.origin + window.location.pathname + '#qr-scanner?batch=${found.id}'}).catch(() => {})" class="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                <span>🔗</span> Share Batch
              </button>
              <button onclick="window.print()" class="flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                <span>🖨️</span> Print Report
              </button>
            </div>
          </div>
          
          <div class="text-xs text-gray-500 text-center p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <span class="text-blue-600">🔒</span> This detailed view is only visible to the original farmer who created this batch
          </div>
        `;
      }
      
      $('#lookupFarmerResult').innerHTML = html;
    });
  }
  
  console.log('Farmer lookup event listener initialized');
}

// Farmer lookup event listener is now handled by initializeFarmerLookup() function
// This ensures proper initialization when the farmer page is accessed

// -- Distributor Logic --
function renderDistributor() {
  const d = store.read();
  const avail = d.listings.filter(x => x.status === 'AVAILABLE');
  $('#marketTable').innerHTML = avail.map(x => `
    <tr class="border-t hover:bg-gray-50">
      <td class="py-2 px-2 font-mono text-xs">${x.id}</td><td class="py-2 px-2">${x.crop}</td><td class="py-2 px-2">${x.grade}</td><td class="py-2 px-2">${x.qty} kg</td>
      <td class="py-2 px-2">₹${x.price}/kg</td>
      <td class="py-2 px-2"><button data-id="${x.id}" class="px-2 py-1 border rounded-xl buy-btn hover:bg-emerald-50 text-xs transition-colors">Buy</button></td>
    </tr>`).join('');
  
  $$('.buy-btn').forEach(b => b.addEventListener('click', () => purchaseLot(b.getAttribute('data-id'))));
  
  // Initialize distributor charges calculator
  initializeDistributorCharges();
  
  // Initialize IoT display if data exists
  if (d.iot && d.iot.gps) {
    $('#iotTemp').textContent = d.iot.temp || '—';
    $('#iotHum').textContent = d.iot.hum || '—';
    $('#iotGps').textContent = d.iot.gps || '—';
    $('#iotTime').textContent = d.iot.lastUpdate || new Date(d.iot.timestamp || Date.now()).toLocaleString();
    
    const locationElement = $('#iotLocation');
    if (locationElement) {
      locationElement.textContent = d.iot.locationName || 'Distribution Center';
    }
  }
  
  renderPurchased();
}

// Function to initialize distributor charges calculator
function initializeDistributorCharges() {
  const transportInput = $('#transportationCharge');
  const storageInput = $('#storageCharge');
  const handlingInput = $('#handlingCharge');
  const totalChargesDisplay = $('#totalCharges');
  
  // Function to update total charges display
  function updateTotalCharges() {
    const transport = Number(transportInput.value) || 0;
    const storage = Number(storageInput.value) || 0;
    const handling = Number(handlingInput.value) || 0;
    const total = transport + storage + handling;
    
    totalChargesDisplay.textContent = `₹${total.toFixed(2)}/kg`;
  }
  
  // Add event listeners to update total when values change
  [transportInput, storageInput, handlingInput].forEach(input => {
    if (input) {
      input.addEventListener('input', updateTotalCharges);
      input.addEventListener('change', updateTotalCharges);
    }
  });
  
  // Initialize total display
  updateTotalCharges();
}

// Function to get current distributor charges
function getDistributorCharges() {
  const transportation = Number($('#transportationCharge').value) || 0;
  const storage = Number($('#storageCharge').value) || 0;
  const handling = Number($('#handlingCharge').value) || 0;
  
  return {
    transportation,
    storage,
    handling,
    total: transportation + storage + handling
  };
}
  


function purchaseLot(id) {
  const d = store.read();
  const item = d.listings.find(x => x.id === id);
  if (!item) return;
  
  // Get distributor charges
  const charges = getDistributorCharges();
  
  // Calculate distributor price including base markup and charges
  const baseMarkup = 10 + Math.random() * 10; // 10-20% base markup
  const baseDistPrice = item.price * (1 + baseMarkup / 100);
  const distPrice = Math.round(baseDistPrice + charges.total);
  
  item.status = 'PURCHASED';
  item.history.push({ 
    stage: 'DISTRIBUTOR', 
    price: distPrice, 
    ts: Date.now(),
    charges: {
      transportation: charges.transportation,
      storage: charges.storage,
      handling: charges.handling,
      baseMarkup: baseMarkup.toFixed(1)
    },
    breakdown: {
      farmPrice: item.price,
      baseMarkup: baseMarkup.toFixed(1) + '%',
      transportation: charges.transportation,
      storage: charges.storage,
      handling: charges.handling,
      totalPrice: distPrice
    }
  });
  
  d.purchases.push({ 
    id: item.id, 
    crop: item.crop, 
    qty: item.qty, 
    farmerPrice: item.price, 
    distributorPrice: distPrice,
    purchaseTimestamp: Date.now(),
    charges: {
      transportation: charges.transportation,
      storage: charges.storage,
      handling: charges.handling,
      total: charges.total
    }
  });
  
  d.inventory.push({ 
    id: item.id, 
    crop: item.crop, 
    qty: item.qty, 
    farmerPrice: item.price, 
    distributorPrice: distPrice, 
    retailPrice: null, 
    margin: null, 
    history: item.history,
    grade: item.grade,
    notes: item.notes,
    farmer: item.farmer,
    status: 'IN_TRANSIT',
    distributorCharges: {
      transportation: charges.transportation,
      storage: charges.storage,
      handling: charges.handling,
      total: charges.total
    }
  });
  
  // Automatically update IoT tracking data when purchase happens
  updateDistributorLocation();
  
  store.write(d);
  renderDistributor();
  
  // Enhanced purchase confirmation with charge breakdown
  const chargeBreakdown = `
Price Breakdown:
• Farm Price: ₹${item.price}/kg
• Transportation: ₹${charges.transportation}/kg
• Storage: ₹${charges.storage}/kg
• Handling: ₹${charges.handling}/kg
• Base Markup: ${baseMarkup.toFixed(1)}%
• Final Price: ₹${distPrice}/kg`;
  
  alert(`Purchased ${id} successfully!${chargeBreakdown}\n\nReal-time tracking activated!`);
}

// Function to automatically update distributor location and IoT data
function updateDistributorLocation() {
  const locations = [
    { gps: '28.6139, 77.2090', name: 'Delhi Distribution Center' },
    { gps: '28.7041, 77.1025', name: 'Gurgaon Warehouse' },
    { gps: '28.5355, 77.3910', name: 'Noida Processing Unit' },
    { gps: '28.4595, 77.0266', name: 'Manesar Cold Storage' },
    { gps: '28.6692, 77.4538', name: 'Faridabad Hub' },
    { gps: '28.9845, 77.7064', name: 'Meerut Distribution' }
  ];
  
  const selectedLocation = locations[Math.floor(Math.random() * locations.length)];
  
  const d = store.read();
  d.iot = {
    temp: (15 + Math.random() * 15).toFixed(1) + '°C',
    hum: (50 + Math.random() * 30).toFixed(0) + '%',
    gps: selectedLocation.gps,
    locationName: selectedLocation.name,
    timestamp: Date.now(),
    status: 'IN_TRANSIT',
    lastUpdate: new Date().toLocaleString()
  };
  
  store.write(d);
  
  // Update UI elements
  $('#iotTemp').textContent = d.iot.temp;
  $('#iotHum').textContent = d.iot.hum;
  $('#iotGps').textContent = d.iot.gps;
  $('#iotTime').textContent = d.iot.lastUpdate;
  
  // Add location name if element exists
  const locationNameElement = $('#iotLocation');
  if (locationNameElement) {
    locationNameElement.textContent = d.iot.locationName;
  }
  
  // Show notification for automatic updates
  showLocationUpdateNotification(d.iot.locationName);
  
  console.log('Location updated automatically:', d.iot);
}

// Function to show location update notifications
function showLocationUpdateNotification(locationName) {
  // Create or update notification element
  let notification = $('#locationNotification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'locationNotification';
    notification.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm transition-all duration-300';
    document.body.appendChild(notification);
  }
  
  notification.innerHTML = `
    <div class="flex items-center gap-2">
      📡 <span>Location updated: ${locationName}</span>
    </div>
  `;
  
  notification.style.opacity = '1';
  notification.style.transform = 'translateX(0)';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function renderPurchased() {
  const d = store.read();
  if (d.purchases.length === 0) {
    $('#purchasedList').innerHTML = '<li class="text-gray-500 text-sm">No purchases yet. Buy some batches above to start tracking.</li>';
    return;
  }
  
  $('#purchasedList').innerHTML = d.purchases.map(p => {
    const timeSincePurchase = Date.now() - (p.purchaseTimestamp || Date.now());
    const minutesAgo = Math.floor(timeSincePurchase / (1000 * 60));
    const timeAgoText = minutesAgo < 1 ? 'Just now' : 
                       minutesAgo < 60 ? `${minutesAgo}m ago` : 
                       `${Math.floor(minutesAgo / 60)}h ago`;
    
    return `<li class="flex justify-between items-center py-1">
      <span>${p.id} • ${p.crop} • ₹${p.distributorPrice}/kg</span>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">${timeAgoText}</span>
        <span class="flex items-center text-green-600 text-xs">
          <span class="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
          Tracking Active
        </span>
      </div>
    </li>`;
  }).join('');
}

$('#genIot').addEventListener('click', () => {
  updateDistributorLocation();
  
  // Show user feedback
  const button = $('#genIot');
  const originalText = button.textContent;
  button.textContent = '✅ Updated!';
  button.style.backgroundColor = '#10b981';
  button.style.color = 'white';
  
  setTimeout(() => {
    button.textContent = originalText;
    button.style.backgroundColor = '';
    button.style.color = '';
  }, 2000);
});

// Function to initialize retailer event listeners
function initializeRetailerEvents() {
  console.log('Initializing retailer event listeners'); // Debug log
  
  // Initialize retailer margin input and price calculation
  const retailMarginInput = $('#retailMarginInput');
  const distributorBatchSelect = $('#distributorBatchSelect');
  
  // Function to update price breakdown and final price
  function updatePriceBreakdown() {
    const selectedBatchId = distributorBatchSelect.value;
    const retailMargin = Number(retailMarginInput.value) || 0;
    
    if (!selectedBatchId) {
      $('#priceBreakdownDisplay').innerHTML = '<div class="text-gray-500 text-center">Select a batch below to see price breakdown</div>';
      $('#finalRetailPrice').textContent = '₹0/kg';
      return;
    }
    
    const d = store.read();
    const batch = d.inventory.find(x => x.id === selectedBatchId);
    
    if (!batch) {
      $('#priceBreakdownDisplay').innerHTML = '<div class="text-red-500 text-center">Batch not found</div>';
      $('#finalRetailPrice').textContent = '₹0/kg';
      return;
    }
    
    // Calculate final retail price
    const distributorPrice = batch.distributorPrice;
    const retailPrice = Math.round(distributorPrice * (1 + retailMargin / 100));
    
    // Build price breakdown display
    let breakdownHtml = `
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-gray-600">Farm Price:</span>
          <span class="font-semibold">₹${batch.farmerPrice}/kg</span>
        </div>`;
    
    if (batch.distributorCharges) {
      const charges = batch.distributorCharges;
      breakdownHtml += `
        <div class="border-t pt-2">
          <div class="text-xs text-gray-500 mb-1">Distributor Charges:</div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600 ml-2">• Transportation:</span>
            <span>₹${charges.transportation}/kg</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600 ml-2">• Storage:</span>
            <span>₹${charges.storage}/kg</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600 ml-2">• Handling:</span>
            <span>₹${charges.handling}/kg</span>
          </div>
        </div>`;
    }
    
    breakdownHtml += `
        <div class="border-t pt-2">
          <div class="flex justify-between font-medium">
            <span class="text-blue-600">Distributor Price:</span>
            <span class="text-blue-600">₹${distributorPrice}/kg</span>
          </div>
        </div>
        <div class="border-t pt-2">
          <div class="flex justify-between">
            <span class="text-gray-600">Your Margin (${retailMargin}%):</span>
            <span class="text-green-600">+₹${(retailPrice - distributorPrice)}/kg</span>
          </div>
        </div>
      </div>`;
    
    $('#priceBreakdownDisplay').innerHTML = breakdownHtml;
    $('#finalRetailPrice').textContent = `₹${retailPrice}/kg`;
  }
  
  // Add event listeners for real-time price updates
  if (retailMarginInput) {
    const newMarginInput = retailMarginInput.cloneNode(true);
    retailMarginInput.parentNode.replaceChild(newMarginInput, retailMarginInput);
    
    $('#retailMarginInput').addEventListener('input', updatePriceBreakdown);
    $('#retailMarginInput').addEventListener('change', updatePriceBreakdown);
  }
  
  if (distributorBatchSelect) {
    const newBatchSelect = distributorBatchSelect.cloneNode(true);
    distributorBatchSelect.parentNode.replaceChild(newBatchSelect, distributorBatchSelect);
    
    $('#distributorBatchSelect').addEventListener('change', () => {
      updatePriceBreakdown();
      // Re-populate the select to maintain its content
      renderRetailer();
      // Update breakdown again after re-render
      setTimeout(updatePriceBreakdown, 100);
    });
  }
  
  // Initialize retailer purchase button
  const retailPurchaseBtn = $('#retailPurchaseBtn');
  console.log('retailPurchaseBtn element found:', !!retailPurchaseBtn); // Debug log
  
  if (retailPurchaseBtn) {
    // Remove existing listener
    const newRetailBtn = retailPurchaseBtn.cloneNode(true);
    retailPurchaseBtn.parentNode.replaceChild(newRetailBtn, retailPurchaseBtn);
    
    // Add fresh event listener
    $('#retailPurchaseBtn').addEventListener('click', () => {
      console.log('Retailer purchase clicked'); // Debug log
      const selectedBatchId = $('#distributorBatchSelect').value;
      const retailMargin = Number($('#retailMarginInput').value) || 0;
      
      console.log('Selected batch ID:', selectedBatchId, 'Retail Margin:', retailMargin); // Debug log
      
      if (!selectedBatchId) {
        alert('Please select a batch to purchase');
        return;
      }
      
      if (retailMargin < 0) {
        alert('Please enter a valid retail margin (0% or higher)');
        return;
      }
      
      const d = store.read();
      const batch = d.inventory.find(x => x.id === selectedBatchId);
      console.log('Found batch:', batch); // Debug log
      
      if (!batch) {
        alert('Batch not found');
        return;
      }
      
      // Calculate retail price using the margin
      const retailPrice = Math.round(batch.distributorPrice * (1 + retailMargin / 100));
      
      // Update batch with retail information
      batch.retailPrice = retailPrice;
      batch.retailMargin = retailMargin; // Store actual retailer margin
      batch.totalMargin = Math.round(((retailPrice - batch.farmerPrice) / batch.farmerPrice) * 100); // Total margin from farm
      batch.status = 'RETAIL';
      batch.history.push({ 
        stage: 'RETAILER', 
        price: retailPrice, 
        ts: Date.now(),
        retailer: 'Demo Retailer',
        margin: retailMargin
      });
      
      // Add to retail purchases
      d.retailPurchases.push({
        id: batch.id,
        crop: batch.crop,
        qty: batch.qty,
        purchasePrice: batch.distributorPrice,
        retailPrice: retailPrice,
        margin: retailMargin,
        timestamp: Date.now()
      });
      
      store.write(d);
      
      // Enhanced alert with detailed breakdown
      let alertMessage = `Successfully purchased ${batch.crop} for retail!\n\nPrice Breakdown:\n• Farm Price: ₹${batch.farmerPrice}/kg`;
      
      if (batch.distributorCharges) {
        const charges = batch.distributorCharges;
        alertMessage += `\n• Transportation: ₹${charges.transportation}/kg`;
        alertMessage += `\n• Storage: ₹${charges.storage}/kg`;
        alertMessage += `\n• Handling: ₹${charges.handling}/kg`;
        alertMessage += `\n• Total Distributor Charges: ₹${charges.total}/kg`;
      }
      
      alertMessage += `\n• Distributor Price: ₹${batch.distributorPrice}/kg`;
      alertMessage += `\n• Your Margin: ${retailMargin}% (+₹${(retailPrice - batch.distributorPrice)}/kg)`;
      alertMessage += `\n• Final Retail Price: ₹${retailPrice}/kg`;
      alertMessage += `\n\nTotal Margin from Farm: ${Math.round(((retailPrice - batch.farmerPrice) / batch.farmerPrice) * 100)}%`;
      
      alert(alertMessage);
      renderRetailer();
    });
  }
  
  // Initialize the price breakdown on load
  updatePriceBreakdown();
  
  console.log('Retailer event listeners initialized');
}

// -- Retailer Logic --
function renderRetailer() {
  const d = store.read();
  console.log('renderRetailer called - Current inventory:', d.inventory); // Debug log
  
  $('#retailTable').innerHTML = d.inventory.map(x => {
    let chargesDisplay = '<span class="text-gray-400">—</span>';
    if (x.distributorCharges) {
      const charges = x.distributorCharges;
      chargesDisplay = `<div class="text-xs">
        <div>T: ₹${charges.transportation}</div>
        <div>S: ₹${charges.storage}</div>
        <div>H: ₹${charges.handling}</div>
      </div>`;
    }
    
    // Show only retailer's actual margin, not total margin from farm
    let marginDisplay = '<span class="text-gray-400">—</span>';
    if (x.retailPrice && x.retailMargin !== undefined) {
      marginDisplay = `${x.retailMargin}%`;
    }
    
    return `
    <tr class="border-t">
      <td class="py-2">${x.id}</td><td>${x.crop}</td><td>${x.qty} kg</td>
      <td>₹${x.farmerPrice}</td><td>₹${x.distributorPrice}</td>
      <td>${chargesDisplay}</td>
      <td>${x.retailPrice ? '₹'+x.retailPrice : '<span class="text-gray-400">—</span>'}</td>
      <td>${marginDisplay}</td>
    </tr>`;
  }).join('');
    
  // Populate distributor batches for retailer purchase
  const distributorBatches = d.inventory.filter(x => x.status === 'IN_TRANSIT' && !x.retailPrice);
  console.log('Available distributor batches for retailer:', distributorBatches); // Debug log
  
  const selectElement = $('#distributorBatchSelect');
  if (selectElement) {
    const currentSelection = selectElement.value; // Preserve current selection
    
    selectElement.innerHTML = '<option value="">Select batch to purchase...</option>' + 
      distributorBatches.map(x => {
        const chargeInfo = x.distributorCharges ? 
          ` (Charges: ₹${x.distributorCharges.total}/kg)` : '';
        return `<option value="${x.id}" ${currentSelection === x.id ? 'selected' : ''}>${x.crop} (Grade ${x.grade}) - ₹${x.distributorPrice}/kg${chargeInfo} - ${x.qty}kg available</option>`;
      }).join('');
    
    if (distributorBatches.length === 0) {
      selectElement.innerHTML = '<option value="">No batches available - Distributors need to purchase from farmers first</option>';
      console.log('No batches available for retailer purchase'); // Debug log
    } else {
      console.log('Populated dropdown with', distributorBatches.length, 'batches'); // Debug log
    }
  } else {
    console.error('distributorBatchSelect element not found'); // Debug log
  }
}

// Compute price and purchase functionality is now handled by initializeRetailerEvents()

// -- Consumer Logic --
function renderConsumer() {
  const d = store.read();
  console.log('renderConsumer called - Current data:', { 
    inventory: d.inventory.length, 
    listings: d.listings.length,
    retailBatches: d.inventory.filter(x => x.status === 'RETAIL' && x.retailPrice).length,
    farmBatches: d.listings.filter(x => x.status === 'AVAILABLE').length
  }); // Debug log
  
  // Populate retail batches for consumer purchase
  const retailBatches = d.inventory.filter(x => x.status === 'RETAIL' && x.retailPrice);
  console.log('Available retail batches:', retailBatches); // Debug log
  
  const retailSelectElement = $('#retailBatchSelect');
  if (retailSelectElement) {
    retailSelectElement.innerHTML = '<option value="">Select retail product...</option>' + 
      retailBatches.map(x => `<option value="${x.id}">${x.crop} (Grade ${x.grade}) - ₹${x.retailPrice}/kg - ${x.qty}kg available</option>`).join('');
    
    if (retailBatches.length === 0) {
      retailSelectElement.innerHTML = '<option value="">No retail products available - Retailers need to purchase from distributors first</option>';
    }
  }
    
  // Populate farm batches for direct purchase
  const farmBatches = d.listings.filter(x => x.status === 'AVAILABLE');
  console.log('Available farm batches:', farmBatches); // Debug log
  
  const farmSelectElement = $('#farmBatchSelect');
  if (farmSelectElement) {
    farmSelectElement.innerHTML = '<option value="">Select farm product...</option>' + 
      farmBatches.map(x => `<option value="${x.id}">${x.crop} (Grade ${x.grade}) - ₹${x.price}/kg - ${x.qty}kg available</option>`).join('');
    
    if (farmBatches.length === 0) {
      farmSelectElement.innerHTML = '<option value="">No farm products available - Farmers need to create listings first</option>';
    }
  }
    
  // Render consumer purchase history
  renderConsumerPurchases();
}

function renderConsumerPurchases() {
  const d = store.read();
  if (d.consumerPurchases.length === 0) {
    $('#consumerPurchases').innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No purchases yet. Start shopping above!</p>';
    return;
  }
  
  $('#consumerPurchases').innerHTML = d.consumerPurchases.map(purchase => {
    const savings = purchase.directPurchase ? 
      `<span class="text-green-600 text-xs">✨ Saved ₹${((purchase.estimatedRetailPrice - purchase.paidPrice) * purchase.purchasedQty).toFixed(2)} vs retail</span>` : '';
    
    return `
      <div class="border rounded-lg p-3 hover:bg-gray-50">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-semibold">${purchase.crop}</span>
              <span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">Grade ${purchase.grade}</span>
              ${purchase.directPurchase ? '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Direct Farm</span>' : '<span class="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">Retail</span>'}
            </div>
            <div class="text-sm text-gray-600">
              <span class="font-mono">${purchase.batchId}</span> • 
              ${purchase.purchasedQty}kg • 
              ₹${purchase.paidPrice}/kg • 
              Total: ₹${(purchase.paidPrice * purchase.purchasedQty).toFixed(2)}
            </div>
            <div class="text-xs text-gray-500">
              ${new Date(purchase.timestamp).toLocaleDateString()} at ${new Date(purchase.timestamp).toLocaleTimeString()}
            </div>
            ${savings}
          </div>
          <button onclick="showQRModal('${purchase.batchId}')" class="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs transition-colors">📱</button>
        </div>
      </div>
    `;
  }).reverse().join('');
}

// Function to initialize consumer event listeners
function initializeConsumerEvents() {
  console.log('Initializing consumer event listeners'); // Debug log
  
  // Initialize consumer purchase button (buy from retailer)
  const consumerPurchaseBtn = $('#consumerPurchaseBtn');
  console.log('consumerPurchaseBtn element found:', !!consumerPurchaseBtn); // Debug log
  
  if (consumerPurchaseBtn) {
    // Remove existing listener
    const newConsumerBtn = consumerPurchaseBtn.cloneNode(true);
    consumerPurchaseBtn.parentNode.replaceChild(newConsumerBtn, consumerPurchaseBtn);
    
    // Add fresh event listener
    $('#consumerPurchaseBtn').addEventListener('click', () => {
      console.log('Consumer purchase from retailer clicked'); // Debug log
      const selectedBatchId = $('#retailBatchSelect').value;
      const qty = Number($('#consumerQty').value);
      
      console.log('Consumer purchase - Selected batch:', selectedBatchId, 'Quantity:', qty); // Debug log
      
      if (!selectedBatchId) {
        alert('Please select a retail product');
        return;
      }
      if (!qty || qty <= 0) {
        alert('Please enter a valid quantity');
        return;
      }
      
      const d = store.read();
      const batch = d.inventory.find(x => x.id === selectedBatchId);
      console.log('Found batch for consumer purchase:', batch); // Debug log
      
      if (!batch) {
        alert('Product not found');
        return;
      }
      if (qty > batch.qty) {
        alert(`Only ${batch.qty}kg available`);
        return;
      }
      
      // Record consumer purchase
      d.consumerPurchases.push({
        batchId: batch.id,
        crop: batch.crop,
        grade: batch.grade,
        purchasedQty: qty,
        paidPrice: batch.retailPrice,
        directPurchase: false,
        timestamp: Date.now(),
        source: 'retail'
      });
      
      // Update batch quantity
      batch.qty -= qty;
      if (batch.qty <= 0) {
        batch.status = 'SOLD_OUT';
      }
      
      // Add consumer transaction to history
      batch.history.push({
        stage: 'CONSUMER',
        price: batch.retailPrice,
        quantity: qty,
        ts: Date.now()
      });
      
      store.write(d);
      alert(`Successfully purchased ${qty}kg of ${batch.crop} for ₹${(batch.retailPrice * qty).toFixed(2)}`);
      $('#consumerQty').value = '';
      renderConsumer();
    });
  }
  
  // Initialize direct purchase button (buy from farm)
  const directPurchaseBtn = $('#directPurchaseBtn');
  console.log('directPurchaseBtn element found:', !!directPurchaseBtn); // Debug log
  
  if (directPurchaseBtn) {
    // Remove existing listener
    const newDirectBtn = directPurchaseBtn.cloneNode(true);
    directPurchaseBtn.parentNode.replaceChild(newDirectBtn, directPurchaseBtn);
    
    // Add fresh event listener
    $('#directPurchaseBtn').addEventListener('click', () => {
      console.log('Consumer direct purchase from farm clicked'); // Debug log
      const selectedBatchId = $('#farmBatchSelect').value;
      const qty = Number($('#directQty').value);
      
      console.log('Direct purchase - Selected batch:', selectedBatchId, 'Quantity:', qty); // Debug log
      
      if (!selectedBatchId) {
        alert('Please select a farm product');
        return;
      }
      if (!qty || qty <= 0) {
        alert('Please enter a valid quantity');
        return;
      }
      
      const d = store.read();
      const batch = d.listings.find(x => x.id === selectedBatchId);
      console.log('Found batch for direct purchase:', batch); // Debug log
      
      if (!batch) {
        alert('Product not found');
        return;
      }
      if (qty > batch.qty) {
        alert(`Only ${batch.qty}kg available`);
        return;
      }
      
      // Calculate estimated retail price for savings calculation
      const estimatedRetailPrice = Math.round(batch.price * 1.6); // Estimate 60% markup
      
      // Record consumer purchase
      d.consumerPurchases.push({
        batchId: batch.id,
        crop: batch.crop,
        grade: batch.grade,
        purchasedQty: qty,
        paidPrice: batch.price,
        directPurchase: true,
        estimatedRetailPrice: estimatedRetailPrice,
        timestamp: Date.now(),
        source: 'farm'
      });
      
      // Update batch quantity
      batch.qty -= qty;
      if (batch.qty <= 0) {
        batch.status = 'SOLD_OUT';
      }
      
      // Add direct consumer transaction to history
      batch.history.push({
        stage: 'CONSUMER_DIRECT',
        price: batch.price,
        quantity: qty,
        ts: Date.now()
      });
      
      const savings = (estimatedRetailPrice - batch.price) * qty;
      
      store.write(d);
      alert(`Successfully purchased ${qty}kg of ${batch.crop} directly from farm for ₹${(batch.price * qty).toFixed(2)}\nEstimated savings: ₹${savings.toFixed(2)} vs retail price!`);
      $('#directQty').value = '';
      renderConsumer();
    });
  }
  
  // Initialize consumer lookup button
  const lookupConsumerBtn = $('#lookupConsumerBtn');
  if (lookupConsumerBtn) {
    // Remove existing listener
    const newLookupBtn = lookupConsumerBtn.cloneNode(true);
    lookupConsumerBtn.parentNode.replaceChild(newLookupBtn, lookupConsumerBtn);
    
    // Add fresh event listener
    $('#lookupConsumerBtn').addEventListener('click', () => {
      console.log('Consumer lookup clicked'); // Debug log
      const bid = $('#lookupBatchConsumer').value.trim();
      console.log('Consumer lookup - Batch ID:', bid); // Debug log
      
      if (!bid) {
        $('#lookupConsumerResult').innerHTML = '<p class="text-red-500">Please enter a Batch ID</p>';
        return;
      }
      
      // Call displayBatchInfo function to get batch information
      displayBatchInfo(bid, 'consumer');
      
      // Get the result from scanResults and copy to consumer result area
      setTimeout(() => {
        const scanResults = $('#scanResults');
        const consumerResult = $('#lookupConsumerResult');
        if (scanResults && consumerResult) {
          consumerResult.innerHTML = scanResults.innerHTML;
          console.log('Consumer lookup result updated'); // Debug log
        } else {
          console.error('Could not find result elements'); // Debug log
        }
      }, 100);
    });
  }
  
  console.log('Consumer event listeners initialized');
}

// Consumer purchase functionality is now handled by initializeConsumerEvents()


// Check for batch parameter in URL
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const batchParam = urlParams.get('batch');
  if (batchParam && window.location.hash === '#qr-scanner') {
    setTimeout(() => {
      displayBatchInfo(batchParam, 'consumer');
    }, 500);
  }
});