import { oauth } from "./utils.js";

class Footer extends HTMLElement{
    constructor(){
        super();
    }

    connectedCallback(){
        this.innerHTML = `
        <footer class="main-footer">
            <div class="footer-content">
            <div class="footer-info">
                <div class="footer-brand">
                <span class="footer-logo">KR</span>
                <span class="footer-name">KartingFever</span>
                </div>
            </div>
            
            <div class="footer-links">
                <div class="footer-column">
                <h4>Informations</h4>
                <ul>
                    <li><a href="#">À propos</a></li>
                    <li><a href="#">Comment jouer</a></li>
                    <li><a href="#">Classement</a></li>
                </ul>
                </div>
                
                <div class="footer-column">
                <h4>Support</h4>
                <ul>
                    <li><a href="#">FAQ</a></li>
                    <li><a href="#">Contact</a></li>
                    <li><a href="#">Signaler un bug</a></li>
                </ul>
                </div>
                
                <div class="footer-column">
                <h4>Légal</h4>
                <ul>
                    <li><a href="#">Conditions</a></li>
                    <li><a href="#">Confidentialité</a></li>
                    <li><a href="#">Cookies</a></li>
                </ul>
                </div>
            </div>
            </div>
            
            <div class="footer-bottom">
            <p>&copy; 2025 KartingFever. Tous droits réservés.</p>
            <div class="social-icons">
                <a href="#" class="social-icon">FB</a>
                <a href="#" class="social-icon">TW</a>
                <a href="#" class="social-icon">IG</a>
                <a href="#" class="social-icon">YT</a>
            </div>
            </div>
        </footer>`
    }
}

class Header extends HTMLElement{
    constructor(){
        super();
    }

    async connectedCallback(){
        this.innerHTML = `
        <header class="main-header">
            <div class="header-content">
                <div class="logo-text">KARTING<span>FEVER</span></div>
                <div class="header-decoration"></div>
                <div class="header-auth">
                    <!--<button id="login" class="auth-btn" onclick="">Login</button>
                    <button id="register" class="auth-btn" onclick="document.location.pathname = '/register'">Register</button>-->
                </div>
            </div>
            <div class="menu-wrapper">
                <ul class="nav-items">
                    <li class="nav-item">
                        <a href="/home" class="nav-link">Home</a>
                    </li>
                    <li class="nav-item">
                        <a href="/home" class="nav-link">News</a>
                    </li>
                    <li class="nav-item">
                        <a href="/home" class="nav-link">Discord</a>
                    </li>
                    <li class="nav-item">
                        <a href="/home" class="nav-link">À propos</a>
                    </li>
                </ul>
            </div>
        </header>
        `;
        await this.oauthHandler();
    }

    async oauthHandler(){
        const login = document.createElement("button");
        const register = document.createElement("button");
        login.id = "login";
        login.innerText = "Login";
        login.classList.add("auth-btn");
        login.onclick = ()=>{
            document.location.pathname = '/login';
        }

        register.id = "register";
        register.innerText = "Register";
        register.classList.add("auth-btn");
        register.onclick = ()=>{
            document.location.pathname = '/register';
        }

        console.log(await oauth);
        if (await oauth == 200){
            // 1. First, let's modify your code to add some debugging and styles
            const avatar = document.createElement("div");
            avatar.innerHTML = `
            <div class="account-menu-wrapper">
                <button id="avatar-btn" class="avatar-btn">
                <img 
                    src="https://localhost:3000/src/user.svg" 
                    alt="User avatar" 
                    class="avatar-img"
                    onerror="console.error('Failed to load SVG:', this.src)"
                    onload="console.log('SVG loaded successfully')"
                >
                </button>
            </div>
            `;

            const headerAuth = document.querySelector(".header-auth");
            headerAuth.appendChild(avatar);
            console.log("Already Logged in !");
        }else if (await oauth == 401){
            const headerAuth = document.querySelector(".header-auth");
            headerAuth.appendChild(login);
            headerAuth.appendChild(register);
        }
    }
}

customElements.define('footer-component', Footer);
customElements.define('header-component', Header);