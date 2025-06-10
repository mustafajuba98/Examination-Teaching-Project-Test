const ADMIN_USERNAME = "admin"; 
const ADMIN_PASSWORD = "password123"; 


document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const loginErrorMessage = document.getElementById("error-message");
  const loginUsernameInput = document.getElementById("username");
  const loginPasswordInput = document.getElementById("password");

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const username = loginUsernameInput.value.trim();
      const password = loginPasswordInput.value;

      if (loginErrorMessage) loginErrorMessage.textContent = "";

      // 1. Check for Hardcoded Admin Credentials FIRST
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // alert('Admin login successful!'); // Optional: remove alert for cleaner flow
        sessionStorage.setItem(
          "loggedInUser",
          JSON.stringify({ username: ADMIN_USERNAME, isAdmin: true })
        );
        window.location.href = "admin.html"; // Redirect to admin dashboard
        return; // Stop further checks if admin logs in
      }

      // 2. Check for Registered Users in localStorage (if not admin)
      const users = JSON.parse(localStorage.getItem("users")) || [];
      /*
       * Security Warning: The following check compares plain text passwords stored in localStorage.
       * This is highly insecure and should NEVER be used in a real-world application.
       * Use server-side hashing and authentication. This is for local demo purposes only.
       */
      const foundUser = users.find(
        (user) => user.username === username && user.password === password
      );

      if (foundUser && !foundUser.isAdmin) {
        // Ensure found user is not mistakenly marked as admin
        // alert('Login successful!'); // Optional: remove alert
        sessionStorage.setItem(
          "loggedInUser",
          JSON.stringify({ username: foundUser.username, isAdmin: false })
        );
        window.location.href = "exam.html"; // Redirect regular user to exam page
      } else {
        // Login failed (not admin, not a registered user, or password incorrect)
        if (loginErrorMessage)
          loginErrorMessage.textContent = "Invalid username or password.";
        if (loginPasswordInput) loginPasswordInput.value = "";
      }
    });
  }

  // --- Get Registration Form Elements ---
  const registerForm = document.getElementById("register-form");
  const registerErrorMessage = document.getElementById(
    "register-error-message"
  );
  const regUsernameInput = document.getElementById("reg-username");
  const regPasswordInput = document.getElementById("reg-password");
  const regPasswordConfirmInput = document.getElementById(
    "reg-password-confirm"
  );

  // --- Registration Form Submit Handler ---
  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const username = regUsernameInput.value.trim();
      const password = regPasswordInput.value;
      const passwordConfirm = regPasswordConfirmInput.value;

      if (registerErrorMessage) registerErrorMessage.textContent = "";

      // Input Validation
      if (!username || !password || !passwordConfirm) {
        if (registerErrorMessage)
          registerErrorMessage.textContent = "Please fill in all fields.";
        return;
      }
      if (password !== passwordConfirm) {
        if (registerErrorMessage)
          registerErrorMessage.textContent = "Passwords do not match.";
        if (regPasswordInput) regPasswordInput.value = "";
        if (regPasswordConfirmInput) regPasswordConfirmInput.value = "";
        return;
      }
      if (password.length < 6) {
        if (registerErrorMessage)
          registerErrorMessage.textContent =
            "Password must be at least 6 characters long.";
        return;
      }

      // Check if username is the reserved admin username
      if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
        if (registerErrorMessage)
          registerErrorMessage.textContent =
            "This username is reserved. Please choose another.";
        if (regUsernameInput) regUsernameInput.focus();
        return;
      }

      // Check if Username Already Exists among registered users
      const users = JSON.parse(localStorage.getItem("users")) || [];
      const existingUser = users.find(
        (user) => user.username.toLowerCase() === username.toLowerCase()
      );

      if (existingUser) {
        if (registerErrorMessage)
          registerErrorMessage.textContent =
            "Username already taken. Please choose another.";
        if (regUsernameInput) regUsernameInput.focus();
        return;
      }

      // Create New User (always as non-admin)
      /* Security Warning: Storing plain text password in localStorage is insecure. */
      const newUser = {
        id: Date.now().toString(),
        username: username,
        password: password, // Plain text password storage (BAD PRACTICE)
        isAdmin: false, // New users are NEVER admins
      };

      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));

      alert("Registration successful! You can now log in.");
      window.location.href = "index.html"; // Redirect to login page
    });
  }
}); 
