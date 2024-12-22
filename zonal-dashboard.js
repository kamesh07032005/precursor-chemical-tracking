// Check authentication
const officerData = JSON.parse(sessionStorage.getItem('zonalOfficer'));
if (!officerData || !officerData.isAuthenticated) {
    window.location.href = 'index.html';
    throw new Error('Authentication required');
}

const API_URL = 'http://localhost:3000';

// Initialize dashboard
async function initializeDashboard() {
    try {
        // Load initial data
        await Promise.all([
            loadTransportDetails(),
            loadCompanyHistory(),
            loadAlerts(),
            loadNCBReports(),
            loadAnalytics()
        ]);

        // Add event listeners
        document.getElementById('transportFilter').addEventListener('change', filterTransports);
        document.getElementById('logoutBtn').addEventListener('click', logout);

        // Show default section
        showSection('dashboard');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Show/hide sections
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.style.display = 'block';
        
        // Refresh data based on section
        switch(sectionId) {
            case 'transports':
                loadTransportDetails();
                break;
            case 'companyHistory':
                loadCompanyHistory();
                break;
            case 'analytics':
                loadAnalytics();
                break;
            case 'ncbReports':
                loadNCBReports();
                break;
        }
    }
}

// Update dashboard statistics
async function updateStats() {
    try {
        // Get companies in zone
        const companiesResponse = await fetch(`${API_URL}/companies?zone=${officerData.zone}`);
        const companies = await companiesResponse.json();
        document.getElementById('zoneCompanies').textContent = companies.length;

        // Get active transports
        const transportResponse = await fetch(`${API_URL}/transport?status=in-transit`);
        const transports = await transportResponse.json();
        document.getElementById('activeTransports').textContent = transports.length;

        // Get active alerts
        const alertResponse = await fetch(`${API_URL}/alerts?status=active&zone=${officerData.zone}`);
        const alerts = await alertResponse.json();
        document.getElementById('activeAlerts').textContent = alerts.length;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Load transport details
async function loadTransportDetails() {
    try {
        const response = await fetch(`${API_URL}/transport?zone=${officerData.zone}`);
        let transports = await response.json();

        if (!transports || transports.length === 0) {
            transports = [{
                id: 1,
                fromCompany: "ABC Chemicals",
                toCompany: "XYZ Pharmaceuticals",
                chemicalType: "Acetone",
                quantity: "1000 L",
                vehicleDetails: "MH-12-XY-1234",
                startTime: new Date().toISOString(),
                expectedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                status: "in-transit",
                driverName: "John Doe",
                driverContact: "+91-9876543210",
                currentLocation: "Mumbai-Pune Highway",
                route: "Mumbai to Pune"
            }];
        }

        renderTransports(transports);
    } catch (error) {
        console.error('Error loading transport details:', error);
        // Show error message to user
        document.getElementById('transportDetails').innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-danger">
                    Error loading transport details. Please try again later.
                </td>
            </tr>`;
    }
}

// Render transports in the table
function renderTransports(transports) {
    const tbody = document.getElementById('transportDetails');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const filterValue = document.getElementById('transportFilter')?.value || 'all';
    
    transports.forEach(transport => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${transport.id}</td>
            <td>${transport.fromCompany}</td>
            <td>${transport.toCompany}</td>
            <td>${transport.chemicalType}</td>
            <td>${transport.quantity}</td>
            <td>${transport.vehicleDetails}</td>
            <td>${formatDate(transport.startTime)}</td>
            <td>${formatDate(transport.expectedDelivery)}</td>
            <td><span class="badge ${getStatusBadgeClass(transport.status)}">${transport.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="viewTransportDetails(${transport.id})">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning" onclick="showReportModal(${transport.id})">
                    <i class="bi bi-exclamation-triangle"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Get appropriate badge class for status
function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
        case 'in-transit':
            return 'bg-primary';
        case 'delivered':
            return 'bg-success';
        case 'delayed':
            return 'bg-warning';
        default:
            return 'bg-secondary';
    }
}

// View transport details
async function viewTransportDetails(transportId) {
    if (!transportId) {
        console.error('Invalid transport ID');
        return;
    }

    try {
        let transport;
        try {
            const response = await fetch(`${API_URL}/transport/${transportId}`);
            transport = await response.json();
        } catch (error) {
            console.log('Using sample transport data');
            transport = {
                id: transportId,
                fromCompany: "ABC Chemicals",
                toCompany: "XYZ Pharmaceuticals",
                chemicalType: "Acetone",
                quantity: "1000 L",
                vehicleDetails: "MH-12-XY-1234",
                startTime: new Date().toISOString(),
                expectedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                status: "in-transit",
                driverName: "John Doe",
                driverContact: "+91-9876543210",
                currentLocation: "Mumbai-Pune Highway",
                route: "Mumbai to Pune"
            };
        }

        // Remove existing modal if any
        const existingModal = document.getElementById('transportDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create new modal
        const modalHTML = `
            <div class="modal fade" id="transportDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Transport Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Transport ID:</strong> ${transport.id || 'N/A'}</p>
                                    <p><strong>From Company:</strong> ${transport.fromCompany || 'N/A'}</p>
                                    <p><strong>To Company:</strong> ${transport.toCompany || 'N/A'}</p>
                                    <p><strong>Chemical Type:</strong> ${transport.chemicalType || 'N/A'}</p>
                                    <p><strong>Quantity:</strong> ${transport.quantity || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Vehicle Details:</strong> ${transport.vehicleDetails || 'N/A'}</p>
                                    <p><strong>Driver Name:</strong> ${transport.driverName || 'N/A'}</p>
                                    <p><strong>Driver Contact:</strong> ${transport.driverContact || 'N/A'}</p>
                                    <p><strong>Current Location:</strong> ${transport.currentLocation || 'N/A'}</p>
                                    <p><strong>Route:</strong> ${transport.route || 'N/A'}</p>
                                </div>
                            </div>
                            <div class="row mt-3">
                                <div class="col-12">
                                    <p><strong>Status:</strong> 
                                        <span class="badge ${getStatusBadgeClass(transport.status || 'pending')}">
                                            ${transport.status || 'pending'}
                                        </span>
                                    </p>
                                    <p><strong>Start Time:</strong> ${formatDate(transport.startTime)}</p>
                                    <p><strong>Expected Delivery:</strong> ${formatDate(transport.expectedDelivery)}</p>
                                </div>
                            </div>
                            <div id="transportMap" class="mt-3" style="height: 300px; background-color: #f8f9fa;">
                                <div class="text-center p-3">
                                    <i class="bi bi-geo-alt h1"></i>
                                    <p class="mb-0">Current Location: ${transport.currentLocation || 'Location not available'}</p>
                                    <small class="text-muted">Route: ${transport.route || 'Route not available'}</small>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-warning me-2" onclick="showReportModal(${transport.id})">
                                <i class="bi bi-exclamation-triangle"></i> Report Issue
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>`;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('transportDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Error viewing transport details:', error);
        alert('Error loading transport details. Please try again.');
    }
}

// Refresh transport details
async function refreshTransports() {
    await loadTransportDetails();
}

// Filter transports based on status
function filterTransports() {
    const transports = document.querySelectorAll('#transportDetails tr');
    const filterValue = document.getElementById('transportFilter').value;
    
    transports.forEach(row => {
        const status = row.querySelector('.badge').textContent;
        row.style.display = (filterValue === 'all' || status === filterValue) ? '' : 'none';
    });
}

// Load company history
async function loadCompanyHistory() {
    try {
        const response = await fetch(`${API_URL}/companies?zone=${officerData.zone}`);
        const companies = await response.json();
        
        const tableBody = document.getElementById('companyTableBody');
        tableBody.innerHTML = '';
        
        companies.forEach(company => {
            const status = getLicenseStatus(company.expirationDate);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${company.companyName}</td>
                <td>${company.urnNumber}</td>
                <td>
                    <span class="badge ${getBadgeClass(status)}">${status}</span>
                </td>
                <td>${formatDate(company.issueDate)}</td>
                <td>${formatDate(company.expirationDate)}</td>
                <td>${company.chemicals.join(', ')}</td>
                <td>${company.activities.join(', ')}</td>
                <td>
                    <button class="btn btn-sm btn-info me-1" onclick="showCompanyDetails(${company.id})">
                        <i class="bi bi-info-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-warning me-1" onclick="showLicenseRenewal(${company.id})">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="showResetPassword('company', ${company.id})">
                        <i class="bi bi-key"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading company history:', error);
    }
}

// Get license status based on expiration date
function getLicenseStatus(expirationDate) {
    const today = new Date();
    const expiry = new Date(expirationDate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
        return 'Expired';
    } else if (daysUntilExpiry <= 30) {
        return 'Expiring Soon';
    } else {
        return 'Active';
    }
}

// Get badge class based on status
function getBadgeClass(status) {
    switch (status) {
        case 'Active':
            return 'bg-success';
        case 'Expiring Soon':
            return 'bg-warning';
        case 'Expired':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

// Show company details modal
async function showCompanyDetails(companyId) {
    try {
        const response = await fetch(`${API_URL}/companies/${companyId}`);
        const company = await response.json();

        document.getElementById('modalCompanyName').textContent = company.companyName;
        document.getElementById('modalUrnNumber').textContent = company.urnNumber;
        document.getElementById('modalEmail').textContent = company.email;
        document.getElementById('modalAddress').textContent = company.address;

        const status = getLicenseStatus(company.expirationDate);
        const statusElement = document.getElementById('modalLicenseStatus');
        statusElement.textContent = status;
        statusElement.className = `badge ${getBadgeClass(status)}`;

        document.getElementById('modalIssueDate').textContent = formatDate(company.issueDate);
        document.getElementById('modalExpiryDate').textContent = formatDate(company.expirationDate);

        const chemicalsList = document.getElementById('modalChemicals');
        chemicalsList.innerHTML = company.chemicals.map(chem => `<li>${chem}</li>`).join('');

        const activitiesList = document.getElementById('modalActivities');
        activitiesList.innerHTML = company.activities.map(act => `<li>${act}</li>`).join('');

        const modal = new bootstrap.Modal(document.getElementById('companyDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading company details:', error);
        alert('Error loading company details');
    }
}

// Show license renewal modal
async function showLicenseRenewal(companyId) {
    try {
        const response = await fetch(`${API_URL}/companies/${companyId}`);
        const company = await response.json();

        document.getElementById('renewalCompanyId').value = company.id;
        document.getElementById('currentExpiryDate').value = formatDate(company.expirationDate);

        // Set minimum date for new expiry date
        const today = new Date();
        const minDate = today.toISOString().split('T')[0];
        const newExpiryInput = document.getElementById('newExpiryDate');
        newExpiryInput.min = minDate;
        newExpiryInput.value = '';

        document.getElementById('renewalNotes').value = '';

        const modal = new bootstrap.Modal(document.getElementById('licenseRenewalModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading company for renewal:', error);
        alert('Error loading company information');
    }
}

// Handle license renewal form submission
document.getElementById('renewalForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
        const companyId = document.getElementById('renewalCompanyId').value;
        const newExpirationDate = document.getElementById('newExpiryDate').value;
        
        const response = await fetch(`${API_URL}/companies/${companyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                licenseExpirationDate: newExpirationDate
            })
        });

        if (response.ok) {
            alert('License renewed successfully!');
            const modal = bootstrap.Modal.getInstance(document.getElementById('licenseRenewalModal'));
            if (modal) {
                modal.hide();
            }
            await loadCompanyHistory();
        } else {
            alert('Error renewing license');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error renewing license');
    }
});

