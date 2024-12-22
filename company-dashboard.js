// Check authentication
let companyData;
try {
    const storedData = sessionStorage.getItem('companyData');
    if (!storedData) {
        window.location.href = 'company-login.html';
    }
    companyData = JSON.parse(storedData);
    if (!companyData || typeof companyData !== 'object') {
        console.error('Invalid company data format');
        sessionStorage.removeItem('companyData');
        window.location.href = 'company-login.html';
    }
} catch (error) {
    console.error('Error parsing company data:', error);
    sessionStorage.removeItem('companyData');
    window.location.href = 'company-login.html';
}

// API URL configuration
const API_URL = 'http://localhost:3000';

// Utility function for retrying API calls
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            lastError = error;

            if (i < maxRetries - 1) {
                // Wait for a short time before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts. ${lastError.message}`);
}

// Check if API is available with retry
async function checkApiAvailability() {
    try {
        const response = await fetchWithRetry(API_URL);
        return true;
    } catch (error) {
        console.error('API Error:', error);
        alert('Error: Cannot connect to the server. Please make sure json-server is running on port 3000.');
        return false;
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        // Set company info in navbar
        document.getElementById('companyName').textContent = companyData.companyName || companyData.name;
        document.getElementById('companyZone').textContent = companyData.zone;

        // Initialize chemical type dropdowns with company's allowed chemicals
        const chemicalTypes = companyData.chemicals || [];
        const chemicalSelects = document.querySelectorAll('select[name="chemicalType"]');
        chemicalSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Chemical</option>' +
                chemicalTypes.map(type => `<option value="${type}">${type}</option>`).join('');
        });

        await Promise.all([
            updateStats(),
            loadManufacturingHistory(),
            loadSellerCompanies(),
            loadReceivedOrders(),
            loadTransportHistory(),
            loadTrackingData(),
            loadPurchaseHistory(),
            loadChemicalUsage()
        ]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Update dashboard statistics
async function updateStats() {
    try {
        const [manufacturing, orders] = await Promise.all([
            fetchWithRetry(`${API_URL}/manufacturing?companyId=${companyData.id}`).then(res => res.json()),
            fetchWithRetry(`${API_URL}/orders?buyerId=${companyData.id}&status=pending`).then(res => res.json())
        ]);

        // Match data.json manufacturing structure
        const totalManufacturedKG = manufacturing
            .filter(item => item.unit === 'KG')
            .reduce((sum, item) => sum + item.quantity, 0);

        const totalManufacturedL = manufacturing
            .filter(item => item.unit === 'L')
            .reduce((sum, item) => sum + item.quantity, 0);

        document.getElementById('totalManufactured').textContent =
            `${totalManufacturedKG.toFixed(2)} KG / ${totalManufacturedL.toFixed(2)} L of ${companyData.maxCapacity} KG`;

        // Calculate current stock considering chemical usage
        const usageResponse = await fetchWithRetry(`${API_URL}/chemicalUsage?companyId=${companyData.id}`);
        const usage = await usageResponse.json();

        const usedKG = usage
            .filter(item => item.unit === 'KG')
            .reduce((sum, item) => sum + item.amount, 0);

        const usedL = usage
            .filter(item => item.unit === 'L')
            .reduce((sum, item) => sum + item.amount, 0);

        document.getElementById('currentStock').textContent =
            `${(totalManufacturedKG - usedKG).toFixed(2)} KG / ${(totalManufacturedL - usedL).toFixed(2)} L`;

        document.getElementById('activeOrders').textContent = orders.length;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Show/hide sections
function showSection(sectionId) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';

    // Update active button
    document.querySelectorAll('.list-group-item').forEach(button => {
        button.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Manufacturing form submission
document.getElementById('manufacturingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const manufacturingData = {
        companyId: companyData.id,
        chemicalType: formData.get('chemicalType'),
        quantity: parseFloat(formData.get('quantity')),
        unit: formData.get('unit'),
        manufacturingDate: formData.get('manufacturingDate'),
        expiryDate: formData.get('expiryDate'),
        batchId: `BATCH-${Date.now().toString(36)}`,
        sold: false
    };

    try {
        const response = await fetchWithRetry(`${API_URL}/manufacturing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(manufacturingData)
        });

        if (response.ok) {
            alert('Manufacturing entry added successfully!');
            e.target.reset();
            await updateStats();
            await loadManufacturingHistory();
        }
    } catch (error) {
        console.error('Error adding manufacturing entry:', error);
        alert('Failed to add manufacturing entry: ' + error.message);
    }
});

// Load manufacturing history
async function loadManufacturingHistory() {
    try {
        const response = await fetchWithRetry(`${API_URL}/manufacturing?companyId=${companyData.id}`);
        const manufacturing = await response.json();

        const historyTableBody = document.getElementById('manufacturingHistory');
        if (!manufacturing || manufacturing.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No manufacturing records found</td></tr>';
            return;
        }

        historyTableBody.innerHTML = manufacturing.map(item => `
            <tr>
                <td>${item.batchId}</td>
                <td>${item.chemicalType}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td>${new Date(item.manufacturingDate).toLocaleString()}</td>
                <td>${new Date(item.expiryDate).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading manufacturing history:', error);
    }
}

// Load seller companies for purchasing
async function loadSellerCompanies() {
    try {
        const response = await fetchWithRetry(`${API_URL}/companies`);
        const companies = await response.json();

        const sellerSelect = document.querySelector('select[name="sellerCompany"]');
        sellerSelect.innerHTML = '<option value="">Select Company</option>' +
            companies
                .filter(company =>
                    company.id !== companyData.id &&
                    company.activities.includes('Selling'))
                .map(company => `
                    <option value="${company.id}">${company.companyName}</option>
                `).join('');
    } catch (error) {
        console.error('Error loading seller companies:', error);
    }
}

// Purchase form submission
document.getElementById('purchaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const purchaseData = {
        buyerId: companyData.id,
        chemicalType: formData.get('chemicalType'),
        quantity: Number(formData.get('quantity')),
        unit: formData.get('unit'),
        purpose: formData.get('purpose'),
        deliveryAddress: formData.get('deliveryAddress'),
        status: 'pending',
        orderId: generateId(),
        createdAt: new Date().toISOString()
    };

    try {
        await fetchWithRetry(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(purchaseData)
        });

        e.target.reset();
        await loadPurchaseHistory();
        alert('Purchase order placed successfully!');
    } catch (error) {
        console.error('Error placing purchase order:', error);
        alert('Failed to place purchase order. Please try again.');
    }
});

// Load received orders
async function loadReceivedOrders(status = 'all') {
    try {
        // Fetch orders where company is either buyer or seller
        const buyerOrders = await fetchWithRetry(`${API_URL}/orders?buyerId=${companyData.id}`).then(res => res.json());
        const sellerOrders = await fetchWithRetry(`${API_URL}/orders?sellerId=${companyData.id}`).then(res => res.json());

        // Combine orders and remove duplicates based on order ID
        const uniqueOrders = Array.from(new Map([
            ...buyerOrders,
            ...sellerOrders
        ].map(order => [order.orderId || order.id, order])).values());

        // Filter by status if specified
        const filteredOrders = status === 'all' ? uniqueOrders : uniqueOrders.filter(order => order.status === status);

        const tableBody = document.getElementById('receivedOrdersTableBody');
        if (filteredOrders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';
            return;
        }

        const ordersHtml = filteredOrders.map(order => {
            const statusBadgeClass = {
                'pending': 'bg-warning',
                'accepted': 'bg-info',
                'in_transit': 'bg-primary',
                'completed': 'bg-success',
                'rejected': 'bg-danger'
            }[order.status] || 'bg-secondary';

            let actionButtons = '';
            if (order.status === 'pending') {
                actionButtons = `
                    <button class="btn btn-sm btn-success me-1" onclick="processOrder('${order.id}', 'accept')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="processOrder('${order.id}', 'reject')">
                        <i class="fas fa-times"></i> Reject
                    </button>`;
            } else if (order.status === 'accepted') {
                actionButtons = `
                    <button class="btn btn-sm btn-primary" onclick="initiateTransport('${order.id}')">
                        <i class="fas fa-truck"></i> Initiate Transport
                    </button>`;
            }

            // Escape the order data for safe HTML insertion
            const orderData = encodeURIComponent(JSON.stringify(order));

            return `
                <tr>
                    <td>${order.orderId || order.id}</td>
                    <td>Company ${order.buyerId}</td>
                    <td>${order.chemicalType}</td>
                    <td>${order.quantity} ${order.unit}</td>
                    <td>
                        <span class="badge ${statusBadgeClass}">
                            ${order.status.toUpperCase().replace('_', ' ')}
                        </span>
                    </td>
                    <td>${actionButtons}</td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-secondary" onclick="generateQRCode(decodeURIComponent('${orderData}'))">
                                <i class="fas fa-qrcode"></i> Generate QR
                            </button>
                            <button class="btn btn-sm btn-info" onclick="downloadQRWithToken(JSON.parse(decodeURIComponent('${orderData}')))">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        tableBody.innerHTML = ordersHtml;
    } catch (error) {
        console.error('Error loading received orders:', error);
        const tableBody = document.getElementById('receivedOrdersTableBody');
        if (tableBody) {
            tableBody.innerHTML =
                '<tr><td colspan="7" class="text-center text-danger">Error loading orders: ' + error.message + '</td></tr>';
        }
    }
}

// Process order (accept/reject)
async function processOrder(orderId, action) {
    try {
        const updateData = {
            status: action === 'accept' ? 'accepted' : 'rejected',
            updatedAt: new Date().toISOString(),
            securityToken: action === 'accept' ? generateSecurityToken() : null,
            tokenTimestamp: action === 'accept' ? new Date().toISOString() : null
        };

        const response = await fetchWithRetry(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            throw new Error(`Failed to process order: ${response.statusText}`);
        }

        await loadReceivedOrders();
        alert(`Order ${action === 'accept' ? 'accepted' : 'rejected'} successfully`);
    } catch (error) {
        console.error('Error processing order:', error);
        alert('Failed to process order: ' + error.message);
    }
}

// Generate a random security token
function generateSecurityToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// Initiate transport for an order
async function initiateTransport(orderId) {
    try {
        // Get the order details
        const response = await fetch(`${API_URL}/orders/${orderId}`);
        if (!response.ok) throw new Error('Failed to fetch order details');
        const order = await response.json();

        // Set order ID in transport modal
        document.getElementById('modalOrderId').value = order.orderId || order.id;

        // Set current datetime as minimum for start time
        const startTimeInput = document.querySelector('input[name="startTime"]');
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        startTimeInput.min = now.toISOString().slice(0, 16);

        // Store order ID in the form for submission
        document.getElementById('transportForm').dataset.orderId = orderId;

        // Show the transport modal
        const modal = new bootstrap.Modal(document.getElementById('transportModal'));
        modal.show();
    } catch (error) {
        console.error('Error initiating transport:', error);
        alert('Failed to initiate transport: ' + error.message);
    }
}

// Filter orders by status
function filterOrders(status) {
    const buttons = document.querySelectorAll('#orderFilterButtons button');
    buttons.forEach(button => {
        if (button.getAttribute('data-status') === status) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    loadReceivedOrders(status);
}

// Initialize transport modal
let transportModal;
let qrCodeModal;
document.addEventListener('DOMContentLoaded', () => {
    transportModal = new bootstrap.Modal(document.getElementById('transportModal'));
    qrCodeModal = new bootstrap.Modal(document.getElementById('qrCodeModal'), {
        backdrop: 'static',  // Prevent closing when clicking outside
        keyboard: false      // Prevent closing with keyboard
    });
});

// Initialize transport modal with proper focus management
document.addEventListener('DOMContentLoaded', () => {
    const transportModalEl = document.getElementById('transportModal');
    transportModal = new bootstrap.Modal(transportModalEl, {
        backdrop: 'static',
        keyboard: true,
        focus: true
    });

    // Handle modal focus management
    transportModalEl.addEventListener('shown.bs.modal', function () {
        // Set focus to first input when modal opens
        const firstInput = this.querySelector('input:not([readonly]), select, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    });

    transportModalEl.addEventListener('hide.bs.modal', function () {
        // Return focus to trigger element when modal closes
        const triggerElement = document.querySelector('[data-bs-target="#transportModal"]') ||
            document.querySelector('[href="#transportModal"]');
        if (triggerElement) {
            triggerElement.focus();
        }
    });

    // Initialize QR code modal
    qrCodeModal = new bootstrap.Modal(document.getElementById('qrCodeModal'), {
        backdrop: 'static',
        keyboard: true,
        focus: true
    });
});

// Handle transport form submission
document.getElementById('transportForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const orderId = this.dataset.orderId;
    const formData = new FormData(this);

    try {
        // Create transport record
        const transportData = {
            orderId: orderId,
            vehicleNumber: formData.get('vehicleNumber'),
            driverName: formData.get('driverName'),
            driverContact: formData.get('driverContact'),
            routeDetails: formData.get('routeDetails'),
            status: 'in_transit',
            startTime: formData.get('startTime'),
            transportId: generateId()
        };

        // Save transport record
        const transportResponse = await fetchWithRetry(`${API_URL}/transport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transportData)
        });

        if (!transportResponse.ok) {
            throw new Error('Failed to save transport details');
        }

        // Update order status
        const orderResponse = await fetchWithRetry(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'in_transit',
                transportId: transportData.transportId,
                transportInitiated: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            })
        });

        if (!orderResponse.ok) {
            throw new Error('Failed to update order status');
        }

        // Hide modal and reset form
        bootstrap.Modal.getInstance(document.getElementById('transportModal')).hide();
        this.reset();

        // Refresh the displayed data
        await Promise.all([
            loadReceivedOrders(),
            loadTransportHistory(),
            loadTrackingData()
        ]);

        alert('Transport initiated successfully');
    } catch (error) {
        console.error('Error submitting transport details:', error);
        alert('Failed to submit transport details: ' + error.message);
    }
});

