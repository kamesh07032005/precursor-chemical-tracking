const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', function () {
    // Check if already logged in
    const companyData = sessionStorage.getItem('companyData');
    if (companyData) {
        window.location.href = 'company-dashboard.html';
        return;
    }

    // Login Form Handler
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const licenseNumber = document.getElementById('loginUrn').value;
        const password = document.getElementById('loginPassword').value;

        try {
            // Fetch companies from JSON server
            const response = await fetch(`${API_URL}/companies`);
            const companies = await response.json();

            // Find company with matching license number and password
            const company = companies.find(c =>
                c.licenseNumber === licenseNumber &&
                c.password === password
            );

            if (company) {
                // Store company data in sessionStorage
                sessionStorage.setItem('companyData', JSON.stringify(company));
                sessionStorage.setItem('companyId', company.id);
                sessionStorage.setItem('isLoggedIn', 'true');
                window.location.replace('company-dashboard.html');
            } else {
                throw new Error('Invalid license number or password');
            }
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });

    // Registration Form Handler
    const registrationForm = document.getElementById('registrationForm');
    registrationForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        // Gather chemicals
        const chemicals = [
            'acetic', 'ephedrine', 'pseudoephedrine', 'ergometrine',
            'ergotamine', 'lysergic', 'potassium'
        ].filter(id => document.getElementById(id).checked)
            .map(id => {
                switch (id) {
                    case 'acetic': return 'Acetic anhydride';
                    case 'ephedrine': return 'Ephedrine';
                    case 'pseudoephedrine': return 'Pseudoephedrine';
                    case 'ergometrine': return 'Ergometrine';
                    case 'ergotamine': return 'Ergotamine';
                    case 'lysergic': return 'Lysergic acid';
                    case 'potassium': return 'Potassium permanganate';
                    default: return '';
                }
            });

        // Gather activities
        const activities = [
            'manufacturing', 'distribution', 'purchasing', 'selling'
        ].filter(id => document.getElementById(id).checked);

        try {
            // First check if license number already exists
            const checkResponse = await fetch(`${API_URL}/companies`);
            const existingCompanies = await checkResponse.json();
            const licenseNumber = document.getElementById('licenseNumber').value;

            if (existingCompanies.some(c => c.licenseNumber === licenseNumber)) {
                alert('This license number is already registered');
                return;
            }

            // Prepare company data matching data.json structure
            const companyData = {
                companyName: document.getElementById('companyName').value,
                licenseNumber: licenseNumber,
                email: document.getElementById('email').value,
                password: password,
                address: document.getElementById('address').value,
                chemicals: chemicals,
                activities: activities,
                maxCapacity: parseInt(document.getElementById('maxCapacity').value),
                zone: document.getElementById('zone').value,
                createdAt: new Date().toISOString()
            };

            // Register company
            const registerResponse = await fetch(`${API_URL}/companies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(companyData)
            });

            if (registerResponse.ok) {
                alert(`Registration successful! Please login with your license number and password.`);
                // Switch to login tab
                document.getElementById('login-tab').click();
                // Clear form
                registrationForm.reset();
            } else {
                throw new Error('Registration failed');
            }
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    });

    // Form validation
    function validatePAN(pan) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(pan);
    }

    function validateAadhar(aadhar) {
        const aadharRegex = /^\d{12}$/;
        return aadharRegex.test(aadhar);
    }

    // Add input validation listeners
    document.getElementById('panNumber').addEventListener('blur', function () {
        if (!validatePAN(this.value)) {
            this.classList.add('is-invalid');
            this.setCustomValidity('Invalid PAN format');
        } else {
            this.classList.remove('is-invalid');
            this.setCustomValidity('');
        }
    });

    document.getElementById('aadharNumber').addEventListener('blur', function () {
        if (!validateAadhar(this.value)) {
            this.classList.add('is-invalid');
            this.setCustomValidity('Aadhar should be 12 digits');
        } else {
            this.classList.remove('is-invalid');
            this.setCustomValidity('');
        }
    });

    document.getElementById('confirmPassword').addEventListener('blur', function () {
        const password = document.getElementById('password').value;
        if (this.value !== password) {
            this.classList.add('is-invalid');
            this.setCustomValidity('Passwords do not match');
        } else {
            this.classList.remove('is-invalid');
            this.setCustomValidity('');
        }
    });
});
