export const oauth = fetch("https://localhost:3000/api/oauth", {
    method: "GET",
    credentials: "include",
}).then((res) => {
    return res.status;
});

export const handleLogin = async (doc) => {
    const username = doc.getElementById("username");
    const password = doc.getElementById("password");
    //const loginBtn = doc.getElementById("login-btn");
    await fetch("https://localhost:3000/api/login", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
            user: username.value,
            pass: password.value,
        }),
    }).then((res) => {
        console.log(res.status);
        switch (res.status) {
            case 200:
                // TODO : Remove timeout from location change.
                localStorage.setItem("CurrentUser", username.value);
                setInterval(
                    () =>
                        document.location.replace(
                            "https://localhost:8080/home",
                        ),
                    500,
                );
                break;
            default:
                showError("Identifiants incorrects. Veuillez réessayer.", doc);
                break;
        }
    });
};

function showError(message, doc) {
    const errorElement = doc.createElement("div");
    errorElement.className = "error-message";
    errorElement.textContent = message;

    const existingError = doc.querySelector(".error-message");
    if (existingError) existingError.remove();

    doc.querySelector(".input-container").appendChild(errorElement);
    setTimeout(() => {
        errorElement.classList.add("fade-out");
        setTimeout(() => {
            errorElement.remove();
        }, 500);
        return;
    }, 3000);
}