// Load transport history
async function loadTransportHistory() {
    try {
        const response = await fetchWithRetry(`${API_URL}/transport`);
        if (!response.ok) {
            throw new Error(`Failed to fetch transport history: ${response.statusText}`);
        }
        const transports = await response.json();

        const tableBody = document.getElementById('transportTableBody');
        if (!transports || transports.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No transport records found</td></tr>';
            return;
        }

        const transportHtml = transports.map(transport => {
            const statusBadgeClass = getStatusBadgeClass(transport.status);

            return `
                <tr>
                    <td>${transport.transportId}</td>
                    <td>${transport.orderId}</td>
                    <td>${transport.vehicleNumber}</td>
                    <td>
                        <span class="badge ${statusBadgeClass}">
                            ${transport.status.toUpperCase().replace('_', ' ')}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewTransportDetails('${transport.transportId}')">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                    </td>
                </tr>`;
        }).join('');

        tableBody.innerHTML = transportHtml;
    } catch (error) {
        console.error('Error loading transport history:', error);
        document.getElementById('transportTableBody').innerHTML =
            '<tr><td colspan="5" class="text-center text-danger">Error loading transport history</td></tr>';
    }
}

// View transport details
async function viewTransportDetails(transportId) {
    try {
        // Get transport details
        const transportResponse = await fetchWithRetry(`${API_URL}/transport/${transportId}`);
        if (!transportResponse.ok) {
            throw new Error(`Failed to fetch transport details: ${transportResponse.statusText}`);
        }
        const transport = await transportResponse.json();

        if (!transport) {
            throw new Error('Transport details not found');
        }

        // Get associated order details
        const orderResponse = await fetchWithRetry(`${API_URL}/orders/${transport.orderId}`);
        if (!orderResponse.ok) {
            throw new Error(`Failed to fetch order details: ${orderResponse.statusText}`);
        }
        const order = await orderResponse.json();

        if (!order) {
            throw new Error('Order details not found');
        }

        const modalContent = `
            <div class="modal-header">
                <h5 class="modal-title">Transport Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="row">
                    <div class="col-md-6">
                        <h6>Order Information</h6>
                        <p><strong>Order ID:</strong> ${order.orderId}</p>
                        <p><strong>Chemical:</strong> ${order.chemicalType}</p>
                        <p><strong>Quantity:</strong> ${order.quantity}</p>
                        <p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>
                        <p><strong>Purpose:</strong> ${order.purpose}</p>
                    </div>
                    <div class="col-md-6">
                        <h6>Transport Information</h6>
                        <p><strong>Transport ID:</strong> ${transport.transportId}</p>
                        <p><strong>Vehicle Number:</strong> ${transport.vehicleNumber}</p>
                        <p><strong>Driver Name:</strong> ${transport.driverName}</p>
                        <p><strong>Driver Contact:</strong> ${transport.driverContact}</p>
                        <p><strong>Route Details:</strong> ${transport.routeDetails}</p>
                        <p><strong>Start Time:</strong> ${new Date(transport.startTime).toLocaleString()}</p>
                        <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(transport.status)}">${transport.status.toUpperCase().replace('_', ' ')}</span></p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        `;

        // Create or update modal
        let modalElement = document.getElementById('transportDetailsModal');
        if (!modalElement) {
            modalElement = document.createElement('div');
            modalElement.id = 'transportDetailsModal';
            modalElement.className = 'modal fade';
            modalElement.setAttribute('tabindex', '-1');
            modalElement.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        ${modalContent}
                    </div>
                </div>
            `;
            document.body.appendChild(modalElement);
        } else {
            modalElement.querySelector('.modal-content').innerHTML = modalContent;
        }

        // Show modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error('Error loading transport details:', error);
        alert('Failed to load transport details: ' + error.message);
    }
}

// Generate QR Code for order
function generateQRCode(orderData) {
    try {
        // Parse the order if it's a string
        const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
        console.log('Order data:', order); // Debug log

        // Generate security token if not present
        if (!order.securityToken) {
            order.securityToken = generateSecurityToken();
            order.tokenTimestamp = new Date().toISOString();
        }

        // Create QR string
        const qrString = `${order.orderId}|${order.securityToken}|${order.tokenTimestamp}`;
        console.log('QR string:', qrString); // Debug log

        // Clear previous QR code
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';

        // Update modal content
        document.getElementById('qrOrderId').textContent = order.orderId;
        document.getElementById('qrSecurityToken').textContent = order.securityToken;
        document.getElementById('qrTimestamp').textContent = new Date(order.tokenTimestamp).toLocaleString();

        // Create new QR code
        const qr = new QRCode(qrContainer, {
            text: qrString,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Save token to server
        saveSecurityToken(order.orderId, order.securityToken, order.tokenTimestamp);

        // Show modal using Bootstrap 5
        const modal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
        modal.show();

        console.log('QR code generated successfully'); // Debug log
    } catch (error) {
        console.error('Error generating QR code:', error);
        alert('Failed to generate QR code: ' + error.message);
    }
}

// Generate a random security token
function generateSecurityToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// Save security token to server
async function saveSecurityToken(orderId, token, timestamp) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                securityToken: token,
                tokenTimestamp: timestamp
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save security token');
        }

        console.log('Security token saved successfully'); // Debug log
    } catch (error) {
        console.error('Error saving security token:', error);
    }
}

// Download QR Code
function downloadQRCode() {
    try {
        const canvas = document.querySelector('#qrcode canvas');
        const orderId = document.getElementById('qrOrderId').textContent;

        if (!canvas) {
            throw new Error('QR code canvas not found');
        }

        const link = document.createElement('a');
        link.download = `QR_Code_${orderId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        console.log('QR code downloaded successfully'); // Debug log
    } catch (error) {
        console.error('Error downloading QR code:', error);
        alert('Failed to download QR code: ' + error.message);
    }
}

// Download QR Code with token information
async function downloadQRWithToken(order) {
    try {
        // Generate security token if not present
        if (!order.securityToken) {
            order.securityToken = generateSecurityToken();
            order.tokenTimestamp = new Date().toISOString();
            await saveSecurityToken(order.orderId, order.securityToken, order.tokenTimestamp);
        }

        // Create a temporary container for generating the QR code
        const tempContainer = document.createElement('div');
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);

        // Generate QR code in temp container
        const qrString = `${order.orderId}|${order.securityToken}|${order.tokenTimestamp}`;
        new QRCode(tempContainer, {
            text: qrString,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Wait for QR code to generate
        await new Promise(resolve => setTimeout(resolve, 100));

        // Create a canvas to combine QR code and text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = 600;
        canvas.height = 800;

        // Fill background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Add title
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Chemical Order QR Code', canvas.width / 2, 50);

        // Get QR code image
        const qrCanvas = tempContainer.querySelector('canvas');
        ctx.drawImage(qrCanvas, (canvas.width - 256) / 2, 100);

        // Add order details
        ctx.font = 'bold 18px Arial';
        let y = 400;
        ctx.fillText(`Order ID: ${order.orderId}`, canvas.width / 2, y);

        ctx.font = '16px Arial';
        y += 40;
        ctx.fillText(`Security Token: ${order.securityToken}`, canvas.width / 2, y);
        y += 30;
        ctx.fillText(`Generated: ${new Date(order.tokenTimestamp).toLocaleString()}`, canvas.width / 2, y);

        // Add company details
        y += 50;
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`Company Details`, canvas.width / 2, y);
        ctx.font = '16px Arial';
        y += 30;
        ctx.fillText(`Buyer ID: ${order.buyerId}`, canvas.width / 2, y);
        y += 30;
        ctx.fillText(`Chemical Type: ${order.chemicalType}`, canvas.width / 2, y);
        y += 30;
        ctx.fillText(`Quantity: ${order.quantity} ${order.unit}`, canvas.width / 2, y);

        // Add footer
        ctx.font = '14px Arial';
        ctx.fillText('Generated by Chemical Tracking System', canvas.width / 2, canvas.height - 30);

        // Convert to image and download
        const link = document.createElement('a');
        link.download = `Chemical_Order_${order.orderId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Clean up
        document.body.removeChild(tempContainer);
    } catch (error) {
        console.error('Error downloading QR code with token:', error);
        alert('Failed to download QR code with token: ' + error.message);
    }
}

// Load available chemicals and usage history
async function loadChemicalUsage() {
    try {
        // Get company's manufacturing records instead of inventory
        const manufacturingResponse = await fetchWithRetry(`${API_URL}/manufacturing?companyId=${companyData.id}`);
        if (!manufacturingResponse.ok) {
            throw new Error(`Failed to fetch manufacturing data: ${manufacturingResponse.statusText}`);
        }
        const manufacturing = await manufacturingResponse.json();

        // Get company's completed orders (purchases)
        const ordersResponse = await fetchWithRetry(`${API_URL}/orders?buyerId=${companyData.id}&status=completed`);
        if (!ordersResponse.ok) {
            throw new Error(`Failed to fetch completed orders: ${ordersResponse.statusText}`);
        }
        const completedOrders = await ordersResponse.json();

        // Get usage history
        const usageResponse = await fetchWithRetry(`${API_URL}/chemicalUsage?companyId=${companyData.id}`);
        if (!usageResponse.ok) {
            throw new Error(`Failed to fetch chemical usage data: ${usageResponse.statusText}`);
        }
        const usageHistory = await usageResponse.json();

        // Combine manufacturing and purchases
        const batches = [
            ...manufacturing.map(item => ({
                id: item.batchId,
                chemical: item.chemicalType,
                quantity: item.quantity,
                unit: item.unit,
                source: 'Manufacturing',
                date: item.manufacturingDate
            })),
            ...completedOrders.map(order => ({
                id: order.orderId,
                chemical: order.chemicalType,
                quantity: order.quantity,
                unit: order.unit || 'KG',
                source: 'Purchased',
                date: order.createdAt
            }))
        ];

        // Calculate remaining quantities
        batches.forEach(batch => {
            const used = usageHistory
                .filter(usage => usage.batchId === batch.id)
                .reduce((total, usage) => total + usage.amount, 0);
            batch.used = used;
            batch.remaining = batch.quantity - used;
        });

        // Update available chemicals display
        const availableChemicals = document.getElementById('availableChemicals');
        if (!availableChemicals) {
            console.error('availableChemicals element not found');
            return;
        }

        if (batches.length === 0) {
            availableChemicals.innerHTML = '<p class="text-muted">No chemicals available</p>';
        } else {
            availableChemicals.innerHTML = batches
                .filter(batch => batch.remaining > 0)
                .map(batch => `
                    <div class="mb-2 p-2 border rounded">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${batch.chemical}</strong> (${batch.source})
                                <br>
                                <small class="text-muted">Batch: ${batch.id}</small>
                            </div>
                            <div class="text-end">
                                <div>${batch.remaining} ${batch.unit} remaining</div>
                                <small class="text-muted">of ${batch.quantity} ${batch.unit}</small>
                            </div>
                        </div>
                        <div class="progress mt-2" style="height: 5px;">
                            <div class="progress-bar" role="progressbar" 
                                style="width: ${(batch.remaining / batch.quantity) * 100}%">
                            </div>
                        </div>
                    </div>
                `).join('');
        }

        // Update batch selection dropdown
        const batchSelect = document.getElementById('chemicalBatch');
        if (!batchSelect) {
            console.error('chemicalBatch element not found');
            return;
        }

        batchSelect.innerHTML = '<option value="">Select batch</option>' +
            batches
                .filter(batch => batch.remaining > 0)
                .map(batch => `
                    <option value="${batch.id}" data-unit="${batch.unit}" data-remaining="${batch.remaining}">
                        ${batch.chemical} - ${batch.id} (${batch.remaining} ${batch.unit} remaining)
                    </option>
                `).join('');

        // Update usage history table
        const usageTable = document.getElementById('usageHistoryTable');
        if (!usageTable) {
            console.error('usageHistoryTable element not found');
            return;
        }

        if (usageHistory.length === 0) {
            usageTable.innerHTML = '<tr><td colspan="6" class="text-center">No usage records found</td></tr>';
        } else {
            usageTable.innerHTML = usageHistory
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map(usage => {
                    const batch = batches.find(b => b.id === usage.batchId);
                    return `
                        <tr>
                            <td>${new Date(usage.timestamp).toLocaleString()}</td>
                            <td>${usage.batchId}</td>
                            <td>${batch?.chemical || 'Unknown'}</td>
                            <td>${usage.amount} ${usage.unit}</td>
                            <td>${batch?.remaining || 0} ${usage.unit}</td>
                            <td>${usage.purpose}</td>
                        </tr>
                    `;
                }).join('');
        }

        // Add event listener for usage form
        const usageForm = document.getElementById('usageForm');
        if (!usageForm) {
            console.error('usageForm element not found');
            return;
        }

        // Remove existing listener if any
        const oldListener = usageForm.onsubmit;
        if (oldListener) {
            usageForm.removeEventListener('submit', oldListener);
        }

        // Add new submit listener
        usageForm.onsubmit = async (e) => {
            e.preventDefault();
            const batchId = document.getElementById('chemicalBatch').value;
            const amount = parseFloat(document.getElementById('usageAmount').value);
            const purpose = document.getElementById('usagePurpose').value;
            const batch = batches.find(b => b.id === batchId);

            if (!batch) {
                alert('Please select a valid batch');
                return;
            }

            if (amount > batch.remaining) {
                alert('Amount exceeds available quantity');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/chemicalUsage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        companyId: companyData.id,
                        batchId: batchId,
                        amount: amount,
                        unit: batch.unit,
                        purpose: purpose,
                        timestamp: new Date().toISOString()
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to record usage: ${response.statusText}`);
                }

                alert('Chemical usage recorded successfully');
                usageForm.reset();
                await loadChemicalUsage();
            } catch (error) {
                console.error('Error recording usage:', error);
                alert('Failed to record chemical usage: ' + error.message);
            }
        };

    } catch (error) {
        console.error('Error loading chemical usage:', error);

        // Update error handling to be more specific
        if (error.message.includes('Not Found')) {
            alert('No chemical usage data found. This may be your first time using the system.');
            // Initialize empty displays
            document.getElementById('availableChemicals').innerHTML = '<p class="text-muted">No chemicals available</p>';
            document.getElementById('chemicalBatch').innerHTML = '<option value="">Select batch</option>';
            document.getElementById('usageHistoryTable').innerHTML = '<tr><td colspan="6" class="text-center">No usage records found</td></tr>';
        } else {
            alert('Error loading chemical usage data: ' + error.message);
        }
    }
}

