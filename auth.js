// ============================================
// TASKFORGE 2.0 — AUTHENTICATION
// ============================================

const authScreen = document.getElementById("auth-screen");
const appLayout = document.querySelector(".app-layout");
const bottomNav = document.querySelector(".bottom-nav");

const authStatus = document.getElementById("auth-status");

const signupForm = document.getElementById("signup-form");
const signinForm = document.getElementById("signin-form");

const signupName = document.getElementById("signup-name");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupConfirmPassword = document.getElementById(
    "signup-confirm-password"
);

const signinEmail = document.getElementById("signin-email");
const signinPassword = document.getElementById("signin-password");

const authTabs = document.querySelectorAll("[data-auth-mode]");
const guestButton = document.getElementById("guest-button");

let currentUser = null;

window.taskForgeAuth = {
    get user() {
        return currentUser;
    },
    get isGuest() {
        return currentUser === null;
    }
};

function updateAccountProfile() {
const user = currentUser;


const name = user
    ? user.user_metadata?.full_name || user.email?.split("@")[0] || "TaskForge User"
    : "Guest User";

const email = user?.email || "Guest Mode";
const status = user ? "Signed In" : "Guest Mode";

const elements = {
    "account-name": name,
    "account-email": email,
    "account-dropdown-name": name,
    "account-dropdown-email": email,
    "profile-account-name": name,
    "profile-account-email": email,
    "profile-account-status": status
};

Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
});


}



// ============================================
// 1. DISPLAY AUTHENTICATION MESSAGES
// ============================================

function showAuthMessage(message, type = "") {
    authStatus.textContent = message;
    authStatus.className = "auth-status";

    if (type) {
        authStatus.classList.add(type);
    }
}


// ============================================
// 2. SWITCH BETWEEN SIGN-UP AND SIGN-IN
// ============================================

function setAuthMode(mode) {
    const isSignup = mode === "signup";

    signupForm.hidden = !isSignup;
    signinForm.hidden = isSignup;

    authTabs.forEach(tab => {
        const isActive = tab.dataset.authMode === mode;

        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-pressed", String(isActive));
    });

    showAuthMessage("");
}

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        setAuthMode(tab.dataset.authMode);
    });
});


// ============================================
// 3. SHOW THE DASHBOARD
// ============================================


function showDashboard() {
    authScreen.hidden = true;
    appLayout.hidden = false;

    if (bottomNav) {
        bottomNav.hidden = false;
    }

    document.body.classList.remove("auth-mode");
}

async function openDashboardForCurrentUser() {
showDashboard();


updateAccountProfile();

if (currentUser) {
    if (typeof loadCloudTasks === "function") {
        await loadCloudTasks();
    }
} else {
    taskStorageMode = "guest";
    tasksReady = true;
    loadGuestTasks();
    renderTasks();
}


}




// ============================================
// 4. SHOW THE AUTHENTICATION SCREEN
// ============================================

function showAuthentication() {
    authScreen.hidden = false;
    appLayout.hidden = true;

    if (bottomNav) {
        bottomNav.hidden = true;
    }

    document.body.classList.add("auth-mode");
}


// ============================================
// 5. CREATE AN ACCOUNT
// ============================================

signupForm.addEventListener("submit", async event => {
    event.preventDefault();

    const fullName = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    const confirmPassword = signupConfirmPassword.value;

    if (!fullName) {
        showAuthMessage("Please enter your full name.", "error");
        return;
    }

    if (password.length < 8) {
        showAuthMessage(
            "Your password must contain at least 8 characters.",
            "error"
        );
        return;
    }

    if (password !== confirmPassword) {
        showAuthMessage(
            "Your passwords do not match.",
            "error"
        );
        signupConfirmPassword.focus();
        return;
    }

    const submitButton = signupForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) {
            throw error;
        }

        // Supabase may create the account but require email
        // confirmation before creating an authenticated session.
        if (data.session) {
            currentUser = data.user;

            showAuthMessage(
                "Your account is ready. Opening your dashboard...",
                "success"
            );

            setTimeout(showDashboard, 800);
        } else {
            showAuthMessage(
                "Your registration was submitted. Check your email for the confirmation message before signing in.",
                "success"
            );

            setAuthMode("signin");
            signinEmail.value = email;
        }

    } catch (error) {
        console.error("TaskForge registration error:", error);

        showAuthMessage(
            error.message || "We could not create your account.",
            "error"
        );
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Create My Account →";
    }
});


// ============================================
// 6. SIGN IN
// ============================================

signinForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = signinEmail.value.trim();
    const password = signinPassword.value;

    const submitButton = signinForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        currentUser = data.user;

       showAuthMessage("Signed in successfully. Welcome back!", "success");

       await openDashboardForCurrentUser();

    } catch (error) {
        console.error("TaskForge sign-in error:", error);

        showAuthMessage(
            error.message || "We could not sign you in.",
            "error"
        );
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Sign In →";
    }
});


// ============================================
// 7. CONTINUE AS GUEST
// ============================================


guestButton.addEventListener("click", async () => {
    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        currentUser = null;

        // Switch to guest storage and load only guest tasks.
        taskStorageMode = "guest";
        tasksReady = true;

        loadGuestTasks();
        renderTasks();
        showDashboard();

        console.log("TaskForge is running in guest mode.");
    } catch (error) {
        console.error("Could not switch to guest mode:", error);

        showAuthMessage(
            "We couldn't switch to guest mode. Please try again.",
            "error"
        );
    }
});



// ============================================
// 8. CHECK EXISTING AUTHENTICATION SESSION
// ============================================

async function initializeAuthentication() {
    try {
        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (data.session) {
    currentUser = data.session.user;
    await openDashboardForCurrentUser();
} else {
    currentUser = null;
    taskStorageMode = "guest";
    tasksReady = true;
    showAuthentication();
}

    } catch (error) {
        console.error(
            "Could not initialize authentication:",
            error
        );

        showAuthentication();

        showAuthMessage(
            "We couldn't check your session. Please try again.",
            "error"
        );
    }
}



// Show the reset-password screen
function showResetPasswordScreen() {
    isPasswordRecovery = true;

    const authScreen = document.getElementById("auth-screen");
    const signupForm = document.getElementById("signup-form");
    const signinForm = document.getElementById("signin-form");
    const authTabs = document.querySelector(".auth-tabs");
    const authHeading = document.querySelector(".auth-heading");
    const authDivider = document.querySelector(".auth-divider");
    const guestButton = document.getElementById("guest-button");
    const authFooter = document.querySelector(".auth-footer");

    if (authScreen) authScreen.hidden = false;
    if (signupForm) signupForm.hidden = true;
    if (signinForm) signinForm.hidden = true;
    if (resetPasswordForm) resetPasswordForm.hidden = false;

    if (authTabs) authTabs.hidden = true;
    if (authHeading) authHeading.hidden = true;
    if (authDivider) authDivider.hidden = true;
    if (guestButton) guestButton.hidden = true;
    if (authFooter) authFooter.hidden = true;

    if (resetPasswordStatus) {
        resetPasswordStatus.textContent =
            "Enter and confirm your new password.";
    }
}


// ============================================
// 9. LISTEN FOR AUTHENTICATION CHANGES
// ============================================

supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    // Handle password recovery before showing the dashboard
    if (event === "PASSWORD_RECOVERY" && session) {
        showResetPasswordScreen();
        return;
    }

    // Handle normal authentication
    if (session) {
        showDashboard();
    } else if (event === "SIGNED_OUT") {
        showAuthentication();
    }
});

const accountSignoutButton = document.getElementById(
"account-signout-button"
);

const accountSwitchGuestButton = document.getElementById(
"account-switch-guest-button"
);

if (accountSignoutButton) {
accountSignoutButton.addEventListener("click", async () => {
accountSignoutButton.disabled = true;
accountSignoutButton.textContent = "Signing out...";


    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        currentUser = null;
        updateAccountProfile();
        showAuthentication();

        console.log("TaskForge: Signed out successfully.");
    } catch (error) {
        console.error("TaskForge sign-out error:", error);

        alert("We couldn't sign you out. Please try again.");
    } finally {
        accountSignoutButton.disabled = false;
        accountSignoutButton.textContent = "Sign Out";
    }
});


}

if (accountSwitchGuestButton) {
accountSwitchGuestButton.addEventListener("click", async () => {
accountSwitchGuestButton.disabled = true;
accountSwitchGuestButton.textContent = "Switching...";


    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        currentUser = null;

        taskStorageMode = "guest";
        tasksReady = true;

        loadGuestTasks();
        renderTasks();
        updateAccountProfile();

        showDashboard();
        showScreen("home");

        console.log("TaskForge is now running in Guest Mode.");
    } catch (error) {
        console.error("TaskForge guest-mode error:", error);

        alert("We couldn't switch to Guest Mode. Please try again.");
    } finally {
        accountSwitchGuestButton.disabled = false;
        accountSwitchGuestButton.textContent = "Switch to Guest Mode";
    }
});


}


// ==========================================
// TASKFORGE — LIVE PASSWORD STRENGTH
// ==========================================

const strengthContainer = document.getElementById(
    "signup-password-strength"
);
const strengthBar = document.getElementById("signup-strength-bar");
const strengthLabel = document.getElementById("signup-strength-label");

