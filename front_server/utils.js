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
                setInterval(
                    () =>
                        document.location.replace(
                            'https://yanisrasp.duckdns.org/home',
                        ),
                    500,
                );
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
                showError(
                    'Registered successfully !',
                );
                document.location.pathname = '/home';
                break;
            case 200:
                showError(
                    'Username already in use please change.',
                );
                break;
            case 500:
                showError('Error with server !', doc);
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
