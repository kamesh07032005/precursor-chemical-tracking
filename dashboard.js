document.addEventListener('DOMContentLoaded', function() {
    // Check login status
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const companyData = sessionStorage.getItem('companyData');

    if (!isLoggedIn || !companyData) {
        window.location.replace('company-login.html');
        return;
    }

    // Parse company data
    const company = JSON.parse(companyData);
    
    // Set company name in the dashboard
    document.getElementById('companyName').textContent = company.name;
    
    // Initialize dashboard with company data
    loadDashboardData(company);
});

function loadDashboardData(company) {
    // Global variables
    const API_URL = 'http://localhost:3000';

    // Initialize dashboard
    async function initializeDashboard() {
        await updateStats();
        await loadZonalHistory();
        await loadAlerts();
        await loadZonalReport();
    }

    // Update dashboard statistics
    async function updateStats() {
        try {
            const zonalResponse = await fetch(`${API_URL}/zonalOfficers`);
            const officers = await zonalResponse.json();
            document.getElementById('totalOfficers').textContent = officers.length;

            // Get transport stats
            const transportResponse = await fetch(`${API_URL}/transport?status=in-transit`);
            const transports = await transportResponse.json();
            document.getElementById('activeTransports').textContent = transports.length;

            // Get alert stats
            const alertResponse = await fetch(`${API_URL}/alerts?status=active`);
            const alerts = await alertResponse.json();
            document.getElementById('activeAlerts').textContent = alerts.length;
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

    // Zonal officer form submission
    document.getElementById('zonalForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const zonalData = {
            zone: formData.get('zone'),
            officerId: formData.get('officerId'),
            officerName: formData.get('officerName'),
            email: formData.get('email'),
            password: formData.get('password'),
            createdAt: new Date().toISOString()
        };

        try {
            const response = await fetch(`${API_URL}/zonalOfficers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(zonalData)
            });

            if (response.ok) {
                alert('Zonal officer created successfully!');
                e.target.reset();
                await updateStats();
                await loadZonalHistory();
            } else {
                alert('Error creating zonal officer');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error creating zonal officer');
        }
    });

    // Load zonal officer history
    async function loadZonalHistory() {
        try {
            const response = await fetch(`${API_URL}/zonalOfficers`);
            const officers = await response.json();
            
            const tableBody = document.getElementById('zonalTableBody');
            tableBody.innerHTML = '';
            
            officers.forEach(officer => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${officer.officerId}</td>
                    <td>${officer.officerName}</td>
                    <td>${officer.email}</td>
                    <td>${officer.zone}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="showResetPassword('zonal', ${officer.id})">
                            Reset Password
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading zonal history:', error);
        }
    }

    // Load alerts
    async function loadAlerts() {
        try {
            const response = await fetch(`${API_URL}/alerts`);
            const alerts = await response.json();
            
            const tableBody = document.getElementById('alertsTableBody');
            tableBody.innerHTML = '';
            
            alerts.forEach(alert => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${alert.zone}</td>
                    <td>${alert.fromCompany}</td>
                    <td>${alert.toCompany}</td>
                    <td>${alert.vehicleNumber}</td>
                    <td>${alert.status}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="resolveAlert(${alert.id})">Resolve</button>
                        <button class="btn btn-sm btn-danger" onclick="reportAlert(${alert.id})">Report</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading alerts:', error);
        }
    }

    // Load zonal report
    async function loadZonalReport() {
        try {
            const [officers, alerts] = await Promise.all([
                fetch(`${API_URL}/zonalOfficers`).then(res => res.json()),
                fetch(`${API_URL}/alerts`).then(res => res.json())
            ]);

            const zones = ['North Zone', 'South Zone', 'West Zone', 'East Zone'];
            const reportContent = document.getElementById('zonalReportContent');
            reportContent.innerHTML = '';

            zones.forEach(zone => {
                const zoneOfficers = officers.filter(o => o.zone === zone);
                const zoneAlerts = alerts.filter(a => a.zone === zone);

                const zoneReport = document.createElement('div');
                zoneReport.className = 'card mb-3';
                zoneReport.innerHTML = `
                    <div class="card-header">
                        <h5 class="mb-0">${zone}</h5>
                    </div>
                    <div class="card-body">
                        <p>Total Officers: ${zoneOfficers.length}</p>
                        <p>Active Alerts: ${zoneAlerts.filter(a => a.status === 'Active').length}</p>
                    </div>
                `;
                reportContent.appendChild(zoneReport);
            });
        } catch (error) {
            console.error('Error loading zonal report:', error);
        }
    }

    // Show reset password modal
    function showResetPassword(entityType, id) {
        const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
        document.getElementById('resetEntityType').value = entityType;
        document.getElementById('resetEntityId').value = id;
        modal.show();
    }

    // Reset password
    async function resetPassword() {
        const entityType = document.getElementById('resetEntityType').value;
        const entityId = document.getElementById('resetEntityId').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        try {
            const endpoint = entityType === 'company' ? 'companies' : 'zonalOfficers';
            const response = await fetch(`${API_URL}/${endpoint}/${entityId}`, {
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
        const reason = prompt('Enter reason for resolution:');
        if (!reason) return;

        try {
            const response = await fetch(`${API_URL}/alerts/${alertId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'Resolved',
                    resolution: reason,
                    resolvedAt: new Date().toISOString()
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

    // Report alert
    async function reportAlert(alertId) {
        try {
            const alert = await fetch(`${API_URL}/alerts/${alertId}`).then(res => res.json());
            const report = {
                alertId,
                reportedAt: new Date().toISOString(),
                details: alert
            };

            const response = await fetch(`${API_URL}/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(report)
            });

            if (response.ok) {
                alert('Alert reported successfully!');
            } else {
                alert('Error reporting alert');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error reporting alert');
        }
    }

    // Logout function
    function logout() {
        sessionStorage.clear(); // Clear all session data
        window.location.replace('company-login.html');
    }

    // Initialize dashboard
    initializeDashboard();
}

function logout() {
    sessionStorage.clear();
    window.location.replace('company-login.html');
}