// Update amount input max value when batch is selected
document.getElementById('chemicalBatch')?.addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    const remaining = selectedOption.dataset.remaining;
    const unit = selectedOption.dataset.unit;

    const amountInput = document.getElementById('usageAmount');
    const unitSpan = document.getElementById('usageUnit');

    if (amountInput && unitSpan) {
        amountInput.max = remaining;
        unitSpan.textContent = unit || 'KG';
    }
});

// Load tracking data
async function loadTrackingData() {
    try {
        // Get all in_transit orders
        const ordersResponse = await fetchWithRetry(`${API_URL}/orders?buyerId=${companyData.id}&status=in_transit`);
        const orders = await ordersResponse.json();

        if (orders.length === 0) {
            document.getElementById('trackingData').innerHTML = '<tr><td colspan="8" class="text-center">No active shipments</td></tr>';
            return;
        }

        // Get all transports in one request
        const transportsResponse = await fetchWithRetry(`${API_URL}/transport`);
        const transports = await transportsResponse.json();

        const trackingHtml = orders.map(order => {
            const transport = transports.find(t => t.orderId === order.orderId || t.orderId === order.id);

            if (transport) {
                return `
                    <tr>
                        <td>${order.orderId || order.id}</td>
                        <td>${transport.transportId}</td>
                        <td>${transport.vehicleNumber}</td>
                        <td>
                            <strong>Driver:</strong> ${transport.driverName}<br>
                            <strong>Contact:</strong> ${transport.driverContact}
                        </td>
                        <td>${transport.routeDetails}</td>
                        <td>${new Date(transport.startTime).toLocaleString()}</td>
                        <td>
                            <span class="badge ${getStatusBadgeClass(order.status)}">
                                ${order.status.toUpperCase().replace('_', ' ')}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="viewTransportDetails('${transport.transportId}')">
                                <i class="fas fa-info-circle"></i> Details
                            </button>
                        </td>
                    </tr>`;
            } else {
                return `
                    <tr class="table-warning">
                        <td>${order.orderId || order.id}</td>
                        <td colspan="7" class="text-center">
                            <i class="fas fa-exclamation-triangle text-warning me-2"></i>
                            Transport details pending initialization
                        </td>
                    </tr>`;
            }
        }).join('');

        document.getElementById('trackingData').innerHTML = trackingHtml;
    } catch (error) {
        console.error('Error loading tracking data:', error);
        document.getElementById('trackingData').innerHTML =
            '<tr><td colspan="8" class="text-center text-danger">Error loading tracking data</td></tr>';
    }
}