// Load alerts
async function loadAlerts() {
    try {
        const response = await fetch(`${API_URL}/alerts?zone=${officerData.zone}&status=active`);
        const alerts = await response.json();
        
        const alertsList = document.getElementById('alertsList');
        alertsList.innerHTML = '';
        
        alerts.forEach(alert => {
            const alertCard = document.createElement('div');
            alertCard.className = 'card mb-3';
            alertCard.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${alert.type} Alert</h5>
                    <p class="card-text">${alert.description}</p>
                    <p class="card-text"><small class="text-muted">Reported on: ${new Date(alert.createdAt).toLocaleString()}</small></p>
                    <button class="btn btn-sm btn-success me-2" onclick="resolveAlert('${alert.id}')">Resolve</button>
                    <button class="btn btn-sm btn-danger" onclick="escalateAlert('${alert.id}')">Escalate</button>
                </div>
            `;
            alertsList.appendChild(alertCard);
        });
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

// Show report modal
function showReportModal(transportId) {
    document.getElementById('transportId').value = transportId;
    const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
    reportModal.show();
}

// Submit report
async function submitReport() {
    const transportId = document.getElementById('transportId').value;
    const reportType = document.getElementById('reportType').value;
    const description = document.getElementById('reportDescription').value;

    const reportData = {
        transportId,
        reportType,
        description,
        officerId: officerData.officerId,
        officerName: officerData.officerName,
        zone: officerData.zone,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });

        if (response.ok) {
            alert('Report submitted successfully!');
            bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
            document.getElementById('reportForm').reset();
        } else {
            alert('Error submitting report');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error submitting report');
    }
}

// Company form submission
document.getElementById('companyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const companyData = {
        companyName: formData.get('companyName'),
        urnNumber: formData.get('urnNumber'),
        email: formData.get('email'),
        password: formData.get('password'),
        address: formData.get('address'),
        issueDate: formData.get('issueDate'),
        expirationDate: formData.get('expirationDate'),
        chemicals: Array.from(formData.getAll('chemicals')),
        activities: Array.from(formData.getAll('activities')),
        zone: officerData.zone,
        createdAt: new Date().toISOString(),
        createdBy: officerData.officerId
    };

    try {
        const response = await fetch(`${API_URL}/companies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(companyData)
        });

        if (response.ok) {
            alert('Company created successfully!');
            e.target.reset();
            await updateStats();
            await loadCompanyHistory();
        } else {
            alert('Error creating company');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating company');
    }
});

