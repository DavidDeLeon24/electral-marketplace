// ============= GLOBAL VARIABLES =============
const API_BASE = 'http://localhost:3000/api';

// ============= AUTHENTICATION FUNCTIONS =============

// Store token in localStorage
function setToken(token) {
    localStorage.setItem('token', token);
}

// Get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Remove token (logout)
function removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Store user data
function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

// Get user data
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Check if user is logged in
function isLoggedIn() {
    return !!getToken();
}

// Add auth header to fetch requests
async function authFetch(url, options = {}) {
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            removeToken();
            updateAuthUI();
            if (!window.location.pathname.includes('login.html') && 
                !window.location.pathname.includes('register.html')) {
                window.location.href = '/login.html?session=expired';
            }
            return null;
        }

        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// Update UI based on login status
async function updateAuthUI() {
    const loggedIn = isLoggedIn();
    const user = getUser();
    
    const loginLinks = document.querySelectorAll('#loginLink');
    const profileLinks = document.querySelectorAll('#profileLink');
    const logoutLinks = document.querySelectorAll('#logoutLink');
    const messagesLink = document.querySelector('a[href="/messages.html"]');
    
    loginLinks.forEach(link => {
        if (link) link.style.display = loggedIn ? 'none' : 'inline-block';
    });
    
    profileLinks.forEach(link => {
        if (link) link.style.display = loggedIn ? 'inline-block' : 'none';
    });
    
    logoutLinks.forEach(link => {
        if (link) {
            link.style.display = loggedIn ? 'inline-block' : 'none';
            if (loggedIn) {
                link.onclick = (e) => {
                    e.preventDefault();
                    logout();
                };
            }
        }
    });
    
    // Update unread badge
    if (loggedIn && messagesLink) {
        const unreadCount = await getUnreadCount();
        const existingBadge = messagesLink.querySelector('.unread-badge');
        
        if (unreadCount > 0) {
            if (existingBadge) {
                existingBadge.textContent = unreadCount;
            } else {
                messagesLink.innerHTML += `<span class="unread-badge" style="background: #f56565; color: white; border-radius: 10px; padding: 0.1rem 0.5rem; font-size: 0.7rem; margin-left: 0.5rem;">${unreadCount}</span>`;
            }
        } else if (existingBadge) {
            existingBadge.remove();
        }
    }
    
    if (window.location.pathname.includes('sell.html') && !loggedIn) {
        window.location.href = '/login.html?redirect=sell.html';
    }
}

// Login function
async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        setToken(data.token);
        setUser(data.user);
        updateAuthUI();
        
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || '/';
        window.location.href = redirect;
        
        return { success: true };
    } catch (error) {
        showAlert(error.message, 'error');
        return { success: false, error: error.message };
    }
}

// Register function
async function register(userData) {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        setToken(data.token);
        setUser(data.user);
        updateAuthUI();
        
        window.location.href = '/';
        return { success: true };
    } catch (error) {
        showAlert(error.message, 'error');
        return { success: false, error: error.message };
    }
}

// Logout function
function logout() {
    removeToken();
    updateAuthUI();
    window.location.href = '/';
}

// ============= MESSAGES FUNCTIONS =============

// Get unread message count
async function getUnreadCount() {
    if (!isLoggedIn()) return 0;
    
    try {
        const response = await authFetch(`${API_BASE}/messages/unread/count`);
        if (!response) return 0;
        
        const data = await response.json();
        return data.unreadCount;
    } catch (error) {
        return 0;
    }
}

