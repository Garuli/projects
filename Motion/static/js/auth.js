// Password validation UI
const passwordInput = document.getElementById('password');

if (passwordInput && document.getElementById('passwordRequirements')) {
    passwordInput.addEventListener('input', () => {
        validatePasswordUI(passwordInput.value);
    });
}

function validatePasswordUI(password) {
    const requirements = {
        'req-length': password.length >= 8,
        'req-uppercase': /[A-Z]/.test(password),
        'req-lowercase': /[a-z]/.test(password),
        'req-number': /\d/.test(password),
        'req-special': /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    for (const [id, isValid] of Object.entries(requirements)) {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('valid', 'invalid');
            element.classList.add(isValid ? 'valid' : 'invalid');
        }
    }
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn');
        const errorMessage = document.getElementById('errorMessage');
        
        // Get form data
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        errorMessage.classList.remove('show');
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Redirect to dashboard
                window.location.href = '/dashboard';
            } else {
                // Show error
                errorMessage.textContent = data.message;
                errorMessage.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
            }
        } catch (error) {
            errorMessage.textContent = 'An error occurred. Please try again.';
            errorMessage.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    });
}

// Register form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn');
        const errorMessage = document.getElementById('errorMessage');
        
        // Get form data
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Client-side password validation
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const allValid = Object.values(requirements).every(v => v);
        
        if (!allValid) {
            errorMessage.textContent = 'Please meet all password requirements.';
            errorMessage.classList.add('show');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        errorMessage.classList.remove('show');
        
        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Redirect to dashboard
                window.location.href = '/dashboard';
            } else {
                // Show error
                errorMessage.textContent = data.message;
                errorMessage.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
            }
        } catch (error) {
            errorMessage.textContent = 'An error occurred. Please try again.';
            errorMessage.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    });
}