// Show reset password modal
function showResetPassword(entityType, id) {
    document.getElementById('resetEntityType').value = entityType;
    document.getElementById('resetEntityId').value = id;
    const resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    resetModal.show();
}

// Reset password
async function resetPassword() {
    const entityType = document.getElementById('resetEntityType').value;
    const entityId = document.getElementById('resetEntityId').value;
    const newPassword = document.getElementById('newPassword').value;

    try {
        const response = await fetch(`${API_URL}/${entityType}s/${entityId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: newPassword })
        });

        if (response.ok) {
            alert('Password reset successfully!');
            bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
        } else {
            alert('Error resetting password');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error resetting password');
    }
}

// Resolve alert
async function resolveAlert(alertId) {
    try {
        const response = await fetch(`${API_URL}/alerts/${alertId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolvedBy: officerData.officerId
            })
        });

        if (response.ok) {
            alert('Alert resolved successfully!');
            await loadAlerts();
        } else {
            alert('Error resolving alert');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error resolving alert');
    }
}

// Escalate alert
async function escalateAlert(alertId) {
    try {
        const response = await fetch(`${API_URL}/alerts/${alertId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'escalated',
                escalatedAt: new Date().toISOString(),
                escalatedBy: officerData.officerId
            })
        });

        if (response.ok) {
            alert('Alert escalated successfully!');
            await loadAlerts();
        } else {
            alert('Error escalating alert');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error escalating alert');
    }
}

// Analytics Functions
async function loadAnalytics() {
    try {
        // Destroy existing charts
        const charts = [
            Chart.getChart('chemicalDistributionChart'),
            Chart.getChart('activityDistributionChart'),
            Chart.getChart('licenseStatusChart'),
            Chart.getChart('manufacturingTrendChart'),
            Chart.getChart('transportSummaryChart')
        ];
        
        charts.forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });

        // Load companies data
        let companies = [];
        try {
            const response = await fetch(`${API_URL}/companies?zone=${officerData.zone}`);
            companies = await response.json();
        } catch (error) {
            console.log('Using sample companies data for analytics');
            companies = [
                {
                    id: 1,
                    name: "Chemical Corp A",
                    type: "manufacturer",
                    chemicalTypes: ["Acetone", "Toluene"],
                    licenseStatus: "active"
                },
                {
                    id: 2,
                    name: "Pharma Ltd B",
                    type: "distributor",
                    chemicalTypes: ["Sulfuric Acid"],
                    licenseStatus: "expired"
                }
            ];
        }

        // Load and render charts
        await Promise.all([
            loadChemicalDistribution(companies),
            loadActivityDistribution(companies),
            loadLicenseStatus(companies),
            loadManufacturingTrends([], companies),
            loadTransportSummary([], companies)
        ]);

    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function loadChemicalDistribution(companies) {
    const chemicalCounts = {};
    companies.forEach(company => {
        company.chemicals.forEach(chemical => {
            chemicalCounts[chemical] = (chemicalCounts[chemical] || 0) + 1;
        });
    });

    new Chart(document.getElementById('chemicalDistributionChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(chemicalCounts),
            datasets: [{
                data: Object.values(chemicalCounts),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function loadActivityDistribution(companies) {
    const activityCounts = {};
    companies.forEach(company => {
        company.activities.forEach(activity => {
            activityCounts[activity] = (activityCounts[activity] || 0) + 1;
        });
    });

    new Chart(document.getElementById('activityDistributionChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(activityCounts),
            datasets: [{
                label: 'Number of Companies',
                data: Object.values(activityCounts),
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity',
                        font: {
                            size: 11
                        }
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function loadLicenseStatus(companies) {
    const statusCounts = {
        'Active': 0,
        'Expiring Soon': 0,
        'Expired': 0
    };

    companies.forEach(company => {
        const status = getLicenseStatus(company.expirationDate);
        statusCounts[status]++;
    });

    new Chart(document.getElementById('licenseStatusChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#4BC0C0', // Active
                    '#FFCE56', // Expiring Soon
                    '#FF6384'  // Expired
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function loadManufacturingTrends(manufacturing, companies) {
    const companyIds = companies.map(c => c.id);
    const monthlyData = {};

    manufacturing
        .filter(m => companyIds.includes(m.companyId))
        .forEach(m => {
            const date = new Date(m.manufacturingDate);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {
                    'Acetic anhydride': 0,
                    'Sulphuric acid': 0
                };
            }
            monthlyData[monthYear][m.chemicalType] += m.quantity;
        });

    const months = Object.keys(monthlyData).sort();
    const chemicals = Object.keys(monthlyData[months[0]] || {});

    new Chart(document.getElementById('manufacturingTrendChart'), {
        type: 'line',
        data: {
            labels: months,
            datasets: chemicals.map((chemical, index) => ({
                label: chemical,
                data: months.map(month => monthlyData[month][chemical]),
                borderColor: index === 0 ? '#FF6384' : '#36A2EB',
                fill: false,
                tension: 0.1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity',
                        font: {
                            size: 11
                        }
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function loadTransportSummary(transports, companies) {
    const companyIds = companies.map(c => c.id);
    const summary = {};
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    transports
        .filter(t => {
            const fromCompany = companies.find(c => c.companyName === t.fromCompany);
            const toCompany = companies.find(c => c.companyName === t.toCompany);
            return fromCompany || toCompany;
        })
        .forEach(t => {
            if (!summary[t.chemicalType]) {
                summary[t.chemicalType] = {
                    monthlyQuantity: 0,
                    activeTransports: 0,
                    completedTransports: 0
                };
            }

            const transportDate = new Date(t.date);
            if (transportDate >= firstDayOfMonth) {
                summary[t.chemicalType].monthlyQuantity += t.quantity;
            }

            if (t.status === 'in-transit') {
                summary[t.chemicalType].activeTransports++;
            } else if (t.status === 'delivered') {
                summary[t.chemicalType].completedTransports++;
            }
        });

    const tableBody = document.getElementById('transportSummaryBody');
    tableBody.innerHTML = Object.entries(summary)
        .map(([chemical, data]) => `
            <tr>
                <td>${chemical}</td>
                <td>${data.monthlyQuantity} KG</td>
                <td>${data.activeTransports}</td>
                <td>${data.completedTransports}</td>
            </tr>
        `).join('');
}

// NCB Reporting Functions
async function loadNCBReports() {
    try {
        const tableBody = document.getElementById('ncbReportsTable');
        if (!tableBody) {
            console.warn('NCB reports table not found');
            return;
        }

        // Sample data for NCB reports
        const reports = [
            {
                id: 1,
                subject: "Suspicious Chemical Purchase Pattern",
                date: new Date().toISOString(),
                status: "pending",
                priority: "high",
                description: "Multiple large purchases of precursor chemicals in short time span",
                category: "suspicious-activity",
                relatedCompanies: ["Chemical Corp A"],
                attachments: [],
                comments: [
                    {
                        author: "John Doe",
                        date: new Date().toISOString(),
                        text: "Initial investigation started"
                    }
                ]
            },
            {
                id: 2,
                subject: "Transport Route Deviation",
                date: new Date(Date.now() - 86400000).toISOString(),
                status: "in-review",
                priority: "medium",
                description: "Transport vehicle deviated significantly from approved route",
                category: "transport-irregularity",
                relatedCompanies: ["Pharma Ltd B"],
                attachments: [],
                comments: [
                    {
                        author: "Jane Smith",
                        date: new Date(Date.now() - 86400000).toISOString(),
                        text: "Route deviation confirmed through GPS tracking"
                    }
                ]
            },
            {
                id: 3,
                subject: "Missing Inventory Report",
                date: new Date(Date.now() - 172800000).toISOString(),
                status: "resolved",
                priority: "high",
                description: "Significant discrepancy in monthly inventory report",
                category: "inventory-discrepancy",
                relatedCompanies: ["XYZ Industries"],
                attachments: [],
                comments: [
                    {
                        author: "Mike Johnson",
                        date: new Date(Date.now() - 172800000).toISOString(),
                        text: "Investigation completed - Documentation error confirmed"
                    }
                ]
            }
        ];
            
        tableBody.innerHTML = reports.map(report => `
            <tr>
                <td>${report.id}</td>
                <td>${report.subject}</td>
                <td>${new Date(report.date).toLocaleDateString()}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(report.status)}">
                        ${report.status}
                    </span>
                </td>
                <td>
                    <span class="badge ${getPriorityBadgeClass(report.priority)}">
                        ${report.priority}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info me-1" onclick="viewReportDetails(${report.id})">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${report.status === 'pending' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteReport(${report.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');

        // Update reports count in stats
        const pendingReports = reports.filter(r => r.status === 'pending').length;
        const reportsCountElement = document.getElementById('pendingReports');
        if (reportsCountElement) {
            reportsCountElement.textContent = pendingReports;
        }

    } catch (error) {
        console.error('Error loading NCB reports:', error);
        const tableBody = document.getElementById('ncbReportsTable');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        Error loading NCB reports. Please try again later.
                    </td>
                </tr>`;
        }
    }
}

function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'bg-warning';
        case 'in-review': return 'bg-info';
        case 'resolved': return 'bg-success';
        case 'rejected': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

function getPriorityBadgeClass(priority) {
    if (!priority) return 'bg-secondary';
    
    switch (priority.toLowerCase()) {
        case 'high': return 'bg-danger';
        case 'medium': return 'bg-warning';
        case 'low': return 'bg-info';
        default: return 'bg-secondary';
    }
}

async function showNewReportModal() {
    try {
        // Fetch companies in the zone for the dropdown
        const response = await fetch(`${API_URL}/companies?zone=${officerData.zone}`);
        const companies = await response.json();
        
        const companySelect = document.querySelector('select[name="relatedCompanies"]');
        companySelect.innerHTML = companies.map(company => `
            <option value="${company.id}">${company.companyName} (${company.urnNumber})</option>
        `).join('');
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('newReportModal'));
        modal.show();
    } catch (error) {
        console.error('Error preparing report modal:', error);
        alert('Error loading company data. Please try again.');
    }
}

async function submitNCBReport() {
    try {
        const form = document.getElementById('ncbReportForm');
        const formData = new FormData(form);
        
        const reportData = {
            subject: formData.get('subject'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            description: formData.get('description'),
            relatedCompanies: Array.from(formData.getAll('relatedCompanies')),
            zone: officerData.zone,
            officerId: officerData.id,
            officerName: officerData.officerName,
            status: 'pending',
            date: new Date().toISOString(),
            attachments: [] // Handle attachments separately if needed
        };

        const response = await fetch(`${API_URL}/ncbReports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        });

        if (!response.ok) {
            throw new Error('Failed to submit report');
        }

        // Close modal and refresh reports
        bootstrap.Modal.getInstance(document.getElementById('newReportModal')).hide();
        form.reset();
        await loadNCBReports();
        
        // Show success message
        alert('Report submitted successfully');
    } catch (error) {
        console.error('Error submitting report:', error);
        alert('Error submitting report. Please try again.');
    }
}

