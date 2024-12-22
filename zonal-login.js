const API_URL = 'http://localhost:3000';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const officerId = document.getElementById('officerId').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/zonalOfficers`);
        const officers = await response.json();
        
        const officer = officers.find(o => 
            o.officerId === officerId && 
            o.email === email && 
            o.password === password
        );
        
        if (officer) {
            // Add authentication flag and login timestamp
            const authenticatedOfficer = {
                ...officer,
                isAuthenticated: true,
                loginTime: new Date().toISOString()
            };
            sessionStorage.setItem('zonalOfficer', JSON.stringify(authenticatedOfficer));
            window.location.href = 'zonal-dashboard.html';
        } else {
            document.getElementById('errorMessage').textContent = 'Invalid credentials';
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('errorMessage').textContent = 'Error connecting to server';
    }
});