function checkPasswordStrength(password) {
    if (!password) {
        return {
            level: "",
            score: 0,
            message: ""
        };
    }

    let score = 0;

    // Check password length.
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Check character variety.
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Penalize common, predictable passwords.
    const predictablePasswords = [
        "password",
        "password123",
        "12345678",
        "qwerty123",
        "admin123"
    ];

    if (
        predictablePasswords.includes(password.toLowerCase()) ||
        /^(.)\1+$/.test(password)
    ) {
        score = 0;
    }

    if (password.length < 8) {
        return {
            level: "weak",
            score: 1,
            message: "Weak — use at least 8 characters."
        };
    }

    if (score <= 3) {
        return {
            level: "weak",
            score: 1,
            message: "Weak — add more variety to your password."
        };
    }

    if (score <= 4) {
        return {
            level: "fair",
            score: 2,
            message: "Fair — try adding more variety or length."
        };
    }

    return {
        level: "strong",
        score: 3,
        message: "Strong — good password complexity!"
    };
}

if (
    signupPassword &&
    strengthContainer &&
    strengthBar &&
    strengthLabel
) {
    signupPassword.addEventListener("input", () => {
        const result = checkPasswordStrength(signupPassword.value);

        if (!signupPassword.value) {
            strengthContainer.hidden = true;
            strengthBar.style.width = "0";
            strengthBar.removeAttribute("data-strength");
            strengthLabel.removeAttribute("data-strength");
            strengthLabel.textContent = "";
            return;
        }

        strengthContainer.hidden = false;

        const widths = {
            weak: "33%",
            fair: "66%",
            strong: "100%"
        };

        strengthBar.style.width = widths[result.level];
        strengthBar.dataset.strength = result.level;
        strengthLabel.dataset.strength = result.level;
        strengthLabel.textContent = result.message;
    });
}



// ==========================================
// TASKFORGE — SHOW / HIDE PASSWORD
// ==========================================

document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const targetId = button.dataset.passwordTarget;
        const passwordInput = document.getElementById(targetId);

        if (!passwordInput) {
            console.error(
                `TaskForge: Password input "${targetId}" was not found.`
            );
            return;
        }

        const isPasswordHidden = passwordInput.type === "password";

        // Toggle password visibility.
        passwordInput.type = isPasswordHidden ? "text" : "password";

        // Update accessibility information.
        button.setAttribute(
            "aria-label",
            isPasswordHidden ? "Hide password" : "Show password"
        );

        button.setAttribute(
            "aria-pressed",
            String(isPasswordHidden)
        );

        // Keep keyboard focus on the eye button.
        button.focus();
    });
});


// ==========================================
// TASKFORGE — LIVE PASSWORD MATCH VALIDATION
// ==========================================

const confirmPasswordInput = document.getElementById(
    "signup-confirm-password"
);

const passwordMatchMessage = document.getElementById(
    "password-match-message"
);

function checkPasswordMatch() {
    if (!signupPassword || !confirmPasswordInput || !passwordMatchMessage) {
        return true;
    }

    const password = signupPassword.value;
    const confirmation = confirmPasswordInput.value;

    // Keep the message hidden until the user starts confirming.
    if (!confirmation) {
        passwordMatchMessage.hidden = true;
        passwordMatchMessage.textContent = "";
        passwordMatchMessage.classList.remove(
            "match-success",
            "match-error"
        );

        confirmPasswordInput.setCustomValidity("");
        return true;
    }

    // Do not claim a match when both fields are empty.
    if (password && password === confirmation) {
        passwordMatchMessage.textContent = "✓ Passwords match";
        passwordMatchMessage.classList.remove("match-error");
        passwordMatchMessage.classList.add("match-success");
        passwordMatchMessage.hidden = false;

        confirmPasswordInput.setCustomValidity("");
        return true;
    }

    passwordMatchMessage.textContent = "✕ Passwords don't match";
    passwordMatchMessage.classList.remove("match-success");
    passwordMatchMessage.classList.add("match-error");
    passwordMatchMessage.hidden = false;

    confirmPasswordInput.setCustomValidity(
        "Your passwords do not match."
    );

    return false;
}

if (signupPassword && confirmPasswordInput) {
    signupPassword.addEventListener("input", checkPasswordMatch);
    confirmPasswordInput.addEventListener("input", checkPasswordMatch);
}

if (signupForm) {
    signupForm.addEventListener("submit", (event) => {
        if (!checkPasswordMatch()) {
            event.preventDefault();
            confirmPasswordInput.reportValidity();
            confirmPasswordInput.focus();
        }
    });
}



