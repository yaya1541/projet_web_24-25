import { oauth,handleLogin } from "./utils.js";

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
        this.fr = document.createElement("iframe");
        this.fr.id = "myFrame"
        this.fr.frameBorder = 0;
        this.fr.width = '500';
        this.fr.height ='700';
        this.fr.scrolling = 'no';
        this.fr.style = 'top:5vh;right:5vw;position:absolute;z-index:200';
    }

    async connectedCallback(){
        this.innerHTML = `
        <header class="main-header">
            <div class="header-content">
                <div class="logo-text">KARTING<span>FEVER</span></div>
                <div class="header-decoration"></div>
                <div class="header-auth">
                    <!--<button id="login" class="auth-btn">Login</button>
                    <button id="register" class="auth-btn">Register</button>-->
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
                        <a href="/about" class="nav-link">À propos</a>
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
        const logout = document.createElement("button");
        const play = document.createElement("li");
        const play_link = document.createElement("a");

        login.id = "login";
        login.innerText = "Login";
        login.classList.add("auth-btn");

        login.addEventListener("click",(ev)=>{
            this.bindIFrame(this.fr,ev);
        })

        register.id = "register";
        register.innerText = "Register";
        register.classList.add("auth-btn");

        register.addEventListener("click",(ev)=>{
            this.bindIFrame(this.fr,ev);
        })

        logout.id = "logout";
        logout.innerText = "Log out";
        logout.classList.add("auth-btn");

        logout.addEventListener("click",async (_ev)=>{
            await this.logout();
        })

        play.classList.add("nav-item");
        play.appendChild(play_link);
        play_link.href = "/kartfever/game";
        play_link.innerHTML = "Play";
        play_link.classList.add("nav-link");


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
            headerAuth.appendChild(logout);
            headerAuth.appendChild(avatar);
            console.log("Oauth : Already Logged in !");

            const navbar = document.querySelector(".nav-items");
            navbar.appendChild(play);
        }else if (await oauth == 401){
            const headerAuth = document.querySelector(".header-auth");
            headerAuth.appendChild(login);
            headerAuth.appendChild(register);
        }
    }

    async logout(){
        const response = await fetch("https://localhost:3000/api/logout",{
            method:"POST",
            credentials :"include"
        })
        if (response.status==200){
            document.location.reload();
        }
    }

    bindIFrame(frame,ev){
        frame.src = `./${ev.target.id}`;
        ev.target.after(this.fr);
        try {
            // Attendre que l'iframe soit complètement chargée
            frame.addEventListener('load', function() {
                // Accéder au document de l'iframe
                const cw = frame.contentWindow.document;
                console.log('Document iframe chargé:', cw);
                
                // Maintenant que l'iframe est chargée, on peut chercher les éléments
                const password = cw.getElementById("password");
                const loginBtn = cw.getElementById("login-btn");
                
                // Vérifier que les éléments existent
                if (password && loginBtn) {
                    // Ajouter les écouteurs d'événements
                    password.addEventListener('keyup', function(event) {
                    if (event.key === 'Enter') {
                        handleLogin(cw);
                    }
                    });
                    
                    loginBtn.addEventListener('click', function() {
                        handleLogin(cw);
                    });
                } else {
                    console.error("Éléments non trouvés dans l'iframe");
                }
            });
        } catch (e) {
            console.error("Cannot access iframe content:", e);
        }
    }
}
/*
customElements.whenDefined("header-component").then(()=>
{
    const auth_btns = document.getElementsByClassName("auth-btn");
    
    const find_btns = ()=>{
        if (auth_btns.length == 2) {
            console.log("Charged");
            for (const element of auth_btns) {
                //element.addEventListener('click',(ev)=>(addifr(ev)));
            }
            return;
        }else{
            setTimeout(find_btns,50);
        }
    }

    find_btns();
}
) */ 
        
        
        

customElements.define('footer-component', Footer);
customElements.define('header-component', Header);