async function viewReportDetails(reportId) {
    if (!reportId) {
        console.error('Invalid report ID');
        return;
    }

    try {
        // Get report data
        let report;
        try {
            const response = await fetch(`${API_URL}/ncbReports/${reportId}`);
            report = await response.json();
        } catch (error) {
            console.log('Using sample report data');
            // Use sample data if API fails
            report = {
                id: reportId,
                subject: "Suspicious Chemical Purchase Pattern",
                date: new Date().toISOString(),
                status: "pending",
                priority: "high",
                description: "Multiple large purchases of precursor chemicals in short time span",
                category: "suspicious-activity",
                relatedCompanies: ["Chemical Corp A"],
                attachments: [],
                comments: [
                    {
                        author: "John Doe",
                        date: new Date().toISOString(),
                        text: "Initial investigation started"
                    }
                ]
            };
        }

        // Remove existing modal if any
        const existingModal = document.getElementById('reportDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalContent = `
            <div class="modal fade" id="reportDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Report Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Report ID:</strong> ${report.id}</p>
                                    <p><strong>Subject:</strong> ${report.subject || 'N/A'}</p>
                                    <p><strong>Date:</strong> ${formatDate(report.date)}</p>
                                    <p><strong>Category:</strong> ${report.category || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Status:</strong> 
                                        <span class="badge ${getStatusBadgeClass(report.status || 'pending')}">
                                            ${report.status || 'pending'}
                                        </span>
                                    </p>
                                    <p><strong>Priority:</strong> 
                                        <span class="badge ${getPriorityBadgeClass(report.priority || 'medium')}">
                                            ${report.priority || 'medium'}
                                        </span>
                                    </p>
                                    <p><strong>Related Companies:</strong> ${report.relatedCompanies ? report.relatedCompanies.join(', ') : 'N/A'}</p>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-12">
                                    <h6>Description</h6>
                                    <p class="border rounded p-3 bg-light">
                                        ${report.description || 'No description available'}
                                    </p>
                                </div>
                            </div>
                            ${report.attachments && report.attachments.length > 0 ? `
                                <div class="row mb-3">
                                    <div class="col-12">
                                        <h6>Attachments</h6>
                                        <ul class="list-group">
                                            ${report.attachments.map(attachment => `
                                                <li class="list-group-item">
                                                    <i class="bi bi-paperclip"></i>
                                                    ${attachment.name}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                </div>
                            ` : ''}
                            ${report.comments && report.comments.length > 0 ? `
                                <div class="row">
                                    <div class="col-12">
                                        <h6>Comments</h6>
                                        <div class="border rounded p-3">
                                            ${report.comments.map(comment => `
                                                <div class="mb-2">
                                                    <small class="text-muted">
                                                        ${comment.author} - ${formatDate(comment.date)}
                                                    </small>
                                                    <p class="mb-1">${comment.text}</p>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            ${report.status === 'pending' ? `
                                <button type="button" class="btn btn-danger" onclick="deleteReport(${report.id})">
                                    <i class="bi bi-trash"></i> Delete Report
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalContent);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('reportDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Error viewing report details:', error);
        alert('Error loading report details. Please try again.');
    }
}

async function deleteReport(reportId) {
    if (!confirm('Are you sure you want to delete this report?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/ncbReports/${reportId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete report');
        }

        await loadNCBReports();
        alert('Report deleted successfully');
    } catch (error) {
        console.error('Error deleting report:', error);
        alert('Error deleting report. Please try again.');
    }
}

// Logout function
function logout() {
    sessionStorage.removeItem('zonalOfficer');
    window.location.href = 'index.html';
}