// Send message to seller
async function sendMessageToSeller(receiverId, partId, content) {
    if (!isLoggedIn()) {
        showAlert('Please login to send messages', 'error');
        setTimeout(() => {
            window.location.href = `/login.html?redirect=${window.location.pathname}`;
        }, 2000);
        return false;
    }
    
    try {
        const response = await authFetch(`${API_BASE}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                receiverId,
                partId,
                content
            })
        });
        
        if (!response) return false;
        
        if (response.ok) {
            showAlert('Message sent successfully!', 'success');
            return true;
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to send message', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showAlert('Error sending message', 'error');
        return false;
    }
}

// ============= REVIEW FUNCTIONS =============

// Submit a review
async function submitReview(revieweeId, partId, rating, comment) {
    if (!isLoggedIn()) {
        showAlert('Please login to leave a review', 'error');
        setTimeout(() => {
            window.location.href = `/login.html?redirect=${window.location.pathname}`;
        }, 2000);
        return false;
    }
    
    try {
        const response = await authFetch(`${API_BASE}/reviews`, {
            method: 'POST',
            body: JSON.stringify({
                revieweeId,
                partId,
                rating,
                comment
            })
        });
        
        if (!response) return false;
        
        if (response.ok) {
            showAlert('Review submitted successfully!', 'success');
            return true;
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to submit review', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showAlert('Error submitting review', 'error');
        return false;
    }
}

// ============= PARTS FUNCTIONS =============

// Load parts on home page
async function loadParts() {
    const partsGrid = document.getElementById('partsGrid');
    if (!partsGrid) return;

    try {
        partsGrid.innerHTML = '<div class="loading">Loading parts...</div>';

        const response = await fetch(`${API_BASE}/parts`);
        const data = await response.json();

        if (data.parts && data.parts.length > 0) {
            displayParts(data.parts);
        } else {
            partsGrid.innerHTML = '<div class="no-parts">No parts available</div>';
        }
    } catch (error) {
        console.error('Error loading parts:', error);
        partsGrid.innerHTML = '<div class="error">Failed to load parts. Please try again later.</div>';
    }
}

// Display parts in grid with message button
function displayParts(parts) {
    const partsGrid = document.getElementById('partsGrid');
    if (!partsGrid) return;
    
    const currentUser = getUser();

    partsGrid.innerHTML = parts.map(part => `
        <div class="part-card" data-part-id="${part._id}">
            <div class="part-image">
                <i class="fas fa-microchip"></i>
            </div>
            <div class="part-info">
                <h3>${part.partName}</h3>
                <p class="part-category">${part.category}</p>
                <p class="part-condition condition-${part.condition}">${part.condition}</p>
                <p class="part-price">$${Number(part.price).toFixed(2)}</p>
                <p class="part-seller">Sold by: ${part.seller?.username || 'Unknown'}</p>
                <p class="part-description">${part.description ? part.description.substring(0, 100) + '...' : 'No description'}</p>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="view-details-btn" onclick="viewPartDetails('${part._id}')">View Details</button>
                    ${currentUser && part.seller?._id !== currentUser.id ? 
                        `<button class="message-seller-btn" onclick="openMessageModal('${part.seller?._id}', '${part._id}', '${part.partName}')">
                            <i class="fas fa-envelope"></i> Message
                        </button>` : ''
                    }
                </div>
            </div>
        </div>
    `).join('');
}

// Open message modal
function openMessageModal(sellerId, partId, partName) {
    const message = prompt(`Send a message to the seller about "${partName}":`);
    if (message && message.trim()) {
        sendMessageToSeller(sellerId, partId, message);
    }
}

// View part details
function viewPartDetails(partId) {
    window.location.href = `/part.html?id=${partId}`;
}

// Handle sell form submission
async function handleSellFormSubmit(event) {
    event.preventDefault();

    if (!isLoggedIn()) {
        showAlert('Please login to list a part', 'error');
        setTimeout(() => {
            window.location.href = '/login.html?redirect=sell.html';
        }, 2000);
        return;
    }

    const form = event.target;
    const formData = new FormData(form);
    
    const partData = {
        partName: formData.get('partName'),
        category: formData.get('category'),
        condition: formData.get('condition'),
        price: parseFloat(formData.get('price')),
        description: formData.get('description')
    };

    try {
        const response = await authFetch(`${API_BASE}/parts`, {
            method: 'POST',
            body: JSON.stringify(partData)
        });

        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            showAlert('Part listed successfully!', 'success');
            form.reset();
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            showAlert(data.message || 'Failed to list part', 'error');
        }
    } catch (error) {
        console.error('Error listing part:', error);
        showAlert('Error listing part. Please try again.', 'error');
    }
}

// ============= SEARCH FUNCTIONS =============

// Search parts
async function searchParts(query) {
    if (!query || query.length < 2) {
        loadParts();
        return;
    }

    const partsGrid = document.getElementById('partsGrid');
    if (!partsGrid) return;

    try {
        partsGrid.innerHTML = '<div class="loading">Searching...</div>';

        const response = await fetch(`${API_BASE}/parts?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.parts && data.parts.length > 0) {
            displayParts(data.parts);
        } else {
            partsGrid.innerHTML = '<div class="no-parts">No parts found matching your search</div>';
        }
    } catch (error) {
        console.error('Error searching parts:', error);
        partsGrid.innerHTML = '<div class="error">Search failed. Please try again.</div>';
    }
}

// Filter by category
async function filterByCategory(category) {
    const partsGrid = document.getElementById('partsGrid');
    if (!partsGrid) return;

    try {
        partsGrid.innerHTML = '<div class="loading">Loading category...</div>';

        const response = await fetch(`${API_BASE}/parts/category/${encodeURIComponent(category)}`);
        const data = await response.json();
        
        if (data.parts && data.parts.length > 0) {
            displayParts(data.parts);
        } else {
            partsGrid.innerHTML = `<div class="no-parts">No parts found in ${category} category</div>`;
        }
    } catch (error) {
        console.error('Error filtering by category:', error);
        partsGrid.innerHTML = '<div class="error">Failed to load category. Please try again.</div>';
    }
}

// ============= UTILITY FUNCTIONS =============

// Show alert message
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(alertDiv, main.firstChild);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }
}

// ============= EVENT LISTENERS =============

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index.html') {
        loadParts();
        
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => {
                searchParts(searchInput.value);
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchParts(searchInput.value);
                }
            });
        }
        
        document.querySelectorAll('.category').forEach(cat => {
            cat.addEventListener('click', () => {
                const category = cat.dataset.cat;
                filterByCategory(category);
            });
        });
    }
    
    if (path === '/login.html') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                await login(email, password);
            });
        }
    }
    
    if (path === '/register.html') {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userData = {
                    email: document.getElementById('email').value,
                    password: document.getElementById('password').value,
                    username: document.getElementById('username').value,
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value
                };
                await register(userData);
            });
        }
    }
    
    if (path === '/sell.html') {
        const sellForm = document.getElementById('sellForm');
        if (sellForm) {
            sellForm.addEventListener('submit', handleSellFormSubmit);
        }
    }
});

// Make functions globally available
window.viewPartDetails = viewPartDetails;
window.editPart = editPart;
window.deletePart = deletePart;
window.logout = logout;
window.sendMessageToSeller = sendMessageToSeller;
window.openMessageModal = openMessageModal;
window.submitReview = submitReview;