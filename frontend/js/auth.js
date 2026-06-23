document.addEventListener('DOMContentLoaded', () => {
  renderSharedLayout();

  // Dynamic Label Toggles in Registration Form based on Role selection
  const registerRoleUser = document.getElementById('registerRoleUser');
  const registerRoleVendor = document.getElementById('registerRoleVendor');
  const nameLabel = document.getElementById('nameLabel');
  const registerNameInput = document.getElementById('registerName');

  if (registerRoleUser && registerRoleVendor && nameLabel && registerNameInput) {
    registerRoleUser.addEventListener('change', () => {
      nameLabel.textContent = 'Full Name';
      registerNameInput.placeholder = 'John Doe';
    });

    registerRoleVendor.addEventListener('change', () => {
      nameLabel.textContent = 'Store / Vendor Name';
      registerNameInput.placeholder = 'Gadget World';
    });
  }

  // Handle Login Submissions
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const role = document.querySelector('input[name="loginRole"]:checked').value;

      let endpoint = '/auth/login'; // default user
      if (role === 'vendor') {
        endpoint = '/auth/vendor/login';
      } else if (role === 'admin') {
        endpoint = '/auth/admin/login';
      }

      try {
        const res = await API.post(endpoint, { email, password });
        
        if (res.success && res.token) {
          localStorage.setItem('token', res.token);
          
          const userObj = res.user || res.vendor || res.admin;
          localStorage.setItem('user', JSON.stringify({
            id: userObj.id,
            name: userObj.name || userObj.vendor_name || 'Administrator',
            email: userObj.email,
            role: userObj.role || role
          }));

          API.showToast('Login Successful! Redirecting...', false);

          setTimeout(() => {
            if (role === 'admin') {
              window.location.href = 'admin.html';
            } else if (role === 'vendor') {
              window.location.href = 'vendor.html';
            } else {
              window.location.href = 'customer.html';
            }
          }, 1000);
        }
      } catch (err) {
        API.showToast(err.message || 'Login failed. Please check credentials.', true);
      }
    });
  }

  // Handle Registration Submissions
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const role = document.querySelector('input[name="registerRole"]:checked').value;
      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value.trim();

      if (password.length < 6) {
        API.showToast('Password must be at least 6 characters long.', true);
        return;
      }

      try {
        if (role === 'user') {
          const res = await API.post('/auth/register', { name, email, password });
          if (res.success && res.token) {
            localStorage.setItem('token', res.token);
            localStorage.setItem('user', JSON.stringify(res.user));
            API.showToast('Registration successful! Logging you in...', false);
            setTimeout(() => {
              window.location.href = 'customer.html';
            }, 1000);
          }
        } else {
          const res = await API.post('/auth/vendor/register', { vendor_name: name, email, password });
          if (res.success) {
            API.showToast('Registration successful! Store is pending admin approval.', false);
            setTimeout(() => {
              const loginTabButton = document.getElementById('login-tab');
              if (loginTabButton) {
                loginTabButton.click();
              }
              registerForm.reset();
            }, 1500);
          }
        }
      } catch (err) {
        API.showToast(err.message || 'Registration failed.', true);
      }
    });
  }

  // Handle Forgot Password Form Submission
  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('resetEmail').value.trim();
      const new_password = document.getElementById('resetNewPassword').value.trim();

      if (new_password.length < 6) {
        API.showToast('Password must be at least 6 characters.', true);
        return;
      }

      try {
        const res = await API.post('/auth/reset-password', { email, new_password });
        if (res.success) {
          API.showToast('Password reset successful. You can now login.');
          
          // Hide Modal
          const modalEl = document.getElementById('forgotPasswordModal');
          const modal = bootstrap.Modal.getInstance(modalEl);
          modal.hide();
          forgotForm.reset();
        }
      } catch (err) {
        API.showToast(err.message || 'Password reset failed.', true);
      }
    });
  }
});

// Social login simulation trigger
window.handleSocialLogin = async (provider) => {
  API.showToast(`Simulating secure redirect to ${provider}...`);
  
  // Set mock account details depending on provider
  const mockEmail = `social_${provider.toLowerCase()}@test.com`;
  const mockName = `${provider} User`;

  setTimeout(async () => {
    try {
      const res = await API.post('/auth/social-login', {
        email: mockEmail,
        name: mockName,
        provider: provider
      });

      if (res.success && res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        API.showToast(`Authenticated successfully via ${provider}!`);
        
        setTimeout(() => {
          window.location.href = 'customer.html';
        }, 1000);
      }
    } catch (err) {
      API.showToast('Social login simulation failed.', true);
    }
  }, 1200);
};