// Load purchase history
async function loadPurchaseHistory(status = 'all') {
    try {
        const response = await fetchWithRetry(`${API_URL}/orders?buyerId=${companyData.id}`);
        const purchases = await response.json();

        const filteredPurchases = status === 'all'
            ? purchases
            : purchases.filter(p => p.status === status);

        const historyHtml = filteredPurchases.map(purchase => {
            const statusBadgeClass = {
                'pending': 'bg-warning',
                'accepted': 'bg-info',
                'in_transit': 'bg-primary',
                'completed': 'bg-success',
                'rejected': 'bg-danger'
            }[purchase.status] || 'bg-secondary';

            let actions = '';
            if (purchase.status === 'pending') {
                actions = `<button class="btn btn-sm btn-danger" onclick="cancelPurchase('${purchase.id}')">
                            <i class="fas fa-times"></i> Cancel
                          </button>`;
            } else if (purchase.status === 'in_transit') {
                actions = `<button class="btn btn-sm btn-info" onclick="viewTransportDetails('${purchase.transportId}')">
                            <i class="fas fa-truck"></i> Track
                          </button>`;
            }

            return `
                <tr>
                    <td>${purchase.orderId || '-'}</td>
                    <td>${new Date(purchase.createdAt).toLocaleString()}</td>
                    <td>${purchase.chemicalType}</td>
                    <td>${purchase.quantity}</td>
                    <td>${purchase.purpose}</td>
                    <td>${purchase.deliveryAddress}</td>
                    <td><span class="badge ${statusBadgeClass}">${purchase.status.toUpperCase().replace('_', ' ')}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('purchaseHistory').innerHTML = historyHtml;
    } catch (error) {
        console.error('Error loading purchase history:', error);
    }
}

// Filter purchases by status
function filterPurchases(status) {
    loadPurchaseHistory(status);
}

// Cancel a pending purchase
async function cancelPurchase(purchaseId) {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;

    try {
        await fetchWithRetry(`${API_URL}/orders/${purchaseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'cancelled',
                updatedAt: new Date().toISOString()
            })
        });

        await loadPurchaseHistory();
    } catch (error) {
        console.error('Error cancelling purchase:', error);
        alert('Failed to cancel purchase. Please try again.');
    }
}

// Helper function to generate unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Logout function
function logout() {
    sessionStorage.removeItem('companyData');
    window.location.href = 'company-login.html';
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDashboard();
    await loadManufacturingHistory();
    await loadChemicalUsage();
});

// Helper function to get status badge class
function getStatusBadgeClass(status) {
    return {
        'in_transit': 'bg-primary',
        'completed': 'bg-success',
        'delayed': 'bg-warning',
        'cancelled': 'bg-danger'
    }[status] || 'bg-secondary';
}
