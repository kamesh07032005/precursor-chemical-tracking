// Constants
const API_URL = 'http://localhost:3000';

// Initialize QR Scanner with maximum compatibility settings
let html5QrcodeScanner = new Html5QrcodeScanner(
    "reader", 
    { 
        fps: 2, // Lower FPS for better processing
        qrbox: { width: 400, height: 400 },
        aspectRatio: 1.0,
        disableFlip: false, // Allow both normal and mirrored QR codes
        verbose: true,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
        }
    }
);

// Handle successful QR scan
async function onScanSuccess(decodedText) {
    try {
        // Parse the string format with timestamp
        const [orderId, token, timestamp] = decodedText.split('|');
        
        if (!orderId || !token || !timestamp) {
            throw new Error('Invalid QR code format');
        }

        // Check if token has expired (24 hours)
        const tokenDate = new Date(timestamp);
        const now = new Date();
        if (now - tokenDate > 24 * 60 * 60 * 1000) {
            throw new Error('Security token has expired');
        }
        
        // Fetch complete order details
        const response = await fetch(`${API_URL}/orders?orderId=${orderId}`);
        const orders = await response.json();
        const order = orders[0];

        if (!order) {
            throw new Error('Order not found');
        }

        // Verify token matches server record
        if (!order.securityToken || order.securityToken !== token) {
            throw new Error('Invalid security token');
        }

        // Store the expected security token and timestamp
        const tokenData = document.getElementById('securityToken').dataset;
        tokenData.expectedToken = token;
        tokenData.timestamp = timestamp;

        // Display order details
        displayOrderDetails(order);
        
        // Stop scanner after successful scan
        html5QrcodeScanner.clear();
        
        // Show verification form
        document.getElementById('verificationForm').style.display = 'block';
    } catch (error) {
        console.error('Error processing QR code:', error);
        alert(error.message || 'Invalid QR code or unable to fetch order details. Please try again.');
        // Don't stop scanner on error
    }
}

// Display order details in the UI
function displayOrderDetails(order) {
    const orderDetails = document.getElementById('orderDetails');
    
    // Set text content
    document.getElementById('orderId').textContent = order.orderId;
    document.getElementById('chemical').textContent = order.chemicalType;
    document.getElementById('quantity').textContent = `${order.quantity} ${order.unit}`;
    document.getElementById('buyerId').textContent = order.buyerId;
    
    // Set status badge
    const statusBadge = document.getElementById('status');
    const statusClass = {
        'pending': 'bg-warning',
        'accepted': 'bg-info',
        'in_transit': 'bg-primary',
        'completed': 'bg-success',
        'rejected': 'bg-danger'
    }[order.status] || 'bg-secondary';
    
    statusBadge.className = `badge status-badge ${statusClass}`;
    statusBadge.textContent = order.status.toUpperCase().replace('_', ' ');
    
    // Show order details
    orderDetails.style.display = 'block';
}

// Handle delivery form submission
document.getElementById('deliveryForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const orderId = document.getElementById('orderId').textContent;
    const securityToken = document.getElementById('securityToken').value;
    const tokenData = document.getElementById('securityToken').dataset;
    const remarks = document.getElementById('remarks').value;

    try {
        // Verify security token hasn't expired
        const tokenDate = new Date(tokenData.timestamp);
        const now = new Date();
        if (now - tokenDate > 24 * 60 * 60 * 1000) {
            throw new Error('Security token has expired');
        }

        // Verify security token matches
        if (securityToken !== tokenData.expectedToken) {
            throw new Error('Invalid security token');
        }

        // Get order details
        const response = await fetch(`${API_URL}/orders?orderId=${orderId}`);
        const orders = await response.json();
        const order = orders[0];

        if (!order) {
            throw new Error('Order not found');
        }

        // Update order status
        const updateResponse = await fetch(`${API_URL}/orders/${order.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: 'completed',
                deliveryRemarks: remarks,
                deliveryTimestamp: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update order status');
        }

        // Show success message
        alert('Delivery verified successfully!');
        location.reload();
    } catch (error) {
        console.error('Error verifying delivery:', error);
        alert(error.message || 'Failed to verify delivery. Please try again.');
    }
});

// Initialize scanner
html5QrcodeScanner.render(onScanSuccess, (error) => {
    // Ignore errors to prevent console spam
    if (error?.message?.includes("No MultiFormat Readers")) {
        return; // Suppress this specific error
    }
    console.warn('QR Scan error:', error);
});
