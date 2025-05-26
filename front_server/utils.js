export const oauth = fetch(
    'https://yanisrasp.duckdns.org:3000/api/auth/oauth',
    {
        method: 'GET',
        credentials: 'include',
    },
).then((res) => {
    return res.status;
});

export const userData = fetch(
    'https://yanisrasp.duckdns.org:3000/api/users/me',
    {
        method: 'GET',
        credentials: 'include',
    },
).then((res) => {
    return res.json();
}).then((data) => {
    return data;
});

export const handleLogin = async (doc) => {
    const username = doc.getElementById('username');
    const password = doc.getElementById('password');
    //const loginBtn = doc.getElementById("login-btn");
    await fetch('https://yanisrasp.duckdns.org:3000/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
            userName: username.value,
            userPassword: password.value,
        }),
    }).then((res) => {
        console.log(res.status);
        switch (res.status) {
            case 200:
                // TODO : Remove timeout from location change.
                localStorage.setItem('CurrentUser', username.value);
                document.location.reload();
                break;
            default:
                showError('Identifiants incorrects. Veuillez réessayer.', doc);
                break;
        }
    });
};

export const handleregister = async (doc) => {
    const username = doc.getElementById('username');
    const password = doc.getElementById('password');
    const email = doc.getElementById(
        'email',
    );
    console.log({
        email: email.value,
        userName: username.value,
        userPassword: password.value,
    });

    await fetch(
        `https://yanisrasp.duckdns.org:3000/api/auth/register`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email.value,
                userName: username.value,
                userPassword: password.value,
            }),
        },
    ).then((res) => {
        switch (res.status) {
            case 201:
                showSuccess(
                    'Registered successfully !',
                    doc,
                );
                setTimeout(() => globalThis.location.reload(), 700);
                break;
            case 409:
                showError(
                    'Username already in use please change.',
                    doc,
                );
                setTimeout(() => globalThis.location.reload(), 700);
                break;
            case 500:
                showError('Error with server !', doc);
                setTimeout(() => globalThis.location.reload(), 700);
                break;
            default:
                break;
        }
    });
};

function showError(message, doc) {
    const errorElement = doc.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;

    const existingError = doc.querySelector('.error-message');
    if (existingError) existingError.remove();

    doc.querySelector('.input-container').appendChild(errorElement);
    setTimeout(() => {
        errorElement.classList.add('fade-out');
        setTimeout(() => {
            errorElement.remove();
        }, 500);
        return;
    }, 3000);
}

export function showSuccess(message, doc) {
    const successElement = doc.createElement('div');
    successElement.className = 'success-message';
    successElement.textContent = message;

    const existingSuccess = doc.querySelector('.success-message');
    if (existingSuccess) existingSuccess.remove();

    doc.querySelector('.input-container').appendChild(successElement);

    setTimeout(() => {
        successElement.classList.add('fade-out');
        setTimeout(() => {
            successElement.remove();
        }, 500);
    }, 3000);
}

export const getUserSettings = (userId) => {
    // try {
    //     const response = await fetch(`https://yanisrasp.duckdns.org:3000/api/users/${userId}/settings`, {
    //         method: 'GET',
    //         credentials: 'include',
    //     });
    //     if (!response.ok) throw new Error('Failed to fetch settings');
    //     return await response.json();
    // } catch (error) {
    //     console.error('Error fetching user settings:', error);
    //     return null;
    // }
    console.warn('getUserSettings is not implemented yet.');
    return { theme: true, email_notification: false }; // Placeholder
};

export const updateUserSettings = (userId, settings) => {
    // try {
    //     const response = await fetch(`https://yanisrasp.duckdns.org:3000/api/users/${userId}/settings`, {
    //         method: 'POST', // Or PUT
    //         credentials: 'include',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify(settings),
    //     });
    //     return response.ok;
    // } catch (error) {
    //     console.error('Error updating user settings:', error);
    //     return false;
    // }
    console.warn('updateUserSettings is not implemented yet.');
    return true; // Placeholder
};