// ==========================================
// TASKFORGE — FORGOT PASSWORD
// ==========================================

const forgotPasswordButton = document.getElementById(
    "forgot-password-button"
);

const signinEmailInput = document.getElementById("signin-email");

if (forgotPasswordButton && signinEmailInput && authStatus) {
    forgotPasswordButton.addEventListener("click", async () => {
        const email = signinEmailInput.value.trim();

        // Validate the email before requesting a reset.
        if (!email || !signinEmailInput.validity.valid) {
            authStatus.textContent =
                "Please enter a valid email address first.";

            signinEmailInput.focus();
            return;
        }

        forgotPasswordButton.disabled = true;
        forgotPasswordButton.textContent = "Sending email...";

        authStatus.textContent = "Requesting password reset...";

        try {
            const redirectUrl =
    "https://lincon-web.github.io/TaskForge/?reset-password=true";

            const { error } =
                await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: redirectUrl
                });

            if (error) {
                throw error;
            }

            authStatus.textContent =
                "If an account exists for this email, a password-reset link will be sent. Check your inbox and spam folder.";

            console.log("TaskForge: Password-reset request submitted.");
        } catch (error) {
            console.error("TaskForge password-reset error:", error);

            authStatus.textContent =
                "We couldn't send the reset email. Please try again later.";
        } finally {
            forgotPasswordButton.disabled = false;
            forgotPasswordButton.textContent = "Forgot password?";
        }
    });
}

// ==========================================
// TASKFORGE — RESET PASSWORD
// ==========================================

const resetPasswordForm = document.getElementById("reset-password-form");
const resetNewPassword = document.getElementById("reset-new-password");
const resetConfirmPassword = document.getElementById("reset-confirm-password");
const resetPasswordStatus = document.getElementById("reset-password-status");
const resetMatchMessage = document.getElementById("reset-password-match-message");

let isPasswordRecovery = false;






// Check that the new passwords match
function validateResetPasswords() {
    if (!resetNewPassword || !resetConfirmPassword || !resetMatchMessage) {
        return false;
    }

    const password = resetNewPassword.value;
    const confirmation = resetConfirmPassword.value;

    if (!confirmation) {
        resetMatchMessage.hidden = true;
        resetConfirmPassword.setCustomValidity("");
        return false;
    }

    if (password === confirmation) {
        resetMatchMessage.textContent = "✓ Passwords match";
        resetMatchMessage.classList.remove("error");
        resetMatchMessage.classList.add("success");
        resetMatchMessage.hidden = false;

        resetConfirmPassword.setCustomValidity("");
        return true;
    }

    resetMatchMessage.textContent = "✕ Passwords don't match";
    resetMatchMessage.classList.remove("success");
    resetMatchMessage.classList.add("error");
    resetMatchMessage.hidden = false;

    resetConfirmPassword.setCustomValidity(
        "Your passwords do not match."
    );

    return false;
}


if (resetNewPassword && resetConfirmPassword) {
    resetNewPassword.addEventListener("input", validateResetPasswords);
    resetConfirmPassword.addEventListener("input", validateResetPasswords);
}


// Save the new password using Supabase
if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!isPasswordRecovery) {
            resetPasswordStatus.textContent =
                "Please open the password-reset link from your email first.";
            return;
        }

        if (!validateResetPasswords()) {
            resetConfirmPassword.reportValidity();
            resetConfirmPassword.focus();
            return;
        }

        if (resetNewPassword.value.length < 8) {
            resetPasswordStatus.textContent =
                "Your password must contain at least 8 characters.";
            resetNewPassword.focus();
            return;
        }

        const submitButton = resetPasswordForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Updating Password...";

        resetPasswordStatus.textContent = "Saving your new password...";

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: resetNewPassword.value
            });

            if (error) throw error;

            resetPasswordStatus.textContent =
                "Password updated successfully! You can now sign in with your new password.";

            resetPasswordForm.reset();
            resetMatchMessage.hidden = true;

            isPasswordRecovery = false;

            await supabaseClient.auth.signOut();

            if (typeof showAuthentication === "function") {
                showAuthentication();
            }

            const status = document.getElementById("auth-status");

            if (status) {
                status.textContent =
                    "Your password has been updated. Please sign in with your new password.";
            }

        } catch (error) {
            console.error("TaskForge password update failed:", error);

            resetPasswordStatus.textContent =
                error.message ||
                "We couldn't update your password. Please request a new reset link.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Update Password →";
        }
    });
}






// ============================================
// 10. START AUTHENTICATION
// ============================================

setAuthMode("signup");
initializeAuthentication();

console.log("TaskForge authentication initialized.");


