// Utility selectors
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Local storage wrapper
const store = {
  key: 'agri_chain_demo_v4_qr',
  read() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || {
        listings: [], purchases: [], inventory: [], iot: {}, feedback: []
      };
    } catch {
      return { listings: [], purchases: [], inventory: [], iot: {}, feedback: [] };
    }
  },
  write(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  init() {
    const d = this.read();
    ['listings','purchases','inventory','feedback'].forEach(k => {
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
  
  if (target === '#farmer') renderFarmer();
  if (target === '#distributor') renderDistributor();
  if (target === '#retailer') renderRetailer();
  if (target === '#home') refreshStats();
}

window.addEventListener('hashchange', () => showPage(location.hash));
window.addEventListener('DOMContentLoaded', () => {
  showPage(location.hash || '#home');
  refreshStats();
});

// Mobile menu toggle
$('#mobileMenuBtn').addEventListener('click', () => {
  $('#mobileMenu').classList.toggle('hidden');
});

// -- QR Code Generation --
function generateQRCode(batchId) {
  const canvas = document.createElement('canvas');
  const qrData = `${window.location.origin}${window.location.pathname}#qr-scanner?batch=${batchId}`;
  
  return new Promise((resolve) => {
    QRCode.toCanvas(canvas, qrData, {
      width: 120,
      height: 120,
      margin: 2
    }, (error) => {
      if (error) {
        console.error('QR generation error:', error);
        resolve(null);
      } else {
        resolve(canvas.toDataURL());
      }
    });
  });
}

function showQRModal(batchId) {
  $('#qrBatchId').textContent = `Batch ID: ${batchId}`;
  $('#qrModal').classList.remove('hidden');
  $('#qrModal').classList.add('flex');
  
  generateQRCode(batchId).then(dataUrl => {
    if (dataUrl) {
      $('#qrCodeDisplay').innerHTML = `<img src="${dataUrl}" alt="QR Code for ${batchId}" class="mx-auto">`;
    } else {
      $('#qrCodeDisplay').innerHTML = '<p class="text-red-500">Failed to generate QR code</p>';
    }
  });
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
      const cameraId = devices[0].id;
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

// -- Farmer Logic --
$('#farmerForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const d = store.read();
  const id = uid();
  const listing = {
    id,
    crop: f.get('crop'),
    grade: f.get('grade'),
    qty: Number(f.get('qty')),
    price: Number(f.get('price')),
    notes: f.get('notes') || '',
    farmer: 'Farmer #' + (new Set(d.listings.map(x => x.farmer)).size + 1),
    status: 'AVAILABLE',
    history: [{ stage: 'FARMER', price: Number(f.get('price')), ts: Date.now() }]
  };
  d.listings.push(listing);
  store.write(d);
  alert('Listing saved with BatchID ' + id + '\nQR code generated!');
  renderFarmer();
  e.target.reset();
});

$('#seedData').addEventListener('click', () => {
  const samples = [ 
    { crop:'Wheat',grade:'A',qty:500,price:22,notes:'Organic certified' },
    { crop:'Rice',grade:'B',qty:800,price:28,notes:'Premium basmati' },
    { crop:'Tomato',grade:'A',qty:300,price:18,notes:'Greenhouse grown' }
  ];
  const d = store.read();
  samples.forEach(s => {
    const id = uid();
    d.listings.push({ 
      ...s, 
      id, 
      farmer:'Demo Farmer', 
      status:'AVAILABLE', 
      history:[{stage:'FARMER',price:s.price,ts:Date.now()}] 
    });
  });
  store.write(d);
  alert('Seeded 3 demo listings with QR codes.');
  renderFarmer();
  refreshStats();
});

function renderFarmer() {
  const d = store.read();
  const rows = d.listings.map(x => `
    <tr class="border-t">
      <td class="py-2">${x.id}</td>
      <td>${x.crop}</td>
      <td>${x.grade}</td>
      <td>${x.qty} kg</td>
      <td>₹${x.price}/kg</td>
      <td><span class="${x.status==='AVAILABLE'?'text-emerald-600':'text-gray-600'}">${x.status}</span></td>
      <td><button onclick="showQRModal('${x.id}')" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">Show QR</button></td>
    </tr>`).join('');
  $('#farmerTable').innerHTML = rows;
}

$('#lookupFarmerBtn').addEventListener('click', () => {
  const bid = $('#lookupBatchFarmer').value.trim();
  displayBatchInfo(bid, 'farmer');
  const container = $('#lookupFarmerResult');
  container.innerHTML = $('#scanResults').innerHTML;
});

// -- Distributor Logic --
function renderDistributor() {
  const d = store.read();
  const avail = d.listings.filter(x => x.status === 'AVAILABLE');
  $('#marketTable').innerHTML = avail.map(x => `
    <tr class="border-t">
      <td class="py-2">${x.id}</td><td>${x.crop}</td><td>${x.grade}</td><td>${x.qty} kg</td>
      <td>₹${x.price}/kg</td>
      <td><button data-id="${x.id}" class="px-3 py-1 border rounded-xl buy-btn hover:bg-emerald-50">Buy</button></td>
    </tr>`).join('');
  
  // Use $$ instead of $
  $$('.buy-btn').forEach(b => b.addEventListener('click', () => purchaseLot(b.getAttribute('data-id'))));
  
  renderPurchased();
}
  


function purchaseLot(id) {
  const d = store.read();
  const item = d.listings.find(x => x.id === id);
  if (!item) return;
  const distPrice = Math.round(item.price * (1 + (10 + Math.random() * 10) / 100));
  item.status = 'PURCHASED';
  item.history.push({ stage: 'DISTRIBUTOR', price: distPrice, ts: Date.now() });
  d.purchases.push({ id: item.id, crop: item.crop, qty: item.qty, farmerPrice: item.price, distributorPrice: distPrice });
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
    status: 'IN_TRANSIT'
  });
  store.write(d);
  renderDistributor();
  alert('Purchased ' + id + ' at ₹' + distPrice + '/kg');
  // Auto-generate some IoT data
  setTimeout(() => $('#genIot').click(), 1000);
}

function renderPurchased() {
  const d = store.read();
  $('#purchasedList').innerHTML = d.purchases.map(p => `<li>${p.id} • ${p.crop} • ₹${p.distributorPrice}/kg • <span class="text-green-600">Tracking Active</span></li>`).join('');
}

$('#genIot').addEventListener('click', () => {
  const d = store.read();
  const locations = [
    '28.6139, 77.2090', // Delhi
    '28.7041, 77.1025', // Gurgaon
    '28.5355, 77.3910', // Noida
    '28.4595, 77.0266'  // Manesar
  ];
  const v = {
    temp: (15 + Math.random() * 15).toFixed(1) + '°C',
    hum: (50 + Math.random() * 30).toFixed(0) + '%',
    gps: locations[Math.floor(Math.random() * locations.length)],
    timestamp: Date.now()
  };
  d.iot = v;
  store.write(d);
  $('#iotTemp').textContent = v.temp;
  $('#iotHum').textContent = v.hum;
  $('#iotGps').textContent = v.gps;
  $('#iotTime').textContent = new Date().toLocaleTimeString();
});

// -- Retailer Logic --
function renderRetailer() {
  const d = store.read();
  $('#retailTable').innerHTML = d.inventory.map(x => `
    <tr class="border-t">
      <td class="py-2">${x.id}</td><td>${x.crop}</td><td>${x.qty} kg</td>
      <td>₹${x.farmerPrice}</td><td>₹${x.distributorPrice}</td>
      <td>${x.retailPrice ? '₹'+x.retailPrice : '<span class="text-gray-400">—</span>'}</td>
      <td>${x.margin ? x.margin+'%' : '<span class="text-gray-400">—</span>'}</td>
    </tr>`).join('');
}

$('#calcBtn').addEventListener('click', () => {
  const base = Number($('#calcBase').value) || 0;
  const dPct = Number($('#calcDist').value) || 0;
  const rPct = Number($('#calcRetail').value) || 0;
  if (base <= 0) return $('#calcOut').textContent = 'Enter valid base price';
  const dist = Math.round(base * (1 + dPct / 100));
  const retail = Math.round(dist * (1 + rPct / 100));
  const margin = Math.round(((retail - base) / base) * 100);
  $('#calcOut').textContent = `Distributor: ₹${dist}/kg • Retail: ₹${retail}/kg • Total Margin: ${margin}%`;

  const d = store.read();
  d.inventory = d.inventory.map(x => {
    if (!x.history) x.history = [];
    x.history.push({ stage: 'RETAILER', price: retail, ts: Date.now() });
    return { ...x, retailPrice: retail, margin, status: 'RETAIL' };
  });
  store.write(d);
  renderRetailer();
});

// -- Consumer Lookup --
$('#lookupConsumerBtn').addEventListener('click', () => {
  const bid = $('#lookupBatchConsumer').value.trim();
  displayBatchInfo(bid, 'consumer');
  const container = $('#lookupConsumerResult');
  container.innerHTML = $('#scanResults').innerHTML;
});

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