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

// Same rules as validate_password() in app.py (the server checks again)
function passwordMeetsRules(password) {
    return password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        /[!@#$%^&*(),.?":{}|<>]/.test(password);
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
                errorMessage.textContent = data.message || data.error || 'Something went wrong. Please try again.';
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
        if (!passwordMeetsRules(password)) {
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
                errorMessage.textContent = data.message || data.error || 'Something went wrong. Please try again.';
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

// Shared submit flow for the password forms below: POST JSON, show the
// server's message, and call onSuccess(data) when it succeeds.
async function submitPasswordForm(url, body, onSuccess) {
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    errorMessage.classList.remove('show');
    if (successMessage) successMessage.classList.remove('show');
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (data.success) {
            onSuccess(data);
            return;
        }
        errorMessage.textContent = data.message || data.error || 'Something went wrong. Please try again.';
        errorMessage.classList.add('show');
    } catch (error) {
        errorMessage.textContent = 'An error occurred. Please try again.';
        errorMessage.classList.add('show');
    }
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
}

function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = message;
    successMessage.classList.add('show');
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
}

function showPasswordRulesError() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = 'Please meet all password requirements.';
    errorMessage.classList.add('show');
}

// Forgot password: always shows the same message, whether or not the email exists
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        submitPasswordForm('/forgot-password', { email }, (data) => {
            showSuccess(data.message);
            forgotForm.reset();
        });
    });
}

// Reset password (from the emailed link): posts back to this page's URL
const resetForm = document.getElementById('resetForm');
if (resetForm) {
    resetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        if (!passwordMeetsRules(password)) {
            showPasswordRulesError();
            return;
        }
        submitPasswordForm(window.location.pathname, { password }, (data) => {
            window.location.href = data.redirect || '/login';
        });
    });
}

// Change password (logged in)
const changePasswordForm = document.getElementById('changePasswordForm');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const current_password = document.getElementById('currentPassword').value;
        const new_password = document.getElementById('password').value;
        if (!passwordMeetsRules(new_password)) {
            showPasswordRulesError();
            return;
        }
        submitPasswordForm('/account/password', { current_password, new_password }, (data) => {
            showSuccess(data.message);
            changePasswordForm.reset();
            document.querySelectorAll('#passwordRequirements li')
                .forEach((li) => li.classList.remove('valid', 'invalid'));
        });
    });
